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

// GET /api/quiz/[quizId]/submission
// Returns the logged-in student's submission for a specific quiz, or null
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const studentId = await getUserId();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quizId } = await params;

  try {
    const submission = await prisma.quizSubmission.findUnique({
      where: { quizId_studentId: { quizId, studentId } },
      select: {
        id: true,
        obtainedMarks: true,
        totalMarks: true,
        answers: true,
        submittedAt: true,
      },
    });

    return NextResponse.json({ submission: submission ?? null });
  } catch (err) {
    console.error("[GET /api/quiz/[quizId]/submission]", err);
    return NextResponse.json({ error: "Failed to fetch submission." }, { status: 500 });
  }
}
