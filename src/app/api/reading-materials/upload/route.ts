import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";

export const runtime = "nodejs";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "secret");

// ── Blocked file extensions (security) ───────────────────────────────────────

const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "sh", "msi", "dll", "ps1", "vbs",
  "jar", "com", "scr", "pif", "reg", "inf", "sys",
]);

const BLOCKED_MIME_PREFIXES = [
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\]/g, "")
    .replace(/[\x00-\x1f]/g, "")
    .replace(/[^a-zA-Z0-9.\-_ ]/g, "_")
    .slice(0, 200);
}

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

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

// ── POST /api/reading-materials/upload ───────────────────────────────────────
// Accepts multipart/form-data: file (File), title (string), courseId (string)
// Auth: INSTRUCTOR only.
// Uses lms_materials Cloudinary preset (separate from lms_recordings).
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "INSTRUCTOR" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim();
  const courseId = (formData.get("courseId") as string | null)?.trim();

  if (!file || !title || !courseId) {
    return NextResponse.json(
      { error: "file, title, and courseId are required" },
      { status: 400 }
    );
  }

  // ── File size validation ──────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum allowed size is 50 MB (received ${(file.size / 1024 / 1024).toFixed(1)} MB).` },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }

  // ── Extension + MIME validation ───────────────────────────────────────────
  const originalFileName = sanitizeFileName(file.name || "upload");
  const ext = getExtension(originalFileName);
  const mimeType = file.type || "application/octet-stream";

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: `File type ".${ext}" is not allowed for security reasons.` },
      { status: 400 }
    );
  }
  if (BLOCKED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    return NextResponse.json(
      { error: "This file type is not allowed for security reasons." },
      { status: 400 }
    );
  }

  // ── Verify instructor owns this course ────────────────────────────────────
  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { creatorId: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    if (course.creatorId !== user.userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  } catch (err) {
    console.error("[POST /api/reading-materials/upload] DB course lookup failed:", err);
    return NextResponse.json({ error: "Internal Server Error." }, { status: 500 });
  }

  // ── Upload to Cloudinary (lms_materials preset, resource_type: auto) ──────
  // Uses NEXT_PUBLIC_CLOUDINARY_MATERIALS_PRESET (lms_materials) — completely
  // separate from NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET (lms_recordings) which
  // is used exclusively by the live recording system. Do NOT mix them.
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_MATERIALS_PRESET;

  if (!cloudName || !uploadPreset) {
    console.error(
      "[POST /api/reading-materials/upload] Missing env vars: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_MATERIALS_PRESET"
    );
    return NextResponse.json(
      { error: "File storage is not configured. Please contact the administrator." },
      { status: 500 }
    );
  }

  let cloudinaryData: {
    secure_url: string;
    public_id: string;
    resource_type: string;
    bytes: number;
    format: string;
  };

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const blob = new Blob([buffer], { type: mimeType });

    const uploadForm = new FormData();
    uploadForm.append("file", blob, originalFileName);
    uploadForm.append("upload_preset", uploadPreset);
    // resource_type: "auto" — Cloudinary detects whether it's image/video/raw.
    // The folder is set in the lms_materials preset on Cloudinary dashboard.
    // We do NOT manually set folder here to let the preset control it.

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      { method: "POST", body: uploadForm }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error(
        `[POST /api/reading-materials/upload] Cloudinary error (${uploadRes.status}):`,
        errText
      );
      return NextResponse.json(
        { error: `Upload to storage failed (${uploadRes.status}). Please try again.` },
        { status: 502 }
      );
    }

    cloudinaryData = await uploadRes.json();

    if (!cloudinaryData.secure_url || !cloudinaryData.public_id) {
      throw new Error("Cloudinary response missing secure_url or public_id.");
    }

    console.log(
      `[POST /api/reading-materials/upload] Cloudinary upload OK: public_id=${cloudinaryData.public_id} resource_type=${cloudinaryData.resource_type}`
    );
  } catch (err) {
    console.error("[POST /api/reading-materials/upload] Cloudinary upload error:", err);
    return NextResponse.json(
      { error: "Failed to upload file to storage. Please try again." },
      { status: 502 }
    );
  }

  // ── Persist metadata in database ──────────────────────────────────────────
  try {
    const material = await prisma.readingMaterial.create({
      data: {
        title,
        courseId,
        link: undefined,                        // only used by old Google Drive records
        fileUrl: cloudinaryData.secure_url,
        originalFileName,
        publicId: cloudinaryData.public_id,
        fileType: ext || (cloudinaryData.format ?? ""),
        mimeType,
        // Store the actual resource_type Cloudinary used (image | video | raw)
        // so we can pass it back to Cloudinary's destroy endpoint on deletion.
        resourceType: cloudinaryData.resource_type,
        fileSize: file.size,
        uploadedBy: user.userId,
      },
    });

    console.log(
      `[POST /api/reading-materials/upload] Saved material id=${material.id} course=${courseId} instructor=${user.userId}`
    );
    return NextResponse.json({ material }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/reading-materials/upload] DB create failed:", err);
    return NextResponse.json(
      { error: "File uploaded but failed to save record. Please contact support." },
      { status: 500 }
    );
  }
}
