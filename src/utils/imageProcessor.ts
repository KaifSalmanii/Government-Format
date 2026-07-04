import { PDFDocument } from 'pdf-lib';

export interface ProcessResult {
  blob: Blob;
  originalSizeKB: number;
  processedSizeKB: number;
  width: number;
  height: number;
  dpi: number;
  format: string;
}

// ─── Main Processing Function ───────────────────────────────────────────────

export async function processImage(
  file: File,
  requirements: {
    widthPx: number;
    heightPx: number;
    maxSizeKB: number;
    minSizeKB?: number;
    format: string;
    dpi: number;
    autoDetectContent?: boolean;
  }
): Promise<ProcessResult> {
  const originalSizeKB = Math.round(file.size / 1024);
  const img = await loadImage(file);
  const { widthPx, heightPx, maxSizeKB, format, dpi, autoDetectContent } = requirements;

  // Step 1: If auto-detect content (for signatures), find content bounds first
  let sourceX = 0,
    sourceY = 0,
    sourceW = img.naturalWidth,
    sourceH = img.naturalHeight;

  if (autoDetectContent) {
    const bounds = detectContentBounds(img);
    if (bounds) {
      // Add some padding around the detected content
      const padX = Math.max(bounds.width * 0.1, 20);
      const padY = Math.max(bounds.height * 0.1, 20);
      sourceX = Math.max(0, bounds.x - padX);
      sourceY = Math.max(0, bounds.y - padY);
      sourceW = Math.min(img.naturalWidth - sourceX, bounds.width + padX * 2);
      sourceH = Math.min(img.naturalHeight - sourceY, bounds.height + padY * 2);
    }
  }

  // Step 2: Calculate cover-fit crop to match target aspect ratio
  const targetRatio = widthPx / heightPx;
  const sourceRatio = sourceW / sourceH;

  let cropX = sourceX,
    cropY = sourceY,
    cropW = sourceW,
    cropH = sourceH;

  if (sourceRatio > targetRatio) {
    // Source is wider — crop sides
    cropW = sourceH * targetRatio;
    cropX = sourceX + (sourceW - cropW) / 2;
  } else {
    // Source is taller — crop top/bottom
    cropH = sourceW / targetRatio;
    cropY = sourceY + (sourceH - cropH) / 2;
  }

  // Step 3: Draw to canvas at exact target dimensions
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d')!;

  // Fill with white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Draw the cropped image
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, widthPx, heightPx);

  // Step 4: Compress to meet size requirements
  const maxBytes = maxSizeKB * 1024;
  const mimeType = format || 'image/jpeg';
  const blob = await compressToSize(canvas, maxBytes, mimeType);

  // Step 5: Set DPI metadata in JPEG
  let finalBlob = blob;
  if (mimeType === 'image/jpeg' && dpi) {
    const buffer = await blob.arrayBuffer();
    const modifiedBuffer = setJpegDpi(buffer, dpi);
    finalBlob = new Blob([modifiedBuffer], { type: 'image/jpeg' });
  }

  const processedSizeKB = Math.round(finalBlob.size / 1024);

  return {
    blob: finalBlob,
    originalSizeKB,
    processedSizeKB,
    width: widthPx,
    height: heightPx,
    dpi,
    format: mimeType,
  };
}

// ─── Content Detection (for signatures) ─────────────────────────────────────

function detectContentBounds(
  img: HTMLImageElement
): { x: number; y: number; width: number; height: number } | null {
  const canvas = document.createElement('canvas');
  // Scale down for performance
  const maxDim = 800;
  const scale = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 1);
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0;
  const threshold = 230;
  let foundContent = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx],
        g = data[idx + 1],
        b = data[idx + 2];
      // Detect non-white pixels
      if (r < threshold || g < threshold || b < threshold) {
        foundContent = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!foundContent) return null;

  // Scale back to original image coordinates
  return {
    x: Math.round(minX / scale),
    y: Math.round(minY / scale),
    width: Math.round((maxX - minX + 1) / scale),
    height: Math.round((maxY - minY + 1) / scale),
  };
}

// ─── Compression ────────────────────────────────────────────────────────────

async function compressToSize(
  canvas: HTMLCanvasElement,
  maxBytes: number,
  mimeType: string
): Promise<Blob> {
  // Try high quality first
  let quality = 0.92;
  let blob = await canvasToBlob(canvas, mimeType, quality);

  if (blob.size <= maxBytes) return blob;

  // Binary search for the right quality level
  let low = 0.05;
  let high = 0.92;
  let bestBlob = blob;

  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2;
    blob = await canvasToBlob(canvas, mimeType, mid);

    if (blob.size <= maxBytes) {
      bestBlob = blob;
      low = mid; // Try higher quality
    } else {
      high = mid; // Need lower quality
    }
  }

  // Final check at low quality
  if (bestBlob.size > maxBytes) {
    bestBlob = await canvasToBlob(canvas, mimeType, low);
  }

  return bestBlob;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      mimeType,
      quality
    );
  });
}

