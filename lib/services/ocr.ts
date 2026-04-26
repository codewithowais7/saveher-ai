import Tesseract from "tesseract.js";

/**
 * Extract text from an image file using Tesseract.js OCR.
 * Safe to use only in browser (Client Components / client-side hooks).
 *
 * @param imageFile - The image File object to process
 * @returns Extracted text string, or empty string on failure
 */
export async function extractTextFromImage(imageFile: File): Promise<string> {
  try {
    const imageUrl = URL.createObjectURL(imageFile);

    const result = await Tesseract.recognize(imageUrl, "eng", {
      // Suppress Tesseract's own verbose logger in production
      logger: () => {},
    });

    URL.revokeObjectURL(imageUrl);

    return result.data.text.trim();
  } catch (error) {
    console.error("[OCR] extractTextFromImage → failed:", error);
    return "";
  }
}

/**
 * Pre-process an image file before OCR (grayscale conversion via canvas).
 * Returns a new Blob ready for OCR, or the original file on failure.
 *
 * @param imageFile - Raw image file
 */
export async function preprocessImage(imageFile: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(imageFile);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D canvas context");

    ctx.drawImage(bitmap, 0, 0);

    // Convert to grayscale using desaturation filter
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = data[i + 1] = data[i + 2] = avg;
    }
    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
    );

    return blob;
  } catch (error) {
    console.error("[OCR] preprocessImage → failed, returning original:", error);
    return imageFile;
  }
}
