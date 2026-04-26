import { resolvePDFJS } from "https://esm.sh/pdfjs-serverless@0.4.2";
import Tesseract from "https://cdn.jsdelivr.net/npm/tesseract.js@5/+esm";

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
    const { getDocument, GlobalWorkerOptions } = await resolvePDFJS();
    GlobalWorkerOptions.workerSrc = undefined;
    const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;

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
