import mammoth from "mammoth";

export class UnreadableResumeError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "UnreadableResumeError";
  }
}

export async function extractResumeText(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const lower = filename.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf");
  const isDocx =
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx");

  if (!isPdf && !isDocx) {
    throw new UnreadableResumeError(
      `Unsupported file type "${filename}". Please upload a PDF or DOCX resume.`
    );
  }

  try {
    if (isDocx) {
      const { value } = await mammoth.extractRawText({ buffer });
      const text = value.trim();
      if (!text) {
        throw new UnreadableResumeError(
          "The DOCX file contained no extractable text (it may be empty or image-only)."
        );
      }
      return text;
    }

    // pdf-parse v2 exposes a PDFParse class rather than a default function.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    const text = result.text.trim();
    if (!text) {
      throw new UnreadableResumeError(
        "The PDF contained no extractable text. It may be a scanned image without a text layer — try exporting a text-based PDF or a DOCX instead."
      );
    }
    return text;
  } catch (err) {
    if (err instanceof UnreadableResumeError) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    throw new UnreadableResumeError(
      `Could not read "${filename}" (${detail}). The file may be corrupted, password-protected, or in an unexpected format.`
    );
  }
}
