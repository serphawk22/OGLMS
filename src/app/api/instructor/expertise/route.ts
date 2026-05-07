import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

async function getInstructorId(): Promise<string | null> {
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

/* ── PATCH /api/instructor/expertise — update expertise list ── */
export async function PATCH(req: NextRequest) {
  const userId = await getInstructorId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { expertise?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { expertise } = body;
  if (!Array.isArray(expertise)) {
    return NextResponse.json({ error: "expertise must be an array of strings" }, { status: 400 });
  }

  // Sanitize: remove empty strings, trim each, deduplicate, max 15 skills
  const cleaned = [...new Set(expertise.map((s) => s.trim()).filter(Boolean))].slice(0, 15);

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { expertise: cleaned },
      select: { id: true, expertise: true },
    });

    return NextResponse.json({ expertise: updated.expertise });
  } catch (err) {
    console.error("[PATCH /api/instructor/expertise]", err);
    return NextResponse.json({ error: "Failed to update expertise" }, { status: 500 });
  }
}
