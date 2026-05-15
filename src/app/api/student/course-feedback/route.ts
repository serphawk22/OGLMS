import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

/**
 * GET /api/student/course-feedback?courseId=
 *
 * Returns AdminComments of type STUDENT for the currently logged-in student.
 * Optionally scoped to a courseId; if no courseId, returns all across enrolled courses.
 */
export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get("courseId");

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { payload } = await jwtVerify(token, secret);
    const studentId = payload.userId as string;

    // Build query — always scoped to this student
    const where: Record<string, unknown> = {
      targetType: "STUDENT",
      studentId,
    };
    if (courseId) where.courseId = courseId;

    const comments = await prisma.adminComment.findMany({
      where,
      include: {
        author: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ comments });
  } catch (err) {
    console.error("[GET /api/student/course-feedback]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
