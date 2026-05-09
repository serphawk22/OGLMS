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

// POST /api/quiz/submit
// Body: { quizId: string, answers: { [questionId]: number | string } }
export async function POST(req: NextRequest) {
  const studentId = await getUserId();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { quizId?: string; answers?: Record<string, number | string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { quizId, answers } = body;

  if (!quizId || !answers || typeof answers !== "object") {
    return NextResponse.json(
      { error: "quizId and answers are required." },
      { status: 400 }
    );
  }

  try {
    // Fetch quiz with questions and retryEnabled flag
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: true },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    }

    // Check if already submitted and retry is not enabled
    const existing = await prisma.quizSubmission.findUnique({
      where: { quizId_studentId: { quizId, studentId } },
    });

    if (existing && !quiz.retryEnabled) {
      return NextResponse.json(
        {
          error: "You have already submitted this quiz.",
          submission: existing,
        },
        { status: 409 }
      );
    }

    // Grade the quiz server-side
    // MCQ: compare answers[q.id] (number) to q.correctOption
    // ESSAY: no correct answer — 0 points (kept for display)
    let obtainedMarks = 0;
    let totalMarks = 0;

    for (const question of quiz.questions) {
      if (question.type === "MCQ" && question.correctOption !== null) {
        totalMarks += question.points;
        const studentAnswer = answers[question.id];
        if (
          studentAnswer !== undefined &&
          typeof studentAnswer === "number" &&
          studentAnswer === question.correctOption
        ) {
          obtainedMarks += question.points;
        }
      }
      // ESSAY questions are included in the quiz but not auto-graded
      // They count as 0 toward totalMarks (no correctOption)
    }

    // Save or update the submission
    const submission = await prisma.quizSubmission.upsert({
      where: { quizId_studentId: { quizId, studentId } },
      update: {
        answers: answers as Record<string, number | string>,
        obtainedMarks,
        totalMarks,
        submittedAt: new Date(),
      },
      create: {
        quizId,
        studentId,
        answers: answers as Record<string, number | string>,
        obtainedMarks,
        totalMarks,
      },
    });

    return NextResponse.json({ success: true, submission, obtainedMarks, totalMarks });
  } catch (err) {
    console.error("[POST /api/quiz/submit]", err);
    return NextResponse.json({ error: "Submission failed." }, { status: 500 });
  }
}
