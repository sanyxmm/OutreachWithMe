// Drop in your own Cloudinary credentials here.
export const CLOUD_NAME = "dl8dwt13x";
export const UPLOAD_PRESET = "getMyResume";

export interface CloudinaryUploadResult {
  secure_url: string;
  [key: string]: unknown;
}

// Turns "https://res.cloudinary.com/<cloud>/.../upload/v123/abc123.pdf" into "v123/abc123".
export function extractCloudinaryFileId(secureUrl: string): string {
  const match = secureUrl.match(/\/upload\/(.+)$/);
  if (!match) return "";
  return match[1].replace(/\.[^./]+$/, "");
}

// Reverse of extractCloudinaryFileId: turns "v123/abc123" back into a viewable link.
export function buildCloudinaryUrl(fileId: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${fileId}.pdf`;
}

export async function uploadToCloudinary(blob: Blob, filename: string): Promise<CloudinaryUploadResult> {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;
  const formData = new FormData();
  formData.append("file", blob, filename);
  formData.append("upload_preset", UPLOAD_PRESET);

  const resp = await fetch(url, { method: "POST", body: formData });
  const json = await resp.json();
  if (!resp.ok) {
    const message = (json as { error?: { message?: string } })?.error?.message;
    throw new Error(message || `Upload failed (HTTP ${resp.status}).`);
  }
  return json as CloudinaryUploadResult;
}