// ─── JPEG DPI Metadata ──────────────────────────────────────────────────────

function setJpegDpi(jpegBuffer: ArrayBuffer, dpi: number): ArrayBuffer {
  const original = new Uint8Array(jpegBuffer);

  // Create JFIF APP0 segment with DPI info
  const jfifSegment = createJfifSegment(dpi);

  // Find insert position (after SOI marker) and check for existing APP0
  let insertPos = 2; // After SOI (FFD8)
  let skipLen = 0;

  // Check if there's already an APP0 marker (FFE0)
  if (
    original.length > 4 &&
    original[2] === 0xff &&
    original[3] === 0xe0
  ) {
    // Skip the existing APP0 segment
    const segLen = (original[4] << 8) | original[5];
    skipLen = 2 + segLen; // marker (2) + segment data
  }

  // Build result: SOI + our JFIF + rest of JPEG
  const result = new Uint8Array(
    insertPos + jfifSegment.length + (original.length - insertPos - skipLen)
  );
  result.set(original.subarray(0, insertPos), 0);
  result.set(jfifSegment, insertPos);
  result.set(
    original.subarray(insertPos + skipLen),
    insertPos + jfifSegment.length
  );

  return result.buffer;
}

function createJfifSegment(dpi: number): Uint8Array {
  const segment = new Uint8Array(18);
  let o = 0;
  segment[o++] = 0xff; // Marker high byte
  segment[o++] = 0xe0; // APP0 marker low byte
  segment[o++] = 0x00; // Length high byte
  segment[o++] = 0x10; // Length low byte (16)
  segment[o++] = 0x4a; // 'J'
  segment[o++] = 0x46; // 'F'
  segment[o++] = 0x49; // 'I'
  segment[o++] = 0x46; // 'F'
  segment[o++] = 0x00; // Null terminator
  segment[o++] = 0x01; // Version major
  segment[o++] = 0x02; // Version minor
  segment[o++] = 0x01; // Density units: 1 = DPI
  segment[o++] = (dpi >> 8) & 0xff; // X density high
  segment[o++] = dpi & 0xff; // X density low
  segment[o++] = (dpi >> 8) & 0xff; // Y density high
  segment[o++] = dpi & 0xff; // Y density low
  segment[o++] = 0x00; // Thumbnail width
  segment[o++] = 0x00; // Thumbnail height
  return segment;
}

// ─── Image Loading ──────────────────────────────────────────────────────────

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

// ─── File Preview ───────────────────────────────────────────────────────────

export function getFilePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── PDF Processing ─────────────────────────────────────────────────────────

export async function imagesToPdf(
  files: File[]
): Promise<ProcessResult> {
  const totalOriginalKB = files.reduce((sum, f) => sum + Math.round(f.size / 1024), 0);
  const pdfDoc = await PDFDocument.create();

  for (const file of files) {
    const imgBytes = new Uint8Array(await file.arrayBuffer());

    let embeddedImage;
    if (file.type === 'image/png') {
      embeddedImage = await pdfDoc.embedPng(imgBytes);
    } else {
      embeddedImage = await pdfDoc.embedJpg(imgBytes);
    }

    const imgWidth = embeddedImage.width;
    const imgHeight = embeddedImage.height;

    // A4 page size at 200 DPI: 595 × 842 points
    const pageWidth = 595;
    const pageHeight = 842;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Scale image to fit page with margins
    const margin = 40;
    const availW = pageWidth - margin * 2;
    const availH = pageHeight - margin * 2;
    const scale = Math.min(availW / imgWidth, availH / imgHeight, 1);
    const drawW = imgWidth * scale;
    const drawH = imgHeight * scale;

    // Center on page
    const x = (pageWidth - drawW) / 2;
    const y = (pageHeight - drawH) / 2;

    page.drawImage(embeddedImage, { x, y, width: drawW, height: drawH });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });

  // If still too large, we can't do much without heavier compression
  // But for most cases, the embedded images should be within limits
  const processedSizeKB = Math.round(blob.size / 1024);

  return {
    blob,
    originalSizeKB: totalOriginalKB,
    processedSizeKB,
    width: 595,
    height: 842,
    dpi: 200,
    format: 'application/pdf',
  };
}

export async function checkPdfSize(file: File): Promise<{
  isValid: boolean;
  sizeKB: number;
  pageCount: number;
}> {
  const sizeKB = Math.round(file.size / 1024);
  const arrayBuffer = await file.arrayBuffer();

  try {
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();
    return { isValid: true, sizeKB, pageCount };
  } catch {
    return { isValid: false, sizeKB, pageCount: 0 };
  }
}

// ─── Download Helper ────────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
                  }
