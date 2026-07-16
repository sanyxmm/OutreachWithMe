import { useEffect, useState } from "react";
import { stampTopLeft } from "./pdfStamp";
import { uploadToCloudinary } from "./cloudinary";
import InfoCallout from "./InfoCallout";
import { loadDefaultResume } from "./defaultResume";

function PdfTab() {
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    loadDefaultResume().then(setFile).catch(() => {});
  }, []);
  const [dragOver, setDragOver] = useState(false);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  function handleFile(f: File | null) {
    setFile(f);
    setError("");
    setUploadedUrl("");
  }

  async function handleUpload() {
    setError("");
    setUploadedUrl("");
    setCopied(false);
    if (!file) {
      setError("Upload a PDF first.");
      return;
    }
    if (!text.trim()) {
      setError("Enter the text to stamp on the PDF.");
      return;
    }
    setUploading(true);
    try {
      const bytes = await stampTopLeft(file, text);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const outName = file.name.replace(/\.pdf$/i, "") + "_stamped.pdf";
      const result = await uploadToCloudinary(blob, outName);
      setUploadedUrl(result.secure_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCopy() {
    if (!uploadedUrl) return;
    await navigator.clipboard.writeText(uploadedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="tab-panel">
      <InfoCallout>
        Upload a single-page PDF, add a line of text, and it's stamped in a 4cm × 2.5cm box
        in the top-left corner at 1pt font size. Overflow spills into a second same-size box
        in the top-right corner; anything past that is truncated. The stamped file uploads
        straight to Cloudinary and you get a shareable link back.
      </InfoCallout>

      <label className="rl-field-label" htmlFor="pdf-file">
        PDF file
      </label>
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
          id="pdf-file"
          type="file"
          accept="application/pdf"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          hidden
        />
        <span className="rl-dropzone-icon">⬆</span>
        <span className="rl-dropzone-text">Click to upload or drag and drop</span>
        <span className="hint">Single-page PDF files only</span>
        {file && (
          <span className="rl-file-chip">
            📄 {file.name} <span className="check">✓</span>
          </span>
        )}
      </label>

      <section className="field">
        <label htmlFor="pdf-text">Text to add</label>
        <input
          id="pdf-text"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. a name or ID"
        />
      </section>

      {error && <p className="error">{error}</p>}

      <div className="divider" />

      <div className="actions">
        <button className="primary-btn" onClick={handleUpload} disabled={uploading}>
          {uploading && <span className="spinner" aria-hidden="true" />}
          {uploading ? "Uploading..." : "📄 Stamp & upload PDF"}
        </button>
        <span className="trust-note">🛡 Secure upload to Cloudinary</span>
      </div>

      {uploadedUrl && (
        <section className="upload-result">
          <a href={uploadedUrl} target="_blank" rel="noreferrer" className="upload-link">
            {uploadedUrl}
          </a>
          <button className="link-btn" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </section>
      )}
    </div>
  );
}

export default PdfTab;
