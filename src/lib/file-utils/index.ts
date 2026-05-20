/**
 * @file src/lib/file-utils/index.ts
 * Centralized file utility functions used across the LMS for uploads,
 * previews, icons, and Cloudinary resource management.
 */

import {
  FileText, File, Image as ImageIcon, Archive,
  Code, BarChart2, FileSpreadsheet, Music, Video,
  type LucideIcon,
} from "lucide-react";

// ─── Extension extraction ──────────────────────────────────────────────────────

/**
 * Safely extracts a lowercase, trimmed file extension.
 * Handles multiple dots, uppercase, spaces.
 * e.g. "report.final.PDF" → "pdf", "photo.JPG " → "jpg"
 */
export function getFileExtension(fileName: string): string {
  if (!fileName || typeof fileName !== "string") return "";
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot === -1 || lastDot === trimmed.length - 1) return "";
  return trimmed.slice(lastDot + 1).toLowerCase().trim();
}

// ─── MIME type detection / fallback ───────────────────────────────────────────

const EXT_TO_MIME: Record<string, string> = {
  // Documents
  pdf:  "application/pdf",
  doc:  "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt:  "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls:  "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt:  "application/vnd.oasis.opendocument.text",
  ods:  "application/vnd.oasis.opendocument.spreadsheet",
  odp:  "application/vnd.oasis.opendocument.presentation",
  // Text / Code
  txt:  "text/plain",
  csv:  "text/csv",
  xml:  "application/xml",
  json: "application/json",
  md:   "text/markdown",
  html: "text/html",
  htm:  "text/html",
  css:  "text/css",
  js:   "text/javascript",
  ts:   "text/typescript",
  jsx:  "text/jsx",
  tsx:  "text/tsx",
  py:   "text/x-python",
  java: "text/x-java-source",
  c:    "text/x-c",
  cpp:  "text/x-c++",
  cs:   "text/x-csharp",
  php:  "text/x-php",
  rb:   "text/x-ruby",
  go:   "text/x-go",
  rs:   "text/x-rust",
  sh:   "text/x-shellscript",
  sql:  "text/x-sql",
  yaml: "text/yaml",
  yml:  "text/yaml",
  log:  "text/plain",
  // Images
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  gif:  "image/gif",
  webp: "image/webp",
  svg:  "image/svg+xml",
  bmp:  "image/bmp",
  ico:  "image/x-icon",
  tiff: "image/tiff",
  // Archives
  zip:  "application/zip",
  rar:  "application/x-rar-compressed",
  "7z": "application/x-7z-compressed",
  tar:  "application/x-tar",
  gz:   "application/gzip",
  // Audio / Video
  mp4:  "video/mp4",
  webm: "video/webm",
  mp3:  "audio/mpeg",
  wav:  "audio/wav",
};

/**
 * Returns the MIME type for a file.
 * Falls back to extension-based detection if the supplied mimeType is missing
 * or is the generic "application/octet-stream".
 */
export function detectMimeType(fileName: string, mimeType?: string | null): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const ext = getFileExtension(fileName);
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
}

// ─── File category ─────────────────────────────────────────────────────────────

export type FileCategory =
  | "pdf"
  | "image"
  | "office"
  | "spreadsheet"
  | "code"
  | "zip"
  | "text"
  | "video"
  | "audio"
  | "unsupported";

const PDF_EXTS        = new Set(["pdf"]);
const IMAGE_EXTS      = new Set(["png","jpg","jpeg","gif","webp","svg","bmp","ico","tiff"]);
const OFFICE_EXTS     = new Set(["doc","docx","ppt","pptx","odt","odp"]);
const SPREADSHEET_EXTS= new Set(["xls","xlsx","ods","csv"]);
const CODE_EXTS       = new Set([
  "js","ts","jsx","tsx","py","java","c","cpp","cs","php","rb","go","rs",
  "sh","html","htm","css","sql","yaml","yml","json","xml","md","log",
]);
const TEXT_EXTS       = new Set(["txt"]);
const ZIP_EXTS        = new Set(["zip","rar","7z","tar","gz"]);
const VIDEO_EXTS      = new Set(["mp4","webm","mkv","avi","mov"]);
const AUDIO_EXTS      = new Set(["mp3","wav","ogg","flac","aac"]);

/**
 * Returns a semantic category for a file based on its extension / MIME type.
 */
