import imageCompression from 'browser-image-compression';

/**
 * Client-side image compression and resizing utility using HTML5 Canvas & browser-image-compression.
 * Ensures uploaded images strictly fit within Firestore and Firebase Storage limits
 * while preserving critical text readability (UTR numbers, dates, amounts).
 */

export interface CompressedScreenshotResult {
  file: File;
  previewUrl: string;
  originalSizeKB: number;
  compressedSizeKB: number;
  reductionPercentage: number;
  width: number;
  height: number;
  mimeType: string;
}

/**
 * Compresses customer payment receipt screenshots using browser-image-compression.
 * Targets: 150KB - 200KB (Max 0.2MB), 800px-1000px dimensions, WebP or JPEG,
 * with high clarity preservation for 12-digit UTR numbers, amounts, and timestamps.
 */
export async function compressPaymentScreenshot(
  file: File
): Promise<CompressedScreenshotResult> {
  const originalSizeKB = Math.round(file.size / 1024);
  const isWebp = file.type.includes('webp');
  const targetMime = isWebp ? 'image/webp' : 'image/jpeg';

  const options = {
    maxSizeMB: 0.19, // ~190 KB (strictly within 150 KB to 200 KB target)
    maxWidthOrHeight: 1000, // 800px to 1000px max dimensions
    useWebWorker: true,
    fileType: targetMime,
    initialQuality: 0.85, // Sharp high-contrast text preservation
  };

  let compressedFile: File;
  try {
    compressedFile = await imageCompression(file, options);
  } catch (workerErr) {
    console.warn('Worker image compression failed, falling back to main thread:', workerErr);
    try {
      compressedFile = await imageCompression(file, { ...options, useWebWorker: false });
    } catch (fallbackErr) {
      console.warn('browser-image-compression fallback to canvas:', fallbackErr);
      const dataUrl = await compressImageFile(file, {
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 0.8,
        mimeType: 'image/jpeg',
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', {
        type: 'image/jpeg',
      });
    }
  }

  // Ensure file does not exceed 200 KB
  if (compressedFile.size > 200 * 1024) {
    try {
      compressedFile = await imageCompression(compressedFile, {
        maxSizeMB: 0.17,
        maxWidthOrHeight: 900,
        useWebWorker: false,
        fileType: targetMime,
        initialQuality: 0.78,
      });
    } catch {}
  }

  const compressedSizeKB = Math.round(compressedFile.size / 1024);
  const reductionPercentage =
    originalSizeKB > 0
      ? Math.max(0, Math.round(((originalSizeKB - compressedSizeKB) / originalSizeKB) * 100))
      : 0;

  // Generate data URL preview and extract dimensions
  const previewUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(compressedFile);
  });

  const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = previewUrl;
  });

  return {
    file: compressedFile,
    previewUrl,
    originalSizeKB,
    compressedSizeKB,
    reductionPercentage,
    width,
    height,
    mimeType: compressedFile.type || targetMime,
  };
}

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png';
}

export function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const {
    maxWidth = 1000,
    maxHeight = 1000,
    quality = 0.75,
    mimeType = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    // If it's an SVG file, keep as text data URL without canvas rasterization
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read SVG file'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate proportional scale
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to raw data url if canvas unsupported
          resolve(e.target?.result as string);
          return;
        }

        // Fill background with white for JPEG transparency preservation
        if (mimeType === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL(mimeType, quality);
        if (dataUrl.length > 250000 && mimeType === 'image/jpeg') {
          dataUrl = canvas.toDataURL(mimeType, 0.6);
        }
        if (dataUrl.length > 250000) {
          const smallCanvas = document.createElement('canvas');
          const sWidth = Math.round(width * 0.75);
          const sHeight = Math.round(height * 0.75);
          smallCanvas.width = sWidth;
          smallCanvas.height = sHeight;
          const sCtx = smallCanvas.getContext('2d');
          if (sCtx) {
            sCtx.fillStyle = '#ffffff';
            sCtx.fillRect(0, 0, sWidth, sHeight);
            sCtx.drawImage(canvas, 0, 0, sWidth, sHeight);
            dataUrl = smallCanvas.toDataURL('image/jpeg', 0.58);
          }
        }

        resolve(dataUrl);
      };

      img.onerror = () => {
        reject(new Error('Failed to decode image file'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
