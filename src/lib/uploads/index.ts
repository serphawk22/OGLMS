/**
 * @file src/lib/uploads/index.ts
 * Client-side Cloudinary direct upload helper.
 * Uploads directly from the browser to Cloudinary (bypasses Vercel payload limits).
 */

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  resource_type: string;
  bytes: number;
  format: string;
  original_filename: string;
}

export interface UploadOptions {
  /** Cloudinary upload preset (unsigned) */
  preset: string;
  /** Cloudinary cloud name */
  cloudName: string;
  /** Called during upload with 0-100 progress value */
  onProgress?: (percent: number) => void;
}

/**
 * Uploads a file directly to Cloudinary from the browser using XHR.
 * Uses resource_type "auto" so Cloudinary detects image / video / raw.
 * Returns the full Cloudinary response on success.
 */
export function uploadToCloudinaryDirect(
  file: File,
  options: UploadOptions,
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const { preset, cloudName, onProgress } = options;

    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", preset);

    const xhr = new XMLHttpRequest();

    // Progress tracking
    xhr.upload.addEventListener("progress", (ev) => {
      if (ev.lengthComputable && onProgress) {
        onProgress(Math.round((ev.loaded / ev.total) * 90));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        try {
          const data: CloudinaryUploadResult = JSON.parse(xhr.responseText);
          if (data.secure_url && data.public_id) {
            resolve(data);
          } else {
            reject(new Error("Cloudinary did not return a valid URL."));
          }
        } catch {
          reject(new Error("Invalid response from Cloudinary."));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err?.error?.message ?? `Upload failed (${xhr.status}).`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status}).`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload.")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled.")));

    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
    xhr.send(fd);
  });
}