export function getFileCategory(
  fileName: string,
  mimeType?: string | null,
): FileCategory {
  const ext  = getFileExtension(fileName);
  const mime = detectMimeType(fileName, mimeType);

  if (PDF_EXTS.has(ext)         || mime === "application/pdf")           return "pdf";
  if (IMAGE_EXTS.has(ext)       || mime.startsWith("image/"))            return "image";
  if (SPREADSHEET_EXTS.has(ext) || mime.includes("spreadsheet") || mime.includes("excel") || ext === "csv") return "spreadsheet";
  if (OFFICE_EXTS.has(ext)      || mime.includes("wordprocessingml") || mime.includes("presentationml") || mime.includes("msword") || mime.includes("powerpoint")) return "office";
  if (CODE_EXTS.has(ext)        || mime.startsWith("text/") || mime === "application/json" || mime === "application/xml") return "code";
  if (TEXT_EXTS.has(ext))                                                  return "text";
  if (ZIP_EXTS.has(ext)         || mime.includes("zip") || mime.includes("rar") || mime.includes("7z") || mime.includes("tar")) return "zip";
  if (VIDEO_EXTS.has(ext)       || mime.startsWith("video/"))            return "video";
  if (AUDIO_EXTS.has(ext)       || mime.startsWith("audio/"))            return "audio";
  return "unsupported";
}

// ─── File icon mapping ─────────────────────────────────────────────────────────

export interface FileIconInfo {
  Icon: LucideIcon;
  color: string;   // Tailwind text-* class
  bg: string;      // Tailwind bg-* + border-* classes
}

/**
 * Returns a Lucide icon + Tailwind color classes suited to the file type.
 */
export function getFileIcon(
  fileName: string,
  mimeType?: string | null,
): FileIconInfo {
  const category = getFileCategory(fileName, mimeType);
  const ext      = getFileExtension(fileName);

  switch (category) {
    case "pdf":
      return { Icon: FileText,        color: "text-red-500",    bg: "bg-red-50 border-red-100"     };
    case "image":
      return { Icon: ImageIcon,        color: "text-purple-500", bg: "bg-purple-50 border-purple-100" };
    case "spreadsheet":
      return { Icon: FileSpreadsheet,  color: "text-green-600",  bg: "bg-green-50 border-green-100" };
    case "office":
      if (["ppt","pptx","odp"].includes(ext))
        return { Icon: BarChart2,      color: "text-orange-500", bg: "bg-orange-50 border-orange-100" };
      return { Icon: FileText,         color: "text-blue-500",   bg: "bg-blue-50 border-blue-100"   };
    case "code":
      return { Icon: Code,             color: "text-slate-500",  bg: "bg-slate-50 border-slate-200" };
    case "text":
      return { Icon: FileText,         color: "text-slate-400",  bg: "bg-slate-50 border-slate-200" };
    case "zip":
      return { Icon: Archive,          color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" };
    case "video":
      return { Icon: Video,            color: "text-pink-500",   bg: "bg-pink-50 border-pink-100"   };
    case "audio":
      return { Icon: Music,            color: "text-indigo-500", bg: "bg-indigo-50 border-indigo-100" };
    default:
      return { Icon: File,             color: "text-slate-400",  bg: "bg-slate-50 border-slate-200" };
  }
}

// ─── File size formatter ───────────────────────────────────────────────────────

/**
 * Converts a raw byte count into a human-readable string.
 * e.g. 1536 → "1.5 KB", 2097152 → "2.0 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0)             return "0 B";
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)     return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ─── Filename sanitizer ────────────────────────────────────────────────────────

/**
 * Strips path traversal characters and sanitizes a filename.
 * Keeps alphanumerics, dots, dashes, underscores, and spaces.
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\]/g, "")          // strip path separators
    .replace(/[\x00-\x1f]/g, "")    // strip control chars
    .replace(/[^a-zA-Z0-9.\-_ ]/g, "_")
    .slice(0, 200);
}

// ─── Cloudinary resource type inference ───────────────────────────────────────

/**
 * Infers the Cloudinary resource_type for deletion when it is not stored
 * (used as a fallback for legacy uploads that pre-date the UploadedFile model).
 * Returns "image" | "video" | "raw".
 */
export function inferResourceType(extension: string): "image" | "video" | "raw" {
  const ext = extension.toLowerCase().trim();
  if (IMAGE_EXTS.has(ext)) return "image";
  if (VIDEO_EXTS.has(ext)) return "video";
  return "raw";
}
