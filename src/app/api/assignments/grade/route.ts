import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    return (payload.userId as string) ?? null;
  } catch {
    return null;
  }
}

// POST /api/assignments/grade
// Body: { submissionId, grade, feedback }
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { submissionId?: string; grade?: string | number; feedback?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { submissionId, grade, feedback } = body;

  if (!submissionId) {
    return NextResponse.json({ error: "submissionId is required." }, { status: 400 });
  }

  const gradeNum = parseInt(String(grade), 10);
  if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) {
    return NextResponse.json({ error: "Grade must be a number between 0 and 100." }, { status: 400 });
  }

  try {
    // Verify the assignment belongs to a course the user is the instructor of
    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: { course: { select: { creatorId: true } } },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    if (submission.assignment.course.creatorId !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const updated = await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        grade: gradeNum,
        feedback: (feedback as string)?.trim() || null,
        gradedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, submission: updated });
  } catch (err) {
    console.error("[POST /api/assignments/grade]", err);
    return NextResponse.json({ error: "Grading failed." }, { status: 500 });
  }
}
