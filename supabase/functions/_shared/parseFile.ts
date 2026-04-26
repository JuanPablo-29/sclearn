import { Buffer } from "node:buffer";
import pdf from "https://esm.sh/pdf-parse@1.1.1";
import Tesseract from "https://esm.sh/tesseract.js@5";

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
    const data = await pdf(Buffer.from(buffer));
    return cleanText(data.text ?? "");
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
