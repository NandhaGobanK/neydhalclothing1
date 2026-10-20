/**
 * Client-side high-fidelity image compression and resizing.
 * Prevents localStorage QuotaExceeded errors and Firestore 1MB document size limits
 * by optimizing raw camera/device uploads before storing.
 */
export async function compressImage(
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If it's a vector SVG, keep as is
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate proportional aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }

        // Apply smooth bilinear interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Compress to JPEG for photos or PNG for transparent logos if small
        const isPng = file.type === 'image/png' && width <= 400;
        const outputMime = isPng ? 'image/png' : 'image/jpeg';

        if (outputMime === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        let currentQuality = quality;
        let compressedDataUrl = canvas.toDataURL(outputMime, currentQuality);

        // Adaptive optimization: if data URL is greater than 250KB, progressively reduce quality and size
        if (compressedDataUrl.length > 250000 && outputMime === 'image/jpeg') {
          currentQuality = 0.6;
          compressedDataUrl = canvas.toDataURL(outputMime, currentQuality);
        }

        if (compressedDataUrl.length > 250000) {
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
            compressedDataUrl = smallCanvas.toDataURL('image/jpeg', 0.58);
          }
        }

        resolve(compressedDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}
