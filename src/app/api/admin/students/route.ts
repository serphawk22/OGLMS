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

/* GET /api/admin/students?orgId= */
export async function GET(req: NextRequest) {
  const orgIdParam = req.nextUrl.searchParams.get("orgId");
  const admin = orgIdParam ? await getAdminForOrg(orgIdParam) : await getAdminAnyOrg();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = orgIdParam || admin.orgId;
  try {
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: orgId, role: "STUDENT" },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { id: "desc" },
    });
    const students = members.map((m) => ({
      memberId: m.id, userId: m.user.id, name: m.user.name || "Unnamed", email: m.user.email,
    }));
    return NextResponse.json({ students });
  } catch (err) {
    console.error("[GET /api/admin/students]", err);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}

/* DELETE /api/admin/students  body: { memberId, orgId } */
export async function DELETE(req: NextRequest) {
  let body: { memberId?: string; orgId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { memberId, orgId: orgIdBody } = body;
  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

  const admin = orgIdBody ? await getAdminForOrg(orgIdBody) : await getAdminAnyOrg();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const member = await prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: admin.orgId, role: "STUDENT" },
    });
    if (!member) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    await prisma.organizationMember.delete({ where: { id: memberId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/students]", err);
    return NextResponse.json({ error: "Failed to remove student" }, { status: 500 });
  }
}
