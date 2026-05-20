import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";
import { validateFileMetadata } from "@/lib/validation";
import { getFileExtension, sanitizeFileName, detectMimeType, inferResourceType } from "@/lib/file-utils";

export const runtime = "nodejs";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "secret");

async function getUser(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { userId: string; role: string };
  } catch {
    return null;
  }
}

/** Safely destroy a Cloudinary asset (non-fatal). */
async function destroyCloudinaryAsset(
  publicId: string,
  resourceType: string,
) {
  try {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
    const form = new FormData();
    form.append("public_id", publicId);
    form.append("invalidate", "true");
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
      { method: "POST", body: form },
    );
    const data = await res.json();
    console.log(`[Cloudinary destroy] ${publicId} (${resourceType}):`, data?.result);
  } catch (err) {
    console.warn("[Cloudinary destroy] Non-fatal error:", err);
  }
}

// ── POST /api/assignments/submit-file ─────────────────────────────────────────
/**
 * Accepts JSON body (file already uploaded browser → Cloudinary):
 * {
 *   assignmentId:   string
 *   url:            string   ← Cloudinary secure_url
 *   publicId:       string   ← Cloudinary public_id
 *   resourceType:   string   ← Cloudinary resource_type
 *   originalName:   string
 *   mimeType:       string
 *   size:           number
 * }
 *
 * On resubmit: deletes old Cloudinary asset + old UploadedFile record first.
 * Auth: STUDENT only.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "STUDENT")
    return NextResponse.json({ error: "Only students can submit assignments." }, { status: 403 });

  let body: {
    assignmentId: string;
    url: string;
    publicId: string;
    resourceType: string;
    originalName: string;
    mimeType?: string;
    size: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { assignmentId, url, publicId, resourceType, originalName, size } = body;
  const rawMime = body.mimeType ?? "";

  if (!assignmentId || !url || !publicId || !originalName) {
    return NextResponse.json(
      { error: "assignmentId, url, publicId, and originalName are required." },
      { status: 400 },
    );
  }

  // ── Normalize & validate ───────────────────────────────────────────────────
  const safeName  = sanitizeFileName(originalName);
  const extension = getFileExtension(safeName);
  const mimeType  = detectMimeType(safeName, rawMime);

  const validationError = validateFileMetadata(size, safeName, mimeType);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  // ── Verify assignment exists ───────────────────────────────────────────────
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true },
  });
  if (!assignment) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });

  // ── Handle resubmission: clean up old file ─────────────────────────────────
  const existing = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: user.userId } },
    select: {
      id: true,
      fileId: true,
      // legacy fallback fields
      publicId: true,
      fileType: true,
      file: { select: { id: true, publicId: true, resourceType: true, extension: true } },
    },
  });

  if (existing) {
    // Resolve old Cloudinary asset info: prefer normalized relation, fall back to legacy
    const oldPublicId =
      existing.file?.publicId ?? existing.publicId;
    const oldResourceType =
      existing.file?.resourceType ??
      inferResourceType(existing.file?.extension ?? existing.fileType ?? "");

    if (oldPublicId) {
      await destroyCloudinaryAsset(oldPublicId, oldResourceType);
    }

    // Delete old UploadedFile record if present (submission keeps fileId null until we set new one)
    if (existing.fileId) {
      await prisma.uploadedFile.delete({ where: { id: existing.fileId } }).catch(() => {});
    }
  }

  // ── Create new UploadedFile + upsert submission ────────────────────────────
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create new UploadedFile
      const uploadedFile = await tx.uploadedFile.create({
        data: {
          originalName: safeName,
          extension,
          mimeType,
          size,
          url,
          publicId,
          resourceType: resourceType ?? "raw",
          uploadedBy: user.userId,
        },
      });

      // 2. Upsert the submission linking to the new file
      const submission = await tx.assignmentSubmission.upsert({
        where: { assignmentId_studentId: { assignmentId, studentId: user.userId } },
        create: {
          assignmentId,
          studentId: user.userId,
          driveLink: "",
          fileId: uploadedFile.id,
        },
        update: {
          fileId: uploadedFile.id,
          grade: null,
          feedback: null,
          gradedAt: null,
          submittedAt: new Date(),
        },
        include: {
          file: true,
        },
      });

      return submission;
    });

    return NextResponse.json({
      submission: {
        id:               result.id,
        assignmentId:     result.assignmentId,
        driveLink:        result.driveLink,
        fileUrl:          result.file?.url          ?? result.fileUrl,
        publicId:         result.file?.publicId     ?? result.publicId,
        fileType:         result.file?.extension    ?? result.fileType,
        mimeType:         result.file?.mimeType     ?? result.mimeType,
        fileSize:         result.file?.size         ?? result.fileSize,
        originalFileName: result.file?.originalName ?? result.originalFileName,
        grade:            result.grade,
        maxGrade:         result.maxGrade,
        feedback:         result.feedback,
        submittedAt:      result.submittedAt,
        gradedAt:         result.gradedAt,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/assignments/submit-file]", err);
    return NextResponse.json({ error: "Failed to save submission." }, { status: 500 });
  }
}

// ── DELETE /api/assignments/submit-file?submissionId=X ───────────────────────
export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const submissionId = req.nextUrl.searchParams.get("submissionId");
  if (!submissionId)
    return NextResponse.json({ error: "submissionId is required" }, { status: 400 });

  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      fileId: true,
      // legacy fallback
      publicId: true,
      fileType: true,
      file: { select: { id: true, publicId: true, resourceType: true, extension: true } },
    },
  });

  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  if (submission.studentId !== user.userId && user.role !== "INSTRUCTOR" && user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Resolve Cloudinary asset info from file relation or legacy fields
  const delPublicId =
    submission.file?.publicId ?? submission.publicId;
  const delResourceType =
    submission.file?.resourceType ??
    inferResourceType(submission.file?.extension ?? submission.fileType ?? "");

  // Step 1: Delete from Cloudinary
  if (delPublicId) {
    await destroyCloudinaryAsset(delPublicId, delResourceType);
  }

  // Step 2: Delete submission (cascade deletes UploadedFile via onDelete: Cascade)
  await prisma.assignmentSubmission.delete({ where: { id: submissionId } });

  return NextResponse.json({ ok: true });
}
