import { useMemo, useState } from "react";
import { stampTopLeft } from "./pdfStamp";
import { uploadToCloudinary } from "./cloudinary";
import {
  transformRawLeads,
  buildContactOutRows,
  HEADERS,
  type Lead,
} from "./contactout";
import { exportXlsx } from "./exportXlsx";

interface FetchAllResponse {
  leads?: unknown[];
  pagesFetched?: number;
  error?: string;
}

type StageStatus = "pending" | "running" | "done" | "error";

const STAGE_LABELS = [
  "Stamp PDF & upload to Cloudinary",
  "Fetch leads from ContactOut",
  "Build outreach rows",
];

function CombinedTab() {
  const [file, setFile] = useState<File | null>(null);
  const [stampText, setStampText] = useState("");

  const [curl, setCurl] = useState("");
  const [maxPages, setMaxPages] = useState(6);
  const [jobRole, setJobRole] = useState("Intern(JobID: R4043322)");
  const [resumeId, setResumeId] = useState("1c5sk0RWMtGDzy3zbWmLwGeULgJhKckiV");
  const [interval, setInterval_] = useState(1);

  const [cloudinaryUrl, setCloudinaryUrl] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);

  const [running, setRunning] = useState(false);
  const [stageStatuses, setStageStatuses] = useState<StageStatus[]>(
    STAGE_LABELS.map(() => "pending")
  );
  const [error, setError] = useState("");

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

  function setStage(i: number, status: StageStatus) {
    setStageStatuses((prev) => prev.map((s, idx) => (idx === i ? status : s)));
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
  }

  async function handleCreate() {
    setError("");
    if (!file) {
      setError("Upload a PDF first.");
      return;
    }
    if (!stampText.trim()) {
      setError("Enter the text to stamp on the PDF.");
      return;
    }
    if (!curl.trim()) {
      setError("Paste a curl command for one page of the leads list first.");
      return;
    }

    setRunning(true);
    setCloudinaryUrl("");
    setLeads([]);
    setStageStatuses(STAGE_LABELS.map(() => "pending"));

    let stage = 0;
    try {
      stage = 0;
      setStage(0, "running");
      const bytes = await stampTopLeft(file, stampText);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const outName = file.name.replace(/\.pdf$/i, "") + "_stamped.pdf";
      const result = await uploadToCloudinary(blob, outName);
      setCloudinaryUrl(result.secure_url);
      setStage(0, "done");

      stage = 1;
      setStage(1, "running");
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
      setStage(1, "done");

      stage = 2;
      setStage(2, "running");
      setStage(2, "done");
    } catch (e) {
      setStage(stage, "error");
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setRunning(false);
    }
  }

  async function handleDownload() {
    if (rows.length === 0) return;
    await exportXlsx(rows, "outreach_contacts.xlsx");
  }

  return (
    <div className="tab-panel">
      <p className="subtitle">
        One pass: stamp a PDF and upload it to Cloudinary, fetch ContactOut leads from a pasted
        curl command, then build the outreach sheet. The Cloudinary link fills in automatically
        once the upload finishes.
      </p>

      <section className="field">
        <label htmlFor="cx-file">PDF file</label>
        <input
          id="cx-file"
          type="file"
          accept="application/pdf"
          onChange={handleFile}
          disabled={running}
        />
        {file && <span className="filename">{file.name}</span>}
      </section>

      <section className="field">
        <label htmlFor="cx-stamp-text">Text to stamp on PDF</label>
        <input
          id="cx-stamp-text"
          type="text"
          value={stampText}
          onChange={(e) => setStampText(e.target.value)}
          placeholder="e.g. a name or ID"
          disabled={running}
        />
      </section>

      <section className="field">
        <label htmlFor="cx-curl">Curl command (page 1)</label>
        <textarea
          id="cx-curl"
          placeholder="curl 'https://contactout.com/lists/.../leads?...' -H '...' -b '...' ..."
          value={curl}
          onChange={(e) => setCurl(e.target.value)}
          rows={8}
          disabled={running}
        />
      </section>

      <div className="field-row">
        <section className="field">
          <label htmlFor="cx-max-pages">Max pages to fetch</label>
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
          <label htmlFor="cx-job-role">Job role</label>
          <input
            id="cx-job-role"
            type="text"
            value={jobRole}
            onChange={(e) => setJobRole(e.target.value)}
            disabled={running}
          />
        </section>
        <section className="field">
          <label htmlFor="cx-resume-id">Resume file ID</label>
          <input
            id="cx-resume-id"
            type="text"
            value={resumeId}
            onChange={(e) => setResumeId(e.target.value)}
            disabled={running}
          />
        </section>
        <section className="field">
          <label htmlFor="cx-interval">Email interval (days)</label>
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

      <section className="field">
        <label htmlFor="cx-cloudinary-url">Cloudinary link (auto-filled)</label>
        <input
          id="cx-cloudinary-url"
          type="text"
          value={cloudinaryUrl}
          readOnly
          placeholder="Filled in automatically after stage 1"
        />
      </section>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button className="primary-btn" onClick={handleCreate} disabled={running}>
          {running && <span className="spinner" aria-hidden="true" />}
          {running ? "Working..." : "Create"}
        </button>
      </div>

      <ul className="stage-list">
        {STAGE_LABELS.map((label, i) => (
          <li key={label} className={`stage stage-${stageStatuses[i]}`}>
            <span className="stage-icon" aria-hidden="true" />
            <span className="stage-label">{label}</span>
            <span className="stage-status">
              {stageStatuses[i] === "done" && "Completed"}
              {stageStatuses[i] === "running" && "In progress..."}
              {stageStatuses[i] === "error" && "Failed"}
              {stageStatuses[i] === "pending" && "Pending"}
            </span>
          </li>
        ))}
      </ul>

      {rows.length > 0 && (
        <>
          <div className="actions">
            <span className="count">
              {leads.length} lead{leads.length === 1 ? "" : "s"} collected
            </span>
            <button className="primary-btn" onClick={handleDownload}>
              Download outreach_contacts.xlsx
            </button>
          </div>

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
            {rows.length > 25 && (
              <p className="hint">Showing first 25 of {rows.length} rows.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default CombinedTab;
