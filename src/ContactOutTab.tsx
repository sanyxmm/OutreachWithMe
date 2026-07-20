import { useMemo, useState } from "react";
import {
  transformRawLeads,
  mergeLeads,
  buildContactOutRows,
  HEADERS,
  type Lead,
} from "./contactout";
import { formatJobRole, type SkillCategoryChoice } from "./outreach";
import { exportXlsx } from "./exportXlsx";
import InfoCallout from "./InfoCallout";
import SkillCategoryPicker from "./SkillCategoryPicker";
import JobRoleFields from "./JobRoleFields";

interface FetchAllResponse {
  leads?: unknown[];
  pagesFetched?: number;
  error?: string;
}

function ContactOutTab() {
  const [curl, setCurl] = useState("");
  const [maxPages, setMaxPages] = useState(6);
  const [fetching, setFetching] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [jobRoleName, setJobRoleName] = useState("Intern");
  const [jobId, setJobId] = useState("R4043322");
  const [resumeId, setResumeId] = useState("1c5sk0RWMtGDzy3zbWmLwGeULgJhKckiV");
  const [interval, setInterval_] = useState(1);
  const [skillCategory, setSkillCategory] = useState<SkillCategoryChoice>({ id: "mern+devops" });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const jobRole = useMemo(() => formatJobRole(jobRoleName, jobId), [jobRoleName, jobId]);

  const rows = useMemo(
    () => buildContactOutRows(leads, { jobRole, resumeId, interval, skillCategory }),
    [leads, jobRole, resumeId, interval, skillCategory]
  );

  async function handleFetch() {
    setError("");
    setStatus("");
    if (!curl.trim()) {
      setError("Paste a curl command for one page of the leads list first.");
      return;
    }
    setFetching(true);
    try {
      const resp = await fetch("/api/contactout/fetch-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curl, maxPages }),
      });
      const json: FetchAllResponse = await resp.json();
      if (!resp.ok || json.error) {
        throw new Error(json.error || "Fetch failed.");
      }
      const parsed = transformRawLeads(json.leads ?? []);
      setLeads((prev) => mergeLeads(prev, parsed));
      setStatus(`Fetched ${json.pagesFetched ?? 0} page(s), ${parsed.length} lead(s) in this run.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't fetch leads.");
    } finally {
      setFetching(false);
    }
  }

  function handleClear() {
    setLeads([]);
    setError("");
    setStatus("");
  }

  async function handleDownload() {
    if (rows.length === 0) {
      setError("No leads to export yet.");
      return;
    }
    await exportXlsx(rows, "outreach_contacts.xlsx");
  }

  async function handleCopyRows() {
    setCopyStatus("");
    if (rows.length === 0) return;
    const tsv = [HEADERS, ...rows]
      .map((r) => r.map((v) => String(v).replace(/\t/g, " ")).join("\t"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      setCopyStatus(`Copied ${rows.length} row(s) — paste into Google Sheets with Cmd/Ctrl+V.`);
    } catch {
      setCopyStatus("Couldn't copy — your browser may be blocking clipboard access.");
    }
  }

  return (
    <div className="tab-panel">
      <InfoCallout>
        Paste a curl command copied from your browser's devtools for page 1 of a ContactOut
        leads list. The app replays it server-side, incrementing the page number, and stops
        automatically once a page comes back empty or the page cap is hit — no manual
        copy-pasting of JSON responses. Nothing here is written to disk; the curl (and its
        session cookie) only lives in memory for this request.
      </InfoCallout>

      <div className="rl-label-row">
        <label className="rl-field-label" htmlFor="co-curl">
          Curl command (page 1)
        </label>
        <span className="field-hint-accent">must include page parameter</span>
      </div>
      <textarea
        id="co-curl"
        className="rl-textarea mono"
        placeholder="curl 'https://contactout.com/lists/.../leads?...' -H '...' -b '...' ..."
        value={curl}
        onChange={(e) => setCurl(e.target.value)}
        rows={8}
      />

      <div className="field-row">
        <section className="field">
          <label htmlFor="co-max-pages">Max pages to fetch</label>
          <input
            id="co-max-pages"
            type="number"
            min={1}
            max={50}
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value) || 1)}
          />
          <span className="hint">Stops early if a page comes back with no leads.</span>
        </section>
        <JobRoleFields
          idPrefix="contactout"
          role={jobRoleName}
          jobId={jobId}
          onRoleChange={setJobRoleName}
          onJobIdChange={setJobId}
        />
      </div>

      <div className="divider" />

      <div className="actions">
        <button className="primary-btn" onClick={handleFetch} disabled={fetching}>
          {fetching ? "Fetching..." : "▷ Fetch leads"}
        </button>
        <button className="secondary-btn" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Hide" : "Show"} advanced options
        </button>
        {leads.length > 0 && (
          <button className="link-btn" onClick={handleClear}>
            Clear all leads
          </button>
        )}
        <span className="status-pill status-pill-warning">
          <span className="status-dot" aria-hidden="true" />
          {leads.length} lead{leads.length === 1 ? "" : "s"} collected
        </span>
      </div>

      {status && <p className="hint success">{status}</p>}

      {showAdvanced && (
        <div className="field-row">
          <section className="field">
            <label htmlFor="co-resume-id">Resume file ID</label>
            <input
              id="co-resume-id"
              type="text"
              value={resumeId}
              onChange={(e) => setResumeId(e.target.value)}
            />
          </section>
          <section className="field">
            <label htmlFor="co-interval">Email interval (days)</label>
            <input
              id="co-interval"
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setInterval_(Number(e.target.value) || 1)}
            />
          </section>
          <SkillCategoryPicker idPrefix="contactout" value={skillCategory} onChange={setSkillCategory} />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="export-card">
        <div className="export-card-info">
          <span className="export-card-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <p className="export-card-title">Ready to Export</p>
            <p className="export-card-body">
              Once leads are fetched, download your customized Excel document below.
            </p>
          </div>
        </div>
        <div className="export-card-actions">
          <button
            className="primary-btn export-btn"
            onClick={handleDownload}
            disabled={rows.length === 0}
          >
            ⬇ Download outreach_contacts.xlsx
          </button>
          <button
            className="secondary-btn icon-btn"
            onClick={handleCopyRows}
            disabled={rows.length === 0}
            aria-label="Copy rows"
            title="Copy rows"
          >
            ⧉
          </button>
        </div>
      </div>

      {copyStatus && <p className="hint success">{copyStatus}</p>}

      {rows.length > 0 && (
        <section className="preview">
          <h2>Preview</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {HEADERS.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 25).map((row, i) => (
                  <tr key={i}>
                    {row.map((v, j) => (
                      <td key={j}>{String(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 25 && <p className="hint">Showing first 25 of {rows.length} rows.</p>}
        </section>
      )}
    </div>
  );
}

export default ContactOutTab;
