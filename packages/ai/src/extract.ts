/**
 * Upload validation and text extraction for script documents.
 * Validation checks size, extension AND file signature (magic bytes); the
 * client-declared MIME type is never trusted on its own.
 */
export const MAX_SCRIPT_BYTES = 15 * 1024 * 1024;
export const MAX_SCRIPT_CHARS = 1_500_000;

export type ScriptSourceKind = "pasted" | "txt" | "fountain" | "pdf" | "docx";

const EXT_KIND: Record<string, ScriptSourceKind> = {
  txt: "txt",
  text: "txt",
  fountain: "fountain",
  spmd: "fountain",
  pdf: "pdf",
  docx: "docx",
};

export const KIND_MIME: Record<ScriptSourceKind, string> = {
  pasted: "text/plain",
  txt: "text/plain",
  fountain: "text/plain",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export class UploadRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadRejectedError";
  }
}

export function detectScriptKind(filename: string, bytes: Uint8Array): ScriptSourceKind {
  if (bytes.byteLength === 0) throw new UploadRejectedError("The file is empty.");
  if (bytes.byteLength > MAX_SCRIPT_BYTES) throw new UploadRejectedError("The file is larger than 15 MB.");
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const kind = EXT_KIND[ext];
  if (!kind) throw new UploadRejectedError("Unsupported file type. Upload PDF, DOCX, TXT or Fountain.");

  const head = Buffer.from(bytes.subarray(0, 8));
  if (kind === "pdf" && head.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new UploadRejectedError("This file does not look like a valid PDF.");
  }
  if (kind === "docx" && !(head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04)) {
    throw new UploadRejectedError("This file does not look like a valid DOCX document.");
  }
  if (kind === "txt" || kind === "fountain") {
    const sample = Buffer.from(bytes.subarray(0, 4096));
    if (sample.includes(0)) throw new UploadRejectedError("This text file contains binary data.");
    if (new TextDecoder("utf-8", { fatal: false }).decode(sample).includes("�")) {
      throw new UploadRejectedError("Text files must be UTF-8 encoded.");
    }
  }
  return kind;
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export async function extractText(kind: ScriptSourceKind, bytes: Uint8Array): Promise<string> {
  let text: string;
  switch (kind) {
    case "pasted":
    case "txt":
    case "fountain":
      text = new TextDecoder("utf-8").decode(bytes);
      break;
    case "pdf": {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(bytes) });
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy();
      }
      break;
    }
    case "docx": {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      text = result.value;
      break;
    }
  }
  text = normalizeText(text);
  if (!text) throw new UploadRejectedError("No readable text was found in this document. Scanned PDFs need OCR first.");
  if (text.length > MAX_SCRIPT_CHARS) throw new UploadRejectedError("The script text is too long.");
  return text;
}
