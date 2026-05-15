import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

/**
 * Returns the user ID and their role in a specific org (determined from the course).
 * Falls back to checking the org passed via query param.
 */
async function getAuthUserForCourse(courseId: string | null, orgIdParam?: string | null) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId as string;

    // Determine the org we're operating in
    let organizationId: string | null = null;
    if (courseId) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { organizationId: true, creatorId: true },
      });
      organizationId = course?.organizationId ?? null;
    } else if (orgIdParam) {
      organizationId = orgIdParam;
    }

    if (!organizationId) return null;

    // Find the user's membership in THIS specific org
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!membership) return null;

    return { userId, role: membership.role, orgId: organizationId };
  } catch {
    return null;
  }
}

/* ─── GET /api/admin/comments?courseId=&targetType=COURSE|STUDENT&studentId= ─ */
export async function GET(req: NextRequest) {
  const courseId   = req.nextUrl.searchParams.get("courseId");
  const targetType = req.nextUrl.searchParams.get("targetType") as "COURSE" | "STUDENT" | null;
  const studentId  = req.nextUrl.searchParams.get("studentId");

  if (!courseId || !targetType) {
    return NextResponse.json({ error: "courseId and targetType required" }, { status: 400 });
  }

  const auth = await getAuthUserForCourse(courseId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch the course to check creator
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { creatorId: true },
  });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  // Visibility rules (checked per-request, not just at write time):
  // COURSE comments → ADMIN or course instructor
  // STUDENT comments → ADMIN, course instructor, or the specific student
  const { role, userId } = auth;
  const isAdmin         = role === "ADMIN";
  const isInstructor    = role === "INSTRUCTOR" && course.creatorId === userId;
  const isTargetStudent = targetType === "STUDENT" && role === "STUDENT" && studentId === userId;

  if (!isAdmin && !isInstructor && !isTargetStudent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const where: Record<string, unknown> = { courseId, targetType };
    if (targetType === "STUDENT") {
      if (!studentId) return NextResponse.json({ error: "studentId required for STUDENT comments" }, { status: 400 });
      where.studentId = studentId;
    }

    const comments = await prisma.adminComment.findMany({
      where,
      include: {
        author:  { select: { id: true, name: true } },
        student: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ comments });
  } catch (err) {
    console.error("[GET /api/admin/comments]", err);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

/* ─── POST /api/admin/comments ─────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  let body: { courseId?: string; content?: string; targetType?: string; studentId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { courseId, content, targetType, studentId } = body;

  if (!courseId || !content?.trim() || !targetType) {
    return NextResponse.json({ error: "courseId, content, targetType required" }, { status: 400 });
  }

  const auth = await getAuthUserForCourse(courseId);
  if (!auth || auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden – Admins only" }, { status: 403 });
  }

  if (targetType === "STUDENT" && !studentId) {
    return NextResponse.json({ error: "studentId required for STUDENT comments" }, { status: 400 });
  }

  try {
    const comment = await prisma.adminComment.create({
      data: {
        content: content.trim(),
        courseId,
        authorId:   auth.userId,
        targetType,
        studentId: targetType === "STUDENT" ? studentId : null,
      },
      include: {
        author:  { select: { id: true, name: true } },
        student: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/comments]", err);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}

/* ─── DELETE /api/admin/comments?id=&courseId= ──────────────────────────────── */
export async function DELETE(req: NextRequest) {
  const id       = req.nextUrl.searchParams.get("id");
  const courseId = req.nextUrl.searchParams.get("courseId");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const auth = await getAuthUserForCourse(courseId);
  if (!auth || auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden – Admins only" }, { status: 403 });
  }

  try {
    const existing = await prisma.adminComment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    await prisma.adminComment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/comments]", err);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
