import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";

export const runtime = "nodejs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "secret");

async function getUser(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId: string; role: string };
  } catch {
    return null;
  }
}

// ── POST /api/recordings ─────────────────────────────────────────────────────
// Body: { courseId, title, videoUrl, duration? }
// Auth: INSTRUCTOR only
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "INSTRUCTOR" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { courseId, title, videoUrl, duration, moduleId } = await req.json();

    if (!courseId || !title || !videoUrl) {
      return NextResponse.json(
        { error: "courseId, title, and videoUrl are required" },
        { status: 400 }
      );
    }

    // Verify instructor owns this course
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { creatorId: true },
    });
    if (!course || course.creatorId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const recording = await prisma.recordedClass.create({
      data: {
        courseId,
        instructorId: user.userId,
        title,
        videoUrl,
        duration: duration ?? null,
        ...(moduleId ? { moduleId } : {}),
      },
    });

    return NextResponse.json({ recording }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/recordings]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ── GET /api/recordings?courseId=xxx ─────────────────────────────────────────
// Auth: instructor (course creator) OR enrolled student
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  try {
    // Check access: must be course creator or enrolled student
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { creatorId: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const isInstructor = course.creatorId === user.userId;
    if (!isInstructor) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.userId, courseId } },
        select: { id: true },
      });
      if (!enrollment) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const recordings = await prisma.recordedClass.findMany({
      where: { courseId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        videoUrl: true,
        duration: true,
        createdAt: true,
        instructor: { select: { name: true } },
      },
    });

    return NextResponse.json({ recordings });
  } catch (err) {
    console.error("[GET /api/recordings]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
