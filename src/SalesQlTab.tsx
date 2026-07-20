import { useMemo, useState } from "react";
import {
  parseRows,
  dedupeContacts,
  buildRows,
  makeEmail,
  formatJobRole,
  HEADERS,
  EMAIL_PATTERNS,
  type Contact,
  type EmailPattern,
  type SkillCategoryChoice,
} from "./outreach";
import { exportXlsx } from "./exportXlsx";
import InfoCallout from "./InfoCallout";
import SkillCategoryPicker from "./SkillCategoryPicker";
import JobRoleFields from "./JobRoleFields";

function SalesQlTab() {
  const [html, setHtml] = useState("");
  const [domain, setDomain] = useState("");
  const [emailPattern, setEmailPattern] = useState<EmailPattern>("first.last");
  const [jobRoleName, setJobRoleName] = useState("Intern");
  const [jobId, setJobId] = useState("R4043322");
  const [resumeId, setResumeId] = useState("1c5sk0RWMtGDzy3zbWmLwGeULgJhKckiV");
  const [interval, setInterval_] = useState(1);
  const [companyOnly, setCompanyOnly] = useState("");
  const [skillCategory, setSkillCategory] = useState<SkillCategoryChoice>({ id: "mern+devops" });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const contacts: Contact[] = useMemo(() => {
    if (!html.trim()) return [];
    try {
      return dedupeContacts(parseRows(html), companyOnly || undefined);
    } catch {
      return [];
    }
  }, [html, companyOnly]);

  const jobRole = useMemo(() => formatJobRole(jobRoleName, jobId), [jobRoleName, jobId]);

  const rows = useMemo(
    () =>
      buildRows(contacts, {
        domain,
        jobRole,
        resumeId,
        interval,
        companyOnly: companyOnly || undefined,
        emailPattern,
        skillCategory,
      }),
    [contacts, domain, jobRole, resumeId, interval, companyOnly, emailPattern, skillCategory]
  );

  const sampleEmail = useMemo(
    () => makeEmail("Jane Doe", domain || "domain.com", emailPattern),
    [domain, emailPattern]
  );

  async function handleDownload() {
    setError("");
    if (rows.length === 0) {
      setError("No contacts found. Paste the SalesQL HTML table first.");
      return;
    }
    if (!domain.trim()) {
      setError("Enter an email domain.");
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
        Paste the SalesQL contacts table HTML, set the email domain and job role, then download
        the outreach-ready Excel sheet.
      </InfoCallout>

      <section className="field">
        <label htmlFor="html-input">SalesQL contacts HTML</label>
        <textarea
          id="html-input"
          placeholder="Paste the copied SalesQL table HTML here"
          value={html}
          onChange={(e) => setHtml(e.target.value)}
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

        <JobRoleFields
          idPrefix="salesql"
          role={jobRoleName}
          jobId={jobId}
          onRoleChange={setJobRoleName}
          onJobIdChange={setJobId}
        />
      </div>

      <div className="actions">
        <button className="secondary-btn" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Hide" : "Show"} advanced options
        </button>
      </div>

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
          <SkillCategoryPicker idPrefix="salesql" value={skillCategory} onChange={setSkillCategory} />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="divider" />

      <div className="export-card">
        <div className="export-card-info">
          <span className="export-card-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <p className="export-card-title">Ready to Export</p>
            <p className="export-card-body">
              {rows.length} contact{rows.length === 1 ? "" : "s"} parsed — download your
              customized Excel document below.
            </p>
          </div>
        </div>
        <div className="export-card-actions">
          <button className="primary-btn export-btn" onClick={handleDownload} disabled={rows.length === 0}>
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

export default SalesQlTab;
