import { useEffect, useMemo, useState } from "react";
import { stampTopLeft } from "./pdfStamp";
import { uploadToCloudinary } from "./cloudinary";
import { loadDefaultResume } from "./defaultResume";
import {
  transformRawLeads,
  buildContactOutRows,
  HEADERS,
  type Lead,
} from "./contactout";
import { exportXlsx } from "./exportXlsx";
import { sendRowsToSheet } from "./googleSheets";

const SHEET_URL_STORAGE_KEY = "referral-launchpad-sheet-web-app-url";

interface FetchAllResponse {
  leads?: unknown[];
  pagesFetched?: number;
  error?: string;
}

function CombinedTab() {
  const [file, setFile] = useState<File | null>(null);
  const [stampText, setStampText] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    loadDefaultResume().then(setFile).catch(() => {});
  }, []);

  const [curl, setCurl] = useState("");
  const [maxPages, setMaxPages] = useState(10);
  const [jobRole, setJobRole] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [interval, setInterval_] = useState(1);
  const [showCurlHelp, setShowCurlHelp] = useState(false);

  const [cloudinaryUrl, setCloudinaryUrl] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const [sheetUrl, setSheetUrl] = useState(
    () => localStorage.getItem(SHEET_URL_STORAGE_KEY) ?? ""
  );
  const [sendingToSheet, setSendingToSheet] = useState(false);
  const [sheetStatus, setSheetStatus] = useState("");
  const [sheetError, setSheetError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const rows = useMemo(
    () =>
      buildContactOutRows(leads, {
        jobRole,
        resumeId,
        cloudinaryResumeId: cloudinaryUrl,
        interval,
      }),
    [leads, jobRole, resumeId, cloudinaryUrl, interval]
  );

  const step1Ready = !!file && stampText.trim().length > 0;
  const step2Active = step1Ready;

  function handleFile(f: File | null) {
    setFile(f);
  }

  function rowsToTsv(): string {
    return [HEADERS, ...rows]
      .map((r) => r.map((v) => String(v).replace(/\t/g, " ")).join("\t"))
      .join("\n");
  }

  async function handleCreate() {
    setError("");
    setCopyStatus("");
    if (!file) {
      setError("Upload your resume PDF first.");
      return;
    }
    if (!stampText.trim()) {
      setError("Paste the job description keywords to stamp on the resume.");
      return;
    }
    if (!curl.trim()) {
      setError("Paste a curl command for one page of the leads list first.");
      return;
    }

    setRunning(true);
    setCloudinaryUrl("");
    setLeads([]);

    try {
      const bytes = await stampTopLeft(file, stampText);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const outName = file.name.replace(/\.pdf$/i, "") + "_stamped.pdf";
      const result = await uploadToCloudinary(blob, outName);
      setCloudinaryUrl(result.secure_url);

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
      setLeads(parsed);

      try {
        const builtRows = buildContactOutRows(parsed, {
          jobRole,
          resumeId,
          cloudinaryResumeId: result.secure_url,
          interval,
        });
        const tsv = [HEADERS, ...builtRows]
          .map((r) => r.map((v) => String(v).replace(/\t/g, " ")).join("\t"))
          .join("\n");
        await navigator.clipboard.writeText(tsv);
        setCopyStatus(`Generated & copied ${builtRows.length} row(s) to your clipboard.`);
      } catch {
        // Clipboard copy is best-effort; the download/manual copy buttons still work.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setRunning(false);
    }
  }

  async function handleDownload() {
    if (rows.length === 0) return;
    await exportXlsx(rows, "outreach_contacts.xlsx");
  }

  async function handleCopyRows() {
    if (rows.length === 0) return;
    try {
      await navigator.clipboard.writeText(rowsToTsv());
      setCopyStatus(`Copied ${rows.length} row(s) — paste into Google Sheets with Cmd/Ctrl+V.`);
    } catch {
      setCopyStatus("Couldn't copy — your browser may be blocking clipboard access.");
    }
  }

  function handleSheetUrlChange(url: string) {
    setSheetUrl(url);
    localStorage.setItem(SHEET_URL_STORAGE_KEY, url);
  }

  async function handleSendToSheet() {
    setSheetError("");
    setSheetStatus("");
    if (!sheetUrl.trim()) {
      setSheetError("Paste your Apps Script Web App URL first.");
      return;
    }
    if (rows.length === 0) return;

    setSendingToSheet(true);
    try {
      const result = await sendRowsToSheet(sheetUrl.trim(), HEADERS, rows);
      setSheetStatus(`Added ${result.appended} row(s) to your Google Sheet.`);
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : "Couldn't reach the Google Sheet.");
    } finally {
      setSendingToSheet(false);
    }
  }

  return (
    <div className="tab-panel referral-launchpad">
      <div className="rl-stepper">
        <div className={`rl-stepper-node ${!step2Active ? "active" : "complete"}`}>
          <span className="rl-stepper-badge">1</span>
          <div>
            <div className="rl-stepper-title">Resume & JD Stamp</div>
            <div className="rl-stepper-sub">Upload and preview matching</div>
          </div>
        </div>
        <div className={`rl-stepper-line ${step2Active ? "filled" : ""}`} />
        <div className={`rl-stepper-node ${step2Active ? "active" : ""}`}>
          <span className="rl-stepper-badge">2</span>
          <div>
            <div className="rl-stepper-title">Target & Parameters</div>
            <div className="rl-stepper-sub">Lead import & campaign launch</div>
          </div>
        </div>
      </div>

      <div className="rl-grid">
        <section className="rl-card">
          <div className="rl-card-head">
            <span className="rl-step-pill">STEP 1</span>
            <h3>Resume Profile &amp; JD Stamping</h3>
            <span className="rl-card-meta">ⓘ Real-time match</span>
          </div>

          <div className="rl-card-body">
            <label className="rl-field-label">Upload candidate resume</label>
            <label
              className={`rl-dropzone ${dragOver ? "drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files?.[0] ?? null);
              }}
            >
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                disabled={running}
                hidden
              />
              <span className="rl-dropzone-icon">⬆</span>
              <span className="rl-dropzone-text">Drag &amp; drop resume file here</span>
              <span className="hint">Supports PDF up to 10MB</span>
              {file && (
                <span className="rl-file-chip">📄 {file.name} <span className="check">✓</span></span>
              )}
            </label>

            <label className="rl-field-label" htmlFor="cx-stamp-text">
              Target job description (for stamping)
            </label>
            <textarea
              id="cx-stamp-text"
              className="rl-textarea"
              value={stampText}
              onChange={(e) => setStampText(e.target.value)}
              placeholder="Paste the job description text here..."
              rows={6}
              disabled={running}
            />

            <label className="rl-field-label" htmlFor="cx-cloudinary-url">
              Cloudinary link (auto-filled)
            </label>
            <div className="rl-locked-input">
              <input
                id="cx-cloudinary-url"
                type="text"
                value={cloudinaryUrl}
                readOnly
                placeholder="Filled in after generating"
              />
              {cloudinaryUrl ? (
                <span className="rl-locked-badge">Active Ready</span>
              ) : (
                <span className="rl-lock-icon">🔒</span>
              )}
            </div>
          </div>
        </section>

        <section className="rl-card">
          <div className="rl-card-head">
            <span className="rl-step-pill">STEP 2</span>
            <h3>Point at Employees to Contact</h3>
            <span className="rl-card-meta">⚡ Instant Send Ready</span>
          </div>

          <div className="rl-card-body">
            <div className="rl-label-row">
              <label className="rl-field-label" htmlFor="cx-curl">
                ContactOut curl command (page 1)
              </label>
              <button
                type="button"
                className="rl-link-btn"
                onClick={() => setShowCurlHelp((v) => !v)}
              >
                Where to find this?
              </button>
            </div>
            {showCurlHelp && (
              <p className="hint rl-curl-help">
                Open the ContactOut leads list in your browser, open devtools → Network tab,
                reload, click the <code>leads?...</code> request, and "Copy as cURL". Paste that
                here.
              </p>
            )}
            <textarea
              id="cx-curl"
              className="rl-textarea mono"
              placeholder="curl 'https://contactout.com/lists/.../leads?...' -H '...' -b '...' ..."
              value={curl}
              onChange={(e) => setCurl(e.target.value)}
              rows={5}
              disabled={running}
            />

            <details className="rl-advanced">
              <summary>
                <span className="rl-advanced-icon">⚙</span> Advanced settings
              </summary>
              <div className="field-row">
                <section className="field">
                  <label className="rl-field-label" htmlFor="cx-job-role">
                    Job role for outreach
                  </label>
                  <input
                    id="cx-job-role"
                    type="text"
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    disabled={running}
                  />
                </section>
                <section className="field">
                  <label className="rl-field-label" htmlFor="cx-max-pages">
                    Max pages to fetch
                  </label>
                  <input
                    id="cx-max-pages"
                    type="number"
                    min={1}
                    max={50}
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value) || 1)}
                    disabled={running}
                  />
                </section>
                <section className="field">
                  <label className="rl-field-label" htmlFor="cx-resume-id">
                    Resume file ID
                  </label>
                  <input
                    id="cx-resume-id"
                    type="text"
                    value={resumeId}
                    onChange={(e) => setResumeId(e.target.value)}
                    disabled={running}
                  />
                </section>
                <section className="field">
                  <label className="rl-field-label" htmlFor="cx-interval">
                    Email interval (days)
                  </label>
                  <input
                    id="cx-interval"
                    type="number"
                    min={1}
                    value={interval}
                    onChange={(e) => setInterval_(Number(e.target.value) || 1)}
                    disabled={running}
                  />
                </section>
              </div>
            </details>

            {error && <p className="error">{error}</p>}

            <div className="rl-actions-row">
              <button
                className="rl-btn-primary"
                onClick={handleCreate}
                disabled={running}
              >
                {running ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <span aria-hidden="true">⧉</span>
                )}
                {running ? "Generating..." : "Generate"}
              </button>
              <button
                className="rl-btn-secondary"
                onClick={handleDownload}
                disabled={rows.length === 0}
              >
                <span aria-hidden="true">⬇</span> Download
              </button>
            </div>
            <p className="rl-actions-caption">
              Clicking generate runs the pipeline, stamps your resume, and automatically copies
              the outreach rows to your clipboard. Use download to save an xlsx copy.
            </p>
          </div>
        </section>
      </div>

      {rows.length === 0 && copyStatus && <p className="hint success">{copyStatus}</p>}

      {rows.length > 0 && (
        <div className="rl-results">
          <div className="rl-results-header">
            <div>
              <span className="rl-results-count">
                {leads.length} lead{leads.length === 1 ? "" : "s"} collected
              </span>
              <span className="rl-results-sub">
                Ready to send — copy, sync to Sheets, or review below.
              </span>
            </div>
            <button className="rl-btn-secondary rl-copy-btn" onClick={handleCopyRows}>
              <span aria-hidden="true">📋</span> Copy rows
            </button>
          </div>

          {copyStatus && <p className="hint success rl-copy-toast">{copyStatus}</p>}

          <div className="sheet-sync">
            <h3>Send straight to Google Sheets</h3>
            <p className="hint">
              Paste the Web App URL from your Apps Script deployment (see{" "}
              <code>apps-script/append-to-sheet.gs</code> for the one-time setup) and rows get
              appended directly to your sheet — no copy-paste.
            </p>
            <div className="field-row">
              <section className="field">
                <label className="rl-field-label" htmlFor="cx-sheet-url">
                  Apps Script Web App URL
                </label>
                <input
                  id="cx-sheet-url"
                  type="text"
                  value={sheetUrl}
                  onChange={(e) => handleSheetUrlChange(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                />
              </section>
            </div>
            {sheetError && <p className="error">{sheetError}</p>}
            {sheetStatus && <p className="hint success">{sheetStatus}</p>}
            <div className="actions">
              <button
                className="rl-btn-primary"
                onClick={handleSendToSheet}
                disabled={sendingToSheet}
              >
                {sendingToSheet && <span className="spinner" aria-hidden="true" />}
                {sendingToSheet ? "Sending..." : "📤 Send to Google Sheet"}
              </button>
            </div>
          </div>

          <div className="next-steps-callout">
            <strong>Next: send the referral requests.</strong>
            <ol>
              <li>
                Rows are in your Google Sheet — either sent automatically above, or pasted from
                your clipboard / the downloaded xlsx.
              </li>
              <li>
                Run your Apps Script mail-merge — it emails the stamped resume to every contact
                on the list, requesting a referral.
              </li>
            </ol>
          </div>

          <section className="rl-preview-card">
            <div className="rl-preview-head">
              <h2>Preview</h2>
              {rows.length > 25 && (
                <span className="hint">Showing first 25 of {rows.length} rows.</span>
              )}
            </div>
            <div className="rl-table-wrap">
              <table className="rl-table">
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
          </section>
        </div>
      )}
    </div>
  );
}

export default CombinedTab;
