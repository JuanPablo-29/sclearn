// Use browser-only PDF.js build to avoid Node-only imports (`fs`) in Edge runtime.
import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.mjs";
import Tesseract from "https://cdn.jsdelivr.net/npm/tesseract.js@5/+esm";

pdfjsLib.GlobalWorkerOptions.workerSrc = undefined;

function cleanText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export async function parseFileToText(file: File): Promise<string> {
  const type = file.type;

  // PDF extraction
  if (type === "application/pdf") {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items
        .map((item) => ("str" in item ? String(item.str ?? "") : ""))
        .filter(Boolean);
      text += strings.join(" ") + "\n";
    }

    return cleanText(text);
  }

  // OCR for images (typed and basic handwriting)
  if (type.startsWith("image/")) {
    const buffer = await file.arrayBuffer();
    const imageBytes = new Uint8Array(buffer);

    const { data } = await Tesseract.recognize(imageBytes, "eng", {
      logger: () => {
        // Keep edge logs clean for now.
      },
    });

    return cleanText(data.text ?? "");
  }

  throw new Error("Unsupported file type");
}
