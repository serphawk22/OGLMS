import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

// GET /api/student/meets — returns scheduled/ongoing sessions for all enrolled courses
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secret);
    userId = payload.userId as string;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get only the courses this student is enrolled in
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      select: { courseId: true },
    });
    const courseIds = enrollments.map((e) => e.courseId);

    if (courseIds.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    const sessions = await prisma.liveSession.findMany({
      where: {
        courseId: { in: courseIds },
        status: { in: ["SCHEDULED", "ONGOING"] },
      },
      include: {
        course: { select: { title: true } },
      },
      // Show soonest sessions first
      orderBy: { scheduledAt: "asc" },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Enrich each session with a computed joinLink derived from roomId
    const enriched = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      roomId: s.roomId,
      scheduledAt: s.scheduledAt,
      courseId: s.courseId,
      courseTitle: s.course.title,
      joinLink: `${appUrl}/meet/${s.roomId}`,
    }));

    return NextResponse.json({ sessions: enriched });
  } catch (err) {
    console.error("[GET /api/student/meets]", err);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}
