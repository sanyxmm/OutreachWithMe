import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

export async function extractEmailFromPdf(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    const matches = text.match(EMAIL_RE);
    if (matches && matches.length > 0) return matches[0];
  }
  return "";
}
