// Menu OCR. tesseract.js is heavy, so it's dynamically imported only when the
// user actually scans a photo — paste stays instant and dependency-free.

/** Read text from an image File. Throws on failure so the caller can fall back to paste. */
export async function readMenuImage(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const { default: Tesseract } = await import("tesseract.js");
  const { data } = await Tesseract.recognize(file, "eng", {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text" && onProgress) onProgress(Math.round(m.progress * 100));
    },
  });
  return (data.text || "").trim();
}
