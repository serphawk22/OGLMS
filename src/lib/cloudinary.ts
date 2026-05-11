/**
 * Cloudinary video upload utility.
 * Uses the unsigned upload preset (NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET)
 * configured in Cloudinary settings.
 *
 * Returns the secure_url of the uploaded video.
 */
export async function uploadVideoToCloudinary(
  videoBlob: Blob,
  folder = "lms-recordings"
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary env vars are not set: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET"
    );
  }

  const formData = new FormData();
  formData.append("file", videoBlob, "recording.webm");
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);
  formData.append("resource_type", "video");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloudinary upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data.secure_url) {
    throw new Error("Cloudinary response missing secure_url");
  }

  console.log("[Cloudinary] Upload success:", data.secure_url);
  return data.secure_url as string;
}
