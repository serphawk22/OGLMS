import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

async function getUser(): Promise<{ userId: string; role: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId as string;
    const role   = payload.role   as string;
    if (!userId) return null;
    return { userId, role };
  } catch {
    return null;
  }
}

// ── POST /api/assignments/submit-file ─────────────────────────────────────────
// Body: { assignmentId, fileUrl, publicId, fileType, mimeType, fileSize, originalFileName }
// Called by student AFTER the file has been uploaded to Cloudinary client-side.
export async function POST(req: NextRequest) {
  const currentUser = await getUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const studentId = currentUser.userId;

  let body: {
    assignmentId?: string;
    fileUrl?: string;
    publicId?: string;
    fileType?: string;
    mimeType?: string;
    fileSize?: number;
    originalFileName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { assignmentId, fileUrl, publicId, fileType, mimeType, fileSize, originalFileName } = body;

  if (!assignmentId || !fileUrl?.trim()) {
    return NextResponse.json(
      { error: "assignmentId and fileUrl are required." },
      { status: 400 }
    );
  }

  try {
    // Upsert — student can resubmit (clears grade/feedback on resubmit)
    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      update: {
        driveLink: "",              // new uploads don't use driveLink
        fileUrl: fileUrl.trim(),
        publicId: publicId ?? null,
        fileType: fileType ?? null,
        mimeType: mimeType ?? null,
        fileSize: fileSize ?? null,
        originalFileName: originalFileName ?? null,
        grade: null,
        feedback: null,
        gradedAt: null,
        submittedAt: new Date(),
      },
      create: {
        assignmentId,
        studentId,
        driveLink: "",
        fileUrl: fileUrl.trim(),
        publicId: publicId ?? null,
        fileType: fileType ?? null,
        mimeType: mimeType ?? null,
        fileSize: fileSize ?? null,
        originalFileName: originalFileName ?? null,
      },
    });

    // Log activity → feeds streak + recent activity on student profile
    await createNotification({
      userId: studentId,
      message: "You submitted an assignment.",
      type: "ASSIGNMENT",
    });

    return NextResponse.json({ success: true, submission });
  } catch (err) {
    console.error("[POST /api/assignments/submit-file]", err);
    return NextResponse.json({ error: "Submission failed." }, { status: 500 });
  }
}

// ── DELETE /api/assignments/submit-file ───────────────────────────────────────
// Body: { submissionId }
// Deletes the Cloudinary asset (if any) and then removes the DB record.
// Only the owning student or the course instructor may delete.
export async function DELETE(req: NextRequest) {
  const currentUser = await getUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId, role } = currentUser;

  let body: { submissionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { submissionId } = body;
  if (!submissionId) {
    return NextResponse.json({ error: "submissionId is required." }, { status: 400 });
  }

  try {
    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: { include: { course: { select: { creatorId: true } } } },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    // Allow: student who submitted, course instructor, or ADMIN
    const isOwner      = submission.studentId === userId;
    const isAdmin      = role === "ADMIN";
    const isInstructor = submission.assignment.course.creatorId === userId;
    if (!isOwner && !isAdmin && !isInstructor) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    await prisma.assignmentSubmission.delete({ where: { id: submissionId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/assignments/submit-file]", err);
    return NextResponse.json({ error: "Deletion failed." }, { status: 500 });
  }
}
