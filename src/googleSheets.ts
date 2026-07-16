export interface SendToSheetResult {
  appended: number;
}

// Apps Script Web Apps don't handle CORS preflight, so the request body must
// be sent as text/plain (a "simple request") to avoid the browser issuing an
// OPTIONS request first. The script itself still parses it as JSON.
export async function sendRowsToSheet(
  webAppUrl: string,
  headers: readonly string[],
  rows: (string | number)[][]
): Promise<SendToSheetResult> {
  const resp = await fetch(webAppUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ headers, rows }),
  });

  let json: { ok?: boolean; appended?: number; error?: string };
  try {
    json = await resp.json();
  } catch {
    throw new Error(
      "The Web App didn't return JSON — double check the URL is a deployed Apps Script Web App exec URL."
    );
  }

  if (!resp.ok || !json.ok) {
    throw new Error(json.error || "The Google Sheet Web App rejected the request.");
  }
  return { appended: json.appended ?? rows.length };
}
