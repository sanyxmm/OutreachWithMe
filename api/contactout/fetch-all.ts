import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseCurl } from "../_lib/parseCurl";

function setPage(url: string, page: number): string {
  const u = new URL(url);
  u.searchParams.set("page", String(page));
  return u.toString();
}

function findLeadsArray(payload: unknown): unknown[] {
  if (payload && typeof payload === "object") {
    const props = (payload as Record<string, unknown>).props as Record<string, unknown> | undefined;
    const leads = props?.leads as Record<string, unknown> | undefined;
    if (Array.isArray(leads?.data)) return leads.data as unknown[];
    const direct = (payload as Record<string, unknown>).leads as Record<string, unknown> | undefined;
    if (Array.isArray(direct?.data)) return direct.data as unknown[];
  }
  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const curlText: string = body?.curl;
    const maxPages: number = Math.min(Math.max(Number(body?.maxPages) || 1, 1), 50);
    if (!curlText || !curlText.trim()) {
      throw new Error("No curl command provided.");
    }

    const { url: baseUrl, headers } = parseCurl(curlText);
    const startPage = Number(new URL(baseUrl).searchParams.get("page")) || 1;

    const allLeads: unknown[] = [];
    let pagesFetched = 0;
    for (let page = startPage; page < startPage + maxPages; page++) {
      const pageUrl = setPage(baseUrl, page);
      const resp = await fetch(pageUrl, {
        method: "GET",
        headers: {
          accept: headers["accept"] || "text/html, application/xhtml+xml",
          "content-type": "application/json",
          cookie: headers["cookie"] || "",
          "x-inertia": "true",
          "x-inertia-version": headers["x-inertia-version"] || "",
          "x-requested-with": "XMLHttpRequest",
          "x-xsrf-token": headers["x-xsrf-token"] || "",
          "user-agent": headers["user-agent"] || "Mozilla/5.0",
        },
      });
      pagesFetched++;
      if (resp.status === 401 || resp.status === 403) {
        throw new Error(
          `ContactOut rejected the request on page ${page} (HTTP ${resp.status}). Your session/XSRF token in the curl has likely expired — copy a fresh curl from the browser and try again.`
        );
      }
      if (!resp.ok) {
        throw new Error(`Request failed on page ${page} (HTTP ${resp.status}).`);
      }
      const json = await resp.json();
      const leads = findLeadsArray(json);
      if (leads.length === 0) break;
      allLeads.push(...leads);
    }

    res.status(200).json({ leads: allLeads, pagesFetched });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}
