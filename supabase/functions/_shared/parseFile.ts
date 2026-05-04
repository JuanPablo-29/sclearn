import { resolvePDFJS } from "https://esm.sh/pdfjs-serverless@0.4.2";

function cleanText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** PDF text only; images are handled in upload-notes via direct Vision. */
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
      return "";
    }

    console.error("parseFileToText: unsupported type", type);
    return "";
  } catch (err) {
    console.error("parseFileToText failed:", err);
    return "";
  }
}
