import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "secret");

async function getStudentId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, SECRET);
    return (payload.userId as string) ?? null;
  } catch {
    return null;
  }
}

// POST /api/material-views — called by student when they open a reading material
export async function POST(req: NextRequest) {
  const studentId = await getStudentId();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { materialId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { materialId } = body;
  if (!materialId) {
    return NextResponse.json({ error: "materialId required" }, { status: 400 });
  }

  try {
    // Upsert: one record per student+material, increment opens counter
    await prisma.materialView.upsert({
      where: { materialId_studentId: { materialId, studentId } },
      create: { materialId, studentId, viewCount: 1 },
      update: {
        viewCount: { increment: 1 },
        viewedAt: new Date(),
      },
    });
    console.log(`[POST /api/material-views] Tracked view: student=${studentId} material=${materialId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/material-views] Failed to track view:", err);
    return NextResponse.json({ ok: false });
  }
}

// GET /api/material-views?materialId=X&courseId=Y — instructor analytics
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const materialId = searchParams.get("materialId");
  const courseId = searchParams.get("courseId");

  if (!materialId || !courseId) {
    return NextResponse.json({ error: "materialId and courseId required" }, { status: 400 });
  }

  // ── Step 1: always fetch enrolled students — never skip this ─────────────
  let enrollments: {
    userId: string;
    user: { id: string; name: string | null; email: string };
  }[] = [];
  try {
    enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { id: "asc" },
    });
  } catch (err) {
    console.error("[GET /api/material-views] Enrollment query failed:", err);
    return NextResponse.json({ analytics: [] });
  }

  // ── Step 2: fetch view records — degrade gracefully if table missing ──────
  const viewMap = new Map<string, { viewedAt: Date; viewCount: number }>();
  try {
    const views = await prisma.materialView.findMany({
      where: { materialId },
      select: { studentId: true, viewedAt: true, viewCount: true },
    });
    for (const v of views) viewMap.set(v.studentId, v);
  } catch (err) {
    console.error("[GET /api/material-views] MaterialView query failed:", err);
    // Continue with empty viewMap so enrolled students still show up
  }

  // ── Step 3: merge enrollments with view data ──────────────────────────────
  const result = enrollments.map((enr) => {
    const view = viewMap.get(enr.userId);
    return {
      studentId: enr.userId,
      name: enr.user.name ?? "—",
      email: enr.user.email,
      viewed: !!view,
      viewedAt: view?.viewedAt?.toISOString() ?? null,
      viewCount: view?.viewCount ?? 0,
    };
  });

  return NextResponse.json({ analytics: result });
}
