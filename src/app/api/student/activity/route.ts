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

/* ── POST /api/student/activity — log any learning activity ── */
export async function POST(req: NextRequest) {
  const studentId = await getStudentId();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { type?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, message } = body;

  const ALLOWED_TYPES = ["MODULE", "ASSIGNMENT", "COURSE", "QUIZ", "BADGE", "LIVE", "VIDEO", "MATERIAL"];
  if (!type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${ALLOWED_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  try {
    const notification = await prisma.notification.create({
      data: {
        userId: studentId,
        message: message.trim(),
        // Map VIDEO/MATERIAL to MODULE type so existing profile API handles it
        type: type === "VIDEO" || type === "MATERIAL" ? "MODULE" : type,
        isRead: false,
      },
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/student/activity]", err);
    return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
  }
}
