import { resolvePDFJS } from "https://esm.sh/pdfjs-serverless@0.4.2";
import Tesseract from "https://cdn.jsdelivr.net/npm/tesseract.js@5/+esm";

function cleanText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export async function parseFileToText(
  file: File,
  mimeType?: string
): Promise<string> {
  try {
    const type = (mimeType ?? file.type).trim();

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

    if (type.startsWith("image/")) {
      try {
        const result = await Tesseract.recognize(file, "eng", {
          logger: () => {
            // Keep edge logs clean for now.
          },
        });
        const text = result?.data?.text || "";

        console.log("OCR length:", text.length);

        return cleanText(text);
      } catch (err) {
        console.error("OCR failed:", err);
        return "";
      }
    }

    console.error("parseFileToText: unsupported type", type);
    return "";
  } catch (err) {
    console.error("parseFileToText failed:", err);
    return "";
  }
}
