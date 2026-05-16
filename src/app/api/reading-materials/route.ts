import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";

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
// Returns all reading materials for a course.
// Auth: course creator (instructor) OR enrolled student.
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  try {
    // Verify access: must be instructor (course creator) or enrolled student
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { creatorId: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const isInstructor = course.creatorId === user.userId;
    if (!isInstructor) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.userId, courseId } },
        select: { id: true },
      });
      if (!enrollment) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const materials = await prisma.readingMaterial.findMany({
      where: { courseId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        link: true,
        fileUrl: true,
        originalFileName: true,
        publicId: true,
        fileType: true,
        mimeType: true,
        resourceType: true,
        fileSize: true,
        uploadedBy: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ materials });
  } catch (err) {
    console.error("[GET /api/reading-materials]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ── DELETE /api/reading-materials?id=X&courseId=Y ────────────────────────────
// Deletes DB record + Cloudinary asset (if publicId present).
// Auth: INSTRUCTOR only (must own the course).
export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "INSTRUCTOR" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!id || !courseId) {
    return NextResponse.json({ error: "id and courseId are required" }, { status: 400 });
  }

  try {
    // Verify instructor owns this course
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { creatorId: true },
    });
    if (!course || course.creatorId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch the material to get publicId + resourceType before deletion
    const material = await prisma.readingMaterial.findUnique({
      where: { id },
      select: { id: true, publicId: true, resourceType: true, courseId: true },
    });
    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }
    if (material.courseId !== courseId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Step 1: Delete from Cloudinary (non-fatal if it fails) ──────────────
    if (material.publicId) {
      try {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
        // Use the materials preset — NOT the recordings preset (lms_recordings).
        const materialsPreset = process.env.NEXT_PUBLIC_CLOUDINARY_MATERIALS_PRESET!;
        // Use the actual resource_type stored at upload time (image | video | raw).
        // Cloudinary requires the correct resource_type on the destroy endpoint.
        const resourceType = material.resourceType ?? "raw";

        const destroyForm = new FormData();
        destroyForm.append("public_id", material.publicId);
        destroyForm.append("upload_preset", materialsPreset);
        destroyForm.append("invalidate", "true");

        const destroyRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
          { method: "POST", body: destroyForm }
        );
        const destroyData = await destroyRes.json();
        console.log(
          `[DELETE /api/reading-materials] Cloudinary destroy result for ${material.publicId}:`,
          destroyData
        );
      } catch (cloudErr) {
        // Non-fatal: DB record is still deleted. Log and continue.
        console.warn(
          "[DELETE /api/reading-materials] Cloudinary cleanup failed (non-fatal):",
          cloudErr
        );
      }
    }

    // ── Step 2: Delete from database ────────────────────────────────────────
    await prisma.readingMaterial.delete({ where: { id } });

    console.log(
      `[DELETE /api/reading-materials] Deleted material id=${id} by instructor=${user.userId}`
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/reading-materials]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
