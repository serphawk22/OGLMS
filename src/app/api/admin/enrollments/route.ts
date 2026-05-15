import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

async function getAdminForOrg(orgId: string) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId as string;
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    if (!membership || membership.role !== "ADMIN") return null;
    return { userId, orgId };
  } catch { return null; }
}

async function getAdminAnyOrg() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId as string;
    const membership = await prisma.organizationMember.findFirst({ where: { userId, role: "ADMIN" } });
    if (!membership) return null;
    return { userId, orgId: membership.organizationId };
  } catch { return null; }
}

/* GET /api/admin/enrollments?orgId= */
export async function GET(req: NextRequest) {
  const orgIdParam = req.nextUrl.searchParams.get("orgId");
  const admin = orgIdParam ? await getAdminForOrg(orgIdParam) : await getAdminAnyOrg();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = orgIdParam || admin.orgId;
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { course: { organizationId: orgId } },
      include: {
        user:   { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { id: "desc" },
      take: 200,
    });

    const result = enrollments.map((e) => ({
      id:           e.id,
      studentName:  e.user.name || "Unnamed",
      studentEmail: e.user.email,
      courseTitle:  e.course.title,
      courseId:     e.course.id,
      progress:     e.progress,
    }));

    return NextResponse.json({ enrollments: result });
  } catch (err) {
    console.error("[GET /api/admin/enrollments]", err);
    return NextResponse.json({ error: "Failed to fetch enrollments" }, { status: 500 });
  }
}
