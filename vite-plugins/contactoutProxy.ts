import type { Plugin, Connect } from "vite";

// Parses a `curl '...' -H '...' -b '...'` command copied from browser devtools
// into a URL + header map we can replay server-side (bypasses browser CORS/cookie
// restrictions that would block calling contactout.com directly from the page).
export function parseCurl(curlText: string): { url: string; headers: Record<string, string> } {
  const urlMatch = curlText.match(/curl\s+'([^']+)'/) || curlText.match(/curl\s+"([^"]+)"/);
  if (!urlMatch) throw new Error("Couldn't find a URL in the pasted curl command.");
  const url = urlMatch[1];

  const headers: Record<string, string> = {};
  const headerRe = /-H\s+'([^:]+):\s*([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(curlText))) {
    headers[m[1].toLowerCase()] = m[2];
  }
  const headerReDouble = /-H\s+"([^:]+):\s*([^"]*)"/g;
  while ((m = headerReDouble.exec(curlText))) {
    headers[m[1].toLowerCase()] = m[2];
  }

  const cookieMatch = curlText.match(/-b\s+'([^']*)'/) || curlText.match(/-b\s+"([^"]*)"/);
  if (cookieMatch) headers["cookie"] = cookieMatch[1];

  return { url, headers };
}

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

async function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export function contactOutProxyPlugin(): Plugin {
  return {
    name: "contactout-proxy",
    configureServer(server) {
      server.middlewares.use("/api/contactout/fetch-all", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const body = JSON.parse(await readBody(req));
          const curlText: string = body.curl;
          const maxPages: number = Math.min(Math.max(Number(body.maxPages) || 1, 1), 50);
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

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ leads: allLeads, pagesFetched }));
        } catch (err) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
        }
      });
    },
  };
}
