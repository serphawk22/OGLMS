/**
 * @file src/lib/validation/index.ts
 * Shared server-side file validation rules.
 * Import and use on EVERY API route that accepts file metadata.
 */

import { getFileExtension } from "@/lib/file-utils";

// ─── Limits ───────────────────────────────────────────────────────────────────

export const MAX_FILE_SIZE    = 50 * 1024 * 1024; // 50 MB
export const MAX_PREVIEW_SIZE =  1 * 1024 * 1024; //  1 MB (text/code inline limit)

// ─── Blocked types ────────────────────────────────────────────────────────────

export const BLOCKED_EXTENSIONS = new Set([
  "exe","bat","cmd","sh","msi","dll","ps1","vbs",
  "jar","com","scr","pif","reg","inf","sys","dmg",
  "apk","ipa","deb","rpm",
]);

export const BLOCKED_MIME_PREFIXES = [
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-sh",
];

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validates a file's size, name, and MIME type against LMS security rules.
 *
 * @returns null if the file is valid, or an error message string if invalid.
 */
export function validateFileMetadata(
  size: number,
  fileName: string,
  mimeType: string,
): string | null {
  // 1. Size checks
  if (!size || size === 0) {
    return "File is empty.";
  }
  if (size > MAX_FILE_SIZE) {
    return `File too large. Maximum allowed size is 50 MB (received ${(size / 1024 / 1024).toFixed(1)} MB).`;
  }

  // 2. Extension checks
  const ext = getFileExtension(fileName);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return `File type ".${ext}" is not allowed for security reasons.`;
  }

  // 3. MIME type checks
  if (BLOCKED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    return "This file type is not allowed for security reasons.";
  }

  return null; // ✅ valid
}
