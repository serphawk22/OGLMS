import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "default_secret"
);

async function getStudentId(): Promise<string | null> {
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

export interface RecommendedCourse {
  id: string;
  title: string;
  description: string | null;
  enrollmentCount: number;
  reason: string;
}

export interface RecommendationsResponse {
  recommendedNext: RecommendedCourse | null;
  nearlyComplete: { id: string; title: string; progress: number } | null;
  lowScoreCourse: { id: string; title: string; avgScore: number } | null;
}

/* ── GET /api/recommendations ─────────────────────────────────────────── */
export async function GET() {
  const studentId = await getStudentId();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch student's org (first membership)
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      include: { memberships: { include: { organization: true }, take: 1 } },
    });

    if (!user || user.memberships.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const orgId = user.memberships[0].organizationId;

    // 2. Fetch all enrollments for this student (with progress)
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: studentId },
      select: { courseId: true, progress: true },
    });

    const enrolledCourseIds = enrollments.map((e) => e.courseId);

    // 3. Find the enrollment nearest to completion (for "nearly complete" hint)
    const nearlyCompleteEnrollment = enrollments
      .filter((e) => e.progress >= 80 && e.progress < 100)
      .sort((a, b) => b.progress - a.progress)[0] ?? null;

    let nearlyComplete: RecommendationsResponse["nearlyComplete"] = null;
    if (nearlyCompleteEnrollment) {
      const course = await prisma.course.findUnique({
        where: { id: nearlyCompleteEnrollment.courseId },
        select: { id: true, title: true },
      });
      if (course) {
        nearlyComplete = {
          id: course.id,
          title: course.title,
          progress: nearlyCompleteEnrollment.progress,
        };
      }
    }

    // 4. Find lowest quiz-score course (avg score across all quizzes in enrolled courses)
    let lowScoreCourse: RecommendationsResponse["lowScoreCourse"] = null;
    if (enrolledCourseIds.length > 0) {
      const quizSubmissions = await prisma.quizSubmission.findMany({
        where: { studentId },
        select: {
          obtainedMarks: true,
          totalMarks: true,
          quiz: { select: { courseId: true } },
        },
      });

      // Group by courseId and calculate avg score percentage
      const courseScores: Record<string, { obtained: number; total: number; count: number }> = {};
      for (const sub of quizSubmissions) {
        const cId = sub.quiz.courseId;
        if (!courseScores[cId]) courseScores[cId] = { obtained: 0, total: 0, count: 0 };
        courseScores[cId].obtained += sub.obtainedMarks;
        courseScores[cId].total += sub.totalMarks;
        courseScores[cId].count += 1;
      }

      // Find course with avg < 60%
      let worstCourseId: string | null = null;
      let worstAvg = 100;
      for (const [cId, scores] of Object.entries(courseScores)) {
        if (scores.total === 0) continue;
        const avg = (scores.obtained / scores.total) * 100;
        if (avg < 60 && avg < worstAvg) {
          worstAvg = avg;
          worstCourseId = cId;
        }
      }

      if (worstCourseId) {
        const course = await prisma.course.findUnique({
          where: { id: worstCourseId },
          select: { id: true, title: true },
        });
        if (course) {
          lowScoreCourse = { id: course.id, title: course.title, avgScore: Math.round(worstAvg) };
        }
      }
    }

    // 5. Find the best "next course" recommendation:
    //    Published courses NOT yet enrolled → sort by total enrollment count (popularity)
    const unenrolledCourses = await prisma.course.findMany({
      where: {
        organizationId: orgId,
        published: true,
        id: { notIn: enrolledCourseIds.length > 0 ? enrolledCourseIds : ["__none__"] },
      },
      select: {
        id: true,
        title: true,
        description: true,
        enrollments: { select: { id: true } }, // for counting
      },
    });

    // Sort by enrollment count descending (most popular first)
    const sorted = unenrolledCourses
      .map((c) => ({ ...c, enrollmentCount: c.enrollments.length }))
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount);

    let recommendedNext: RecommendedCourse | null = null;
    if (sorted.length > 0) {
      const top = sorted[0];

      // Build a reason string
      let reason = "Popular among your peers";
      if (nearlyComplete) {
        reason = `You're ${Math.round(nearlyComplete.progress)}% through ${nearlyComplete.title} — this could be your next step`;
      } else if (enrolledCourseIds.length === 0) {
        reason = "Get started with your first course";
      } else if (top.enrollmentCount > 0) {
        reason = `${top.enrollmentCount} student${top.enrollmentCount !== 1 ? "s" : ""} enrolled — highly recommended`;
      }

      recommendedNext = {
        id: top.id,
        title: top.title,
        description: top.description,
        enrollmentCount: top.enrollmentCount,
        reason,
      };
    }

    const response: RecommendationsResponse = {
      recommendedNext,
      nearlyComplete,
      lowScoreCourse,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/recommendations]", err);
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }
}
