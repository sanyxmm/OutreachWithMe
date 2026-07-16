import { useMemo, useState } from "react";
import {
  parseRows,
  dedupeContacts,
  buildRows,
  makeEmail,
  HEADERS,
  EMAIL_PATTERNS,
  type Contact,
  type EmailPattern,
} from "./outreach";
import { exportXlsx } from "./exportXlsx";

function SalesQlTab() {
  const [html, setHtml] = useState("");
  const [domain, setDomain] = useState("gehealthcare.com");
  const [emailPattern, setEmailPattern] = useState<EmailPattern>("first.last");
  const [jobRole, setJobRole] = useState("Intern(JobID: R4043322)");
  const [resumeId, setResumeId] = useState("1c5sk0RWMtGDzy3zbWmLwGeULgJhKckiV");
  const [interval, setInterval_] = useState(1);
  const [companyOnly, setCompanyOnly] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const contacts: Contact[] = useMemo(() => {
    if (!html.trim()) return [];
    try {
      return dedupeContacts(parseRows(html), companyOnly || undefined);
    } catch {
      return [];
    }
  }, [html, companyOnly]);

  const rows = useMemo(
    () => buildRows(contacts, { domain, jobRole, resumeId, interval, companyOnly: companyOnly || undefined, emailPattern }),
    [contacts, domain, jobRole, resumeId, interval, companyOnly, emailPattern]
  );

  const sampleEmail = useMemo(
    () => makeEmail("Jane Doe", domain || "domain.com", emailPattern),
    [domain, emailPattern]
  );

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setHtml(text);
    setError("");
  }

  async function handleDownload() {
    setError("");
    if (rows.length === 0) {
      setError("No contacts found. Paste or upload the SalesQL HTML table first.");
      return;
    }
    if (!domain.trim()) {
      setError("Enter an email domain.");
      return;
    }
    await exportXlsx(rows, "outreach_contacts.xlsx");
  }

  return (
    <div className="tab-panel">
      <p className="subtitle">
        Paste or upload the SalesQL contacts table HTML, set the email domain and job role,
        then download the outreach-ready Excel sheet.
      </p>

      <section className="field">
        <label htmlFor="html-input">SalesQL contacts HTML</label>
        <input
          id="html-file"
          type="file"
          accept=".html,.htm,text/html"
          onChange={handleFile}
        />
        {fileName && <span className="filename">{fileName}</span>}
        <textarea
          id="html-input"
          placeholder="...or paste the copied SalesQL table HTML here"
          value={html}
          onChange={(e) => {
            setHtml(e.target.value);
            setFileName("");
          }}
          rows={8}
        />
      </section>

      <div className="field-row">
        <section className="field">
          <label htmlFor="domain">Email domain</label>
          <input
            id="domain"
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="company.com"
          />
        </section>

        <section className="field">
          <label htmlFor="email-pattern">Email pattern</label>
          <select
            id="email-pattern"
            value={emailPattern}
            onChange={(e) => setEmailPattern(e.target.value as EmailPattern)}
          >
            {EMAIL_PATTERNS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="hint">e.g. {sampleEmail}</span>
        </section>

        <section className="field">
          <label htmlFor="job-role">Job role</label>
          <input
            id="job-role"
            type="text"
            value={jobRole}
            onChange={(e) => setJobRole(e.target.value)}
            placeholder='Intern(JobID: R4043322)'
          />
        </section>
      </div>

      <button className="link-btn" onClick={() => setShowAdvanced((v) => !v)}>
        {showAdvanced ? "Hide" : "Show"} advanced options
      </button>

      {showAdvanced && (
        <div className="field-row">
          <section className="field">
            <label htmlFor="resume-id">Resume file ID</label>
            <input
              id="resume-id"
              type="text"
              value={resumeId}
              onChange={(e) => setResumeId(e.target.value)}
            />
          </section>
          <section className="field">
            <label htmlFor="interval">Email interval (days)</label>
            <input
              id="interval"
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setInterval_(Number(e.target.value) || 1)}
            />
          </section>
          <section className="field">
            <label htmlFor="company-only">Company filter (optional)</label>
            <input
              id="company-only"
              type="text"
              value={companyOnly}
              onChange={(e) => setCompanyOnly(e.target.value)}
              placeholder="e.g. gehealthcare"
            />
          </section>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <span className="count">{rows.length} contact{rows.length === 1 ? "" : "s"} parsed</span>
        <button className="primary-btn" onClick={handleDownload} disabled={rows.length === 0}>
          Download outreach_contacts.xlsx
        </button>
      </div>

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

export default SalesQlTab;
