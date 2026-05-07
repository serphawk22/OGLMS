import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { sendLiveClassEmail } from "@/lib/mail";
import { notifyEnrolledStudents } from "@/lib/notifications";

export const runtime = "nodejs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

async function getInstructor() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role as string;
    if (role !== "INSTRUCTOR" && role !== "ADMIN") return null;
    return payload as { userId: string; role: string; organizationId: string };
  } catch {
    return null;
  }
}

// POST /api/instructor/meets  — create a new live session
// Body: { courseId: string, title: string, scheduledAt?: string (ISO) }
export async function POST(req: NextRequest) {
  const instructor = await getInstructor();
  if (!instructor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { courseId, title, scheduledAt: scheduledAtRaw } = await req.json();
    if (!courseId || !title) {
      return NextResponse.json({ error: "courseId and title are required" }, { status: 400 });
    }

    // Verify the course belongs to this instructor's org
    const course = await prisma.course.findFirst({
      where: { id: courseId, organizationId: instructor.organizationId },
      include: { creator: { select: { name: true } } },
    });
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    // Parse scheduledAt — default to now
    const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : new Date();

    // Generate a short unique roomId
    const roomId = randomBytes(8).toString("hex");

    const session = await prisma.liveSession.create({
      data: { roomId, title, courseId, status: "SCHEDULED", scheduledAt },
    });

    // ── Notifications (email + in-app) ─────────────────────────────────────
    // Non-fatal: errors are caught and logged; the 201 response always goes out
    try {
      // Collect student emails: enrolled first, fallback to org members
      let studentEmails: string[] = [];
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId },
        include: { user: { select: { email: true } } },
      });

      if (enrollments.length > 0) {
        studentEmails = enrollments.map((e) => e.user.email);
      } else {
        const orgMembers = await prisma.organizationMember.findMany({
          where: { organizationId: instructor.organizationId, role: "STUDENT" },
          include: { user: { select: { email: true } } },
        });
        studentEmails = orgMembers.map((m) => m.user.email);
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const joinLink = `${appUrl}/meet/${roomId}`;
      const instructorName = course.creator?.name || "Your Instructor";

      if (studentEmails.length > 0) {
        await sendLiveClassEmail({
          to: studentEmails,
          courseName: course.title,
          sessionTitle: title,
          scheduledAt,
          instructorName,
          joinLink,
        });
        console.log(
          `[POST /api/instructor/meets] Email sent to ${studentEmails.length} student(s) for "${title}"`
        );

        await notifyEnrolledStudents({
          courseId,
          message: `Live class "${title}" scheduled for ${course.title}. Join at: ${joinLink}`,
          type: "COURSE",
        });
      } else {
        console.log("[POST /api/instructor/meets] No students found to notify.");
      }
    } catch (notifErr) {
      console.error("[POST /api/instructor/meets] Notification step failed (non-fatal):", notifErr);
    }
    // ───────────────────────────────────────────────────────────────────────

    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/instructor/meets]", err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

// GET /api/instructor/meets?courseId=xxx  — list all sessions for a course
export async function GET(req: NextRequest) {
  const instructor = await getInstructor();
  if (!instructor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

  try {
    const sessions = await prisma.liveSession.findMany({
      where: { courseId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("[GET /api/instructor/meets]", err);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

// PATCH /api/instructor/meets  — update session status or recordingUrl
// Body: { sessionId: string, status?: string, recordingUrl?: string }
export async function PATCH(req: NextRequest) {
  const instructor = await getInstructor();
  if (!instructor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { sessionId, status, recordingUrl } = await req.json();
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const updated = await prisma.liveSession.update({
      where: { id: sessionId },
      data: {
        ...(status && { status }),
        ...(recordingUrl && { recordingUrl }),
      },
    });
    return NextResponse.json({ session: updated });
  } catch (err) {
    console.error("[PATCH /api/instructor/meets]", err);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}
