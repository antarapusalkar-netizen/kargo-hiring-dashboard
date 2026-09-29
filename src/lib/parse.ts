import mammoth from "mammoth";

/**
 * pdfjs-dist (used internally by pdf-parse) instantiates `new DOMMatrix()` at
 * module scope, unconditionally, even for plain text extraction. DOMMatrix is
 * a browser API with no Node equivalent — pdfjs-dist tries to polyfill it via
 * @napi-rs/canvas's native binary, but that silently fails in some serverless
 * runtimes (observed on Vercel), leaving `DOMMatrix` undefined and the whole
 * module import throwing `ReferenceError: DOMMatrix is not defined`. Polyfill
 * it ourselves with a small pure-JS implementation (no native binary, so no
 * platform-specific build/runtime mismatch) before pdf-parse is ever loaded.
 */
async function ensureDomMatrixPolyfill() {
  if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix !== "undefined") {
    return;
  }
  const DOMMatrixPolyfill = (await import("dommatrix")).default;
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = DOMMatrixPolyfill;
}

/**
 * pdfjs-dist also needs a `Path2D` global (used when building glyph outlines
 * for fonts without a proper ToUnicode CMap) — same @napi-rs/canvas-native-
 * binary polyfill that silently fails on Vercel ("Warning: Cannot polyfill
 * 'Path2D', rendering may be broken", seen in Vercel's runtime logs), which
 * left some characters mis-decoded (observed: a stray "•" appearing in
 * extracted resume text that isn't in the source PDF). Polyfill with the
 * pure-JS `path2d` package for the same reason as DOMMatrix above.
 */
async function ensurePath2DPolyfill() {
  if (typeof (globalThis as { Path2D?: unknown }).Path2D !== "undefined") {
    return;
  }
  const { Path2D } = await import("path2d");
  (globalThis as { Path2D?: unknown }).Path2D = Path2D;
}

/**
 * In Node, pdfjs-dist runs parsing on the "main thread" instead of a real Web
 * Worker, by dynamically `import()`-ing its own worker module at runtime
 * (`GlobalWorkerOptions.workerSrc`, a relative path). Some bundlers/serverless
 * platforms (observed on Vercel) don't trace that dynamic import and the file
 * is missing from the deployed function, throwing
 * `Setting up fake worker failed: "Cannot find module '.../pdf.worker.mjs'"`.
 * Importing the worker module ourselves and exposing it as `globalThis.pdfjsWorker`
 * lets pdfjs-dist find it directly and skip that fragile dynamic import path.
 */
async function ensurePdfWorkerGlobal() {
  if (
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker !== undefined
  ) {
    return;
  }
  const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = workerModule;
}

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
    await ensureDomMatrixPolyfill();
    await ensurePath2DPolyfill();
    await ensurePdfWorkerGlobal();
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
