import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createNotification } from "@/lib/notifications";

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

// POST /api/assignments/submit
export async function POST(req: NextRequest) {
  const studentId = await getUserId();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { assignmentId?: string; driveLink?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { assignmentId, driveLink } = body;

  if (!assignmentId || !driveLink?.trim()) {
    return NextResponse.json(
      { error: "assignmentId and driveLink are required." },
      { status: 400 }
    );
  }

  // Basic URL validation
  try {
    new URL(driveLink);
  } catch {
    return NextResponse.json({ error: "Please provide a valid URL." }, { status: 400 });
  }

  try {
    // Upsert — student can resubmit (clears grade/feedback on resubmit)
    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      update: {
        driveLink: driveLink.trim(),
        grade: null,
        feedback: null,
        gradedAt: null,
        submittedAt: new Date(),
      },
      create: {
        assignmentId,
        studentId,
        driveLink: driveLink.trim(),
      },
    });

    // Log activity → feeds streak + recent activity on student profile
    await createNotification({
      userId: studentId,
      message: "You submitted an assignment.",
      type: "ASSIGNMENT",
    });

    return NextResponse.json({ success: true, submission });
  } catch (err) {
    console.error("[POST /api/assignments/submit]", err);
    return NextResponse.json({ error: "Submission failed." }, { status: 500 });
  }
}
