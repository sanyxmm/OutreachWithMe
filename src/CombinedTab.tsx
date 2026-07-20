import { useEffect, useMemo, useState } from "react";
import { stampTopLeft } from "./pdfStamp";
import { uploadToCloudinary, extractCloudinaryFileId, buildCloudinaryUrl } from "./cloudinary";
import { loadDefaultResume } from "./defaultResume";
import { extractEmailFromPdf } from "./resumeParser";
import {
  transformRawLeads,
  buildContactOutRows,
  HEADERS,
  type Lead,
} from "./contactout";
import {
  parseRows,
  dedupeContacts,
  buildRows,
  makeEmail,
  formatJobRole,
  EMAIL_PATTERNS,
  type Contact,
  type EmailPattern,
  type SkillCategoryChoice,
} from "./outreach";
import { exportXlsx } from "./exportXlsx";
import { sendRowsToSheet } from "./googleSheets";
import SkillCategoryPicker from "./SkillCategoryPicker";
import JobRoleFields from "./JobRoleFields";

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
  const [candidateEmail, setCandidateEmail] = useState("");
  const [emailParsing, setEmailParsing] = useState(false);

  useEffect(() => {
    loadDefaultResume().then(handleFile).catch(() => {});
  }, []);

  const [leadSource, setLeadSource] = useState<"contactout" | "salesql">("contactout");

  const [curl, setCurl] = useState("");
  const [maxPages, setMaxPages] = useState(10);
  const [salesqlHtml, setSalesqlHtml] = useState("");
  const [domain, setDomain] = useState("");
  const [emailPattern, setEmailPattern] = useState<EmailPattern>("first.last");
  const [companyOnly, setCompanyOnly] = useState("");
  const [jobRoleName, setJobRoleName] = useState("");
  const [jobId, setJobId] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [interval, setInterval_] = useState(1);
  const [skillCategory, setSkillCategory] = useState<SkillCategoryChoice>({ id: "mern+devops" });
  const [showCurlHelp, setShowCurlHelp] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);

  const [running, setRunning] = useState(false);
  const [stamping, setStamping] = useState(false);
  const [error, setError] = useState("");

  const [sheetUrl, setSheetUrl] = useState(
    () => localStorage.getItem(SHEET_URL_STORAGE_KEY) ?? ""
  );
  const [sendingToSheet, setSendingToSheet] = useState(false);
  const [sheetStatus, setSheetStatus] = useState("");
  const [sheetError, setSheetError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const jobRole = useMemo(() => formatJobRole(jobRoleName, jobId), [jobRoleName, jobId]);

  const contacts: Contact[] = useMemo(() => {
    if (!salesqlHtml.trim()) return [];
    try {
      return dedupeContacts(parseRows(salesqlHtml), companyOnly || undefined);
    } catch {
      return [];
    }
  }, [salesqlHtml, companyOnly]);

  const sampleEmail = useMemo(
    () => makeEmail("Jane Doe", domain || "domain.com", emailPattern),
    [domain, emailPattern]
  );

  const rows = useMemo(() => {
    if (leadSource === "salesql") {
      return buildRows(contacts, {
        domain,
        jobRole,
        resumeId,
        interval,
        companyOnly: companyOnly || undefined,
        emailPattern,
        skillCategory,
      });
    }
    return buildContactOutRows(leads, {
      jobRole,
      resumeId,
      interval,
      skillCategory,
    });
  }, [leadSource, contacts, leads, domain, jobRole, resumeId, interval, companyOnly, emailPattern, skillCategory]);

  const sourceCount = leadSource === "salesql" ? contacts.length : leads.length;

  const step1Ready = !!file && stampText.trim().length > 0;
  const step2Active = step1Ready;

  function handleFile(f: File | null) {
    setFile(f);
    setCandidateEmail("");
    if (!f) return;
    setEmailParsing(true);
    extractEmailFromPdf(f)
      .then(setCandidateEmail)
      .catch(() => {})
      .finally(() => setEmailParsing(false));
  }

  function rowsToTsv(): string {
    return [HEADERS, ...rows]
      .map((r) => r.map((v) => String(v).replace(/\t/g, " ")).join("\t"))
      .join("\n");
  }

  async function runStep1(): Promise<string> {
    if (!file) throw new Error("Upload your resume PDF first.");
    if (!stampText.trim()) {
      throw new Error("Paste the job description keywords to stamp on the resume.");
    }
    const bytes = await stampTopLeft(file, stampText);
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const outName = file.name.replace(/\.pdf$/i, "") + "_stamped.pdf";
    const result = await uploadToCloudinary(blob, outName);
    const extractedResumeId = extractCloudinaryFileId(result.secure_url);
    setResumeId(extractedResumeId);
    return extractedResumeId;
  }

  async function handleRunStep1() {
    setError("");
    setStamping(true);
    try {
      await runStep1();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setStamping(false);
    }
  }

  async function handleCreate() {
    setError("");
    setCopyStatus("");
    if (leadSource === "contactout" && !curl.trim()) {
      setError("Paste a curl command for one page of the leads list first.");
      return;
    }
    if (leadSource === "salesql" && !salesqlHtml.trim()) {
      setError("Paste or upload the SalesQL contacts table HTML first.");
      return;
    }
    if (leadSource === "salesql" && !domain.trim()) {
      setError("Enter an email domain.");
      return;
    }

    setRunning(true);
    if (leadSource === "contactout") setLeads([]);

    try {
      const existingResumeId = resumeId.trim();
      const currentResumeId = existingResumeId || (await runStep1());

      let builtRows;
      if (leadSource === "salesql") {
        builtRows = buildRows(contacts, {
          domain,
          jobRole,
          resumeId: currentResumeId,
          interval,
          companyOnly: companyOnly || undefined,
          emailPattern,
          skillCategory,
        });
      } else {
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
        builtRows = buildContactOutRows(parsed, {
          jobRole,
          resumeId: currentResumeId,
          interval,
          skillCategory,
        });
      }

      try {
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

            <label className="rl-field-label" htmlFor="cx-candidate-email">
              Candidate email (parsed from resume)
            </label>
            <div className="rl-locked-input">
              <input
                id="cx-candidate-email"
                type="text"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                placeholder={emailParsing ? "Parsing resume..." : "Not found — enter manually"}
              />
              {emailParsing ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  className="rl-icon-btn"
                  onClick={handleRunStep1}
                  disabled={running || stamping || !file || !stampText.trim()}
                  aria-label="Stamp resume and generate resume file ID"
                  title="Stamp resume and generate resume file ID"
                >
                  {stamping ? <span className="spinner spinner-dark" aria-hidden="true" /> : "▶"}
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="rl-card">
          <div className="rl-card-head">
            <span className="rl-step-pill">STEP 2</span>
            <h3>Point at Employees to Contact</h3>
            <div className="rl-source-toggle" role="group" aria-label="Lead source">
              <button
                type="button"
                className={`rl-source-btn ${leadSource === "contactout" ? "active" : ""}`}
                onClick={() => setLeadSource("contactout")}
                disabled={running}
              >
                ContactOut
              </button>
              <button
                type="button"
                className={`rl-source-btn ${leadSource === "salesql" ? "active" : ""}`}
                onClick={() => setLeadSource("salesql")}
                disabled={running}
              >
                SalesQL
              </button>
            </div>
          </div>

          <div className="rl-card-body">
            {leadSource === "contactout" ? (
              <>
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
                    reload, click the <code>leads?...</code> request, and "Copy as cURL". Paste
                    that here.
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
              </>
            ) : (
              <>
                <label className="rl-field-label" htmlFor="cx-salesql-html">
                  SalesQL contacts HTML
                </label>
                <textarea
                  id="cx-salesql-html"
                  className="rl-textarea mono"
                  placeholder="Paste the copied SalesQL table HTML here"
                  value={salesqlHtml}
                  onChange={(e) => setSalesqlHtml(e.target.value)}
                  rows={5}
                  disabled={running}
                />
                <div className="field-row">
                  <section className="field">
                    <label className="rl-field-label" htmlFor="cx-domain">
                      Email domain
                    </label>
                    <input
                      id="cx-domain"
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="company.com"
                      disabled={running}
                    />
                  </section>
                  <section className="field">
                    <label className="rl-field-label" htmlFor="cx-email-pattern">
                      Email pattern
                    </label>
                    <select
                      id="cx-email-pattern"
                      value={emailPattern}
                      onChange={(e) => setEmailPattern(e.target.value as EmailPattern)}
                      disabled={running}
                    >
                      {EMAIL_PATTERNS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <span className="hint">e.g. {sampleEmail}</span>
                  </section>
                </div>
              </>
            )}

            <details className="rl-advanced">
              <summary>
                <span className="rl-advanced-icon">⚙</span> Advanced settings
              </summary>
              <div className="field-row">
                <JobRoleFields
                  idPrefix="cx"
                  role={jobRoleName}
                  jobId={jobId}
                  onRoleChange={setJobRoleName}
                  onJobIdChange={setJobId}
                  disabled={running}
                />
                {leadSource === "contactout" ? (
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
                ) : (
                  <section className="field">
                    <label className="rl-field-label" htmlFor="cx-company-only">
                      Company filter (optional)
                    </label>
                    <input
                      id="cx-company-only"
                      type="text"
                      value={companyOnly}
                      onChange={(e) => setCompanyOnly(e.target.value)}
                      placeholder="e.g. gehealthcare"
                      disabled={running}
                    />
                  </section>
                )}
                <section className="field">
                  <label className="rl-field-label" htmlFor="cx-resume-id">
                    Resume file ID
                  </label>
                  <div className="rl-locked-input">
                    <input
                      id="cx-resume-id"
                      type="text"
                      value={resumeId}
                      onChange={(e) => setResumeId(e.target.value)}
                      disabled={running}
                    />
                    <button
                      type="button"
                      className="rl-icon-btn"
                      onClick={() => window.open(buildCloudinaryUrl(resumeId.trim()), "_blank", "noopener,noreferrer")}
                      disabled={!resumeId.trim()}
                      aria-label="Open resume file"
                      title="Open resume file"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </button>
                  </div>
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
                <SkillCategoryPicker
                  idPrefix="combined"
                  value={skillCategory}
                  onChange={setSkillCategory}
                />
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
              Generate fetches leads and copies the rows to your clipboard. Use ▶ to stamp &amp;
              upload the resume separately.
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
                {sourceCount} lead{sourceCount === 1 ? "" : "s"} collected
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
