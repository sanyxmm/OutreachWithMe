const DEFAULT_RESUME_URL = "/default-resume.pdf";
const DEFAULT_RESUME_NAME = "Sanyam-sde-r.pdf";

export async function loadDefaultResume(): Promise<File> {
  const res = await fetch(DEFAULT_RESUME_URL);
  const blob = await res.blob();
  return new File([blob], DEFAULT_RESUME_NAME, { type: "application/pdf" });
}
