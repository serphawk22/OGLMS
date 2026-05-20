import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";
import { validateFileMetadata } from "@/lib/validation";
import { getFileExtension, sanitizeFileName, detectMimeType } from "@/lib/file-utils";

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

/**
 * POST /api/reading-materials/upload
 *
 * Accepts JSON body (file was already uploaded browser → Cloudinary):
 * {
 *   courseId:       string
 *   title:          string
 *   url:            string   ← Cloudinary secure_url
 *   publicId:       string   ← Cloudinary public_id
 *   resourceType:   string   ← Cloudinary resource_type (image|video|raw)
 *   originalName:   string
 *   mimeType:       string
 *   size:           number
 * }
 *
 * Creates an UploadedFile record then a ReadingMaterial linked to it.
 * Auth: INSTRUCTOR or ADMIN of the course's organisation.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "INSTRUCTOR" && user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    courseId: string;
    title: string;
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

  const { courseId, title, url, publicId, resourceType, originalName, size } = body;
  const rawMime = body.mimeType ?? "";

  if (!courseId || !title?.trim() || !url || !publicId || !originalName) {
    return NextResponse.json(
      { error: "courseId, title, url, publicId, and originalName are required." },
      { status: 400 },
    );
  }

  // ── Normalize & validate ───────────────────────────────────────────────────
  const safeName = sanitizeFileName(originalName);
  const extension = getFileExtension(safeName);
  const mimeType  = detectMimeType(safeName, rawMime);

  const validationError = validateFileMetadata(size, safeName, mimeType);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // ── Verify org membership ──────────────────────────────────────────────────
  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { organizationId: true },
    });
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: user.userId, organizationId: course.organizationId } },
      select: { role: true },
    });
    if (!membership || (membership.role !== "INSTRUCTOR" && membership.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Forbidden. You must be an instructor or admin in this organisation." },
        { status: 403 },
      );
    }
  } catch (err) {
    console.error("[POST /api/reading-materials/upload] DB access check failed:", err);
    return NextResponse.json({ error: "Internal Server Error." }, { status: 500 });
  }

  // ── Create UploadedFile + ReadingMaterial in a transaction ─────────────────
  try {
    const material = await prisma.$transaction(async (tx) => {
      // 1. Create the normalised file record
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

      // 2. Create ReadingMaterial referencing the file
      return tx.readingMaterial.create({
        data: {
          title: title.trim(),
          courseId,
          fileId: uploadedFile.id,
          uploadedBy: user.userId,
        },
        include: { file: true },
      });
    });

    console.log(
      `[POST /api/reading-materials/upload] Created material id=${material.id} course=${courseId}`,
    );
    return NextResponse.json({ material }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/reading-materials/upload] DB create failed:", err);
    return NextResponse.json(
      { error: "File uploaded but failed to save record. Please contact support." },
      { status: 500 },
    );
  }
}
