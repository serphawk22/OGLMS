import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";
import { inferResourceType } from "@/lib/file-utils";

export const runtime = "nodejs";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "secret");

async function getUser(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { userId: string; role: string };
  } catch {
    return null;
  }
}

// ── GET /api/reading-materials?courseId=X ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { organizationId: true },
    });
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: user.userId, organizationId: course.organizationId } },
      select: { role: true },
    });
    const isOrgStaff = membership && (membership.role === "INSTRUCTOR" || membership.role === "ADMIN");

    if (!isOrgStaff) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.userId, courseId } },
        select: { id: true },
      });
      if (!enrollment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const materials = await prisma.readingMaterial.findMany({
      where: { courseId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        link: true,
        courseId: true,
        createdAt: true,
        // Legacy fields (backward compat)
        fileUrl: true,
        originalFileName: true,
        publicId: true,
        fileType: true,
        mimeType: true,
        resourceType: true,
        fileSize: true,
        uploadedBy: true,
        // New normalized relation
        fileId: true,
        file: true,
      },
    });

    return NextResponse.json({ materials });
  } catch (err) {
    console.error("[GET /api/reading-materials]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ── DELETE /api/reading-materials?id=X&courseId=Y ────────────────────────────
export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "INSTRUCTOR" && user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id       = req.nextUrl.searchParams.get("id");
  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!id || !courseId)
    return NextResponse.json({ error: "id and courseId are required" }, { status: 400 });

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { organizationId: true },
    });
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: user.userId, organizationId: course.organizationId } },
      select: { role: true },
    });
    if (!membership || (membership.role !== "INSTRUCTOR" && membership.role !== "ADMIN"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Fetch material with normalized file relation + legacy fallback fields
    const material = await prisma.readingMaterial.findUnique({
      where: { id },
      select: {
        id: true,
        courseId: true,
        // Legacy fields
        publicId: true,
        resourceType: true,
        fileType: true,
        // New relation
        file: { select: { id: true, publicId: true, resourceType: true, extension: true } },
      },
    });
    if (!material) return NextResponse.json({ error: "Material not found" }, { status: 404 });
    if (material.courseId !== courseId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // ── Resolve Cloudinary deletion info ──────────────────────────────────────
    // Prefer normalized UploadedFile relation; fall back to legacy fields.
    const cloudinaryPublicId    = material.file?.publicId    ?? material.publicId;
    const cloudinaryResourceType =
      material.file?.resourceType ??
      material.resourceType ??
      inferResourceType(material.file?.extension ?? material.fileType ?? "");

    // ── Step 1: Delete from Cloudinary (non-fatal) ────────────────────────────
    if (cloudinaryPublicId) {
      try {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
        const destroyForm = new FormData();
        destroyForm.append("public_id", cloudinaryPublicId);
        destroyForm.append("invalidate", "true");

        await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/${cloudinaryResourceType}/destroy`,
          { method: "POST", body: destroyForm },
        );
        console.log(`[DELETE /api/reading-materials] Cloudinary destroyed: ${cloudinaryPublicId}`);
      } catch (cloudErr) {
        console.warn("[DELETE /api/reading-materials] Cloudinary cleanup failed (non-fatal):", cloudErr);
      }
    }

    // ── Step 2: Delete DB record (cascade deletes UploadedFile if linked) ─────
    await prisma.readingMaterial.delete({ where: { id } });
    console.log(`[DELETE /api/reading-materials] Deleted material id=${id} by user=${user.userId}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/reading-materials]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
