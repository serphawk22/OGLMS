import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

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

/* ── POST /api/student/enroll ── */
export async function POST(req: NextRequest) {
  const studentId = await getStudentId();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { courseId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { courseId } = body;
  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  try {
    // Verify course exists and is published
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, published: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    if (!course.published) {
      return NextResponse.json({ error: "Course is not published" }, { status: 403 });
    }

    // Check if already enrolled
    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: studentId, courseId } },
    });

    if (existing) {
      return NextResponse.json({ message: "Already enrolled", enrollment: existing });
    }

    // Create enrollment
    const enrollment = await prisma.enrollment.create({
      data: { userId: studentId, courseId, progress: 0 },
    });

    // Log enrollment as notification activity (feeds streak + recent activity)
    await prisma.notification.create({
      data: {
        userId: studentId,
        message: `Enrolled in "${course.title}"`,
        type: "COURSE",
        isRead: false,
      },
    });

    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/student/enroll]", err);
    return NextResponse.json({ error: "Failed to enroll" }, { status: 500 });
  }
}
