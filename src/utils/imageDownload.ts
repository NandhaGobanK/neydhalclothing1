import JSZip from 'jszip';

/**
 * Downloads a single image by URL, fetching as Blob to avoid CORS/new-tab issues
 * and preserving high resolution.
 */
export async function downloadSingleImage(imageUrl: string, filename?: string): Promise<boolean> {
  try {
    const defaultName = filename || `boutique_product_${Date.now()}.jpg`;
    
    // Attempt fetch to get blob (ensures download trigger instead of browser navigating)
    const response = await fetch(imageUrl, { mode: 'cors' });
    if (!response.ok) throw new Error('Fetch failed');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = defaultName.endsWith('.jpg') || defaultName.endsWith('.png') || defaultName.endsWith('.webp')
      ? defaultName
      : `${defaultName}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    return true;
  } catch (err) {
    // Fallback: direct anchor with download attribute or new window
    console.warn('Direct blob fetch failed, falling back to anchor download:', err);
    try {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = filename || 'product_image.jpg';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Downloads all images for a product packaged in a clean .ZIP archive
 */
export async function downloadAllProductImagesZip(
  productTitle: string,
  productCode: string,
  imageUrls: string[],
  onProgress?: (current: number, total: number) => void
): Promise<boolean> {
  if (!imageUrls || imageUrls.length === 0) return false;

  const zip = new JSZip();
  const folderName = `${productCode || 'PRODUCT'}_${productTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(0, 40);
  const folder = zip.folder(folderName) || zip;

  let downloadedCount = 0;
  const total = imageUrls.length;

  const fetchPromises = imageUrls.map(async (url, idx) => {
    try {
      const cleanCode = (productCode || 'sku').replace(/[^a-zA-Z0-9_-]/g, '');
      const imgFileName = `${cleanCode}_photo_${idx + 1}.jpg`;

      const response = await fetch(url, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        folder.file(imgFileName, blob);
      } else {
        // Fallback: try fetching without cors if server allows
        const fallbackRes = await fetch(url);
        const blob = await fallbackRes.blob();
        folder.file(imgFileName, blob);
      }
    } catch (e) {
      console.warn(`Could not include image ${idx + 1} in zip:`, e);
    } finally {
      downloadedCount += 1;
      if (onProgress) onProgress(downloadedCount, total);
    }
  });

  await Promise.all(fetchPromises);

  try {
    const content = await zip.generateAsync({ type: 'blob' });
    const zipBlobUrl = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = zipBlobUrl;
    link.download = `${folderName}_all_photos.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(zipBlobUrl), 2000);
    return true;
  } catch (err) {
    console.error('Error creating ZIP archive, downloading files individually:', err);
    // Fallback: download each image one by one
    for (let i = 0; i < imageUrls.length; i++) {
      const cleanCode = (productCode || 'sku').replace(/[^a-zA-Z0-9_-]/g, '');
      await downloadSingleImage(imageUrls[i], `${cleanCode}_photo_${i + 1}.jpg`);
      await new Promise((r) => setTimeout(r, 400));
    }
    return true;
  }
}
