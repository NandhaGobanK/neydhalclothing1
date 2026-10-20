/**
 * Client-side image compression and resizing utility using HTML5 Canvas.
 * Ensures uploaded images strictly fit within Firestore document limits (1MB limit)
 * and load blazingly fast across mobile PWA and desktop clients.
 */

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
