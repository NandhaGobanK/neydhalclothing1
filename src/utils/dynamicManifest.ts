/**
 * Utility to dynamically update PWA manifest, document title, and meta tags
 * so that installed PWAs and browser tabs always reflect the store's current name and branding.
 */
import { StoreSettings } from '../types/store';

export function syncPWAAndDocumentMetadata(settings: Partial<StoreSettings>) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const boutiqueName = settings.boutiqueName?.trim() || 'Neydhal';
  const tagline = settings.tagline?.trim() || 'Pure Silk & Handcrafted Heirlooms of India';
  const logoUrl = settings.logoUrl?.trim() || '/pwa-512x512.png';
  const theme = settings.theme || 'maroon';

  // 1. Update Document Title
  const pageTitle = `${boutiqueName} — ${tagline}`;
  document.title = pageTitle;

  // 2. Update Meta Tags
  const updateMeta = (nameOrProp: string, content: string, isProperty = false) => {
    let el = document.querySelector(
      isProperty ? `meta[property="${nameOrProp}"]` : `meta[name="${nameOrProp}"]`
    );
    if (!el) {
      el = document.createElement('meta');
      if (isProperty) {
        el.setAttribute('property', nameOrProp);
      } else {
        el.setAttribute('name', nameOrProp);
      }
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  updateMeta('description', `${boutiqueName}: ${tagline}. Exquisite handcrafted sarees with instant UPI payment and direct boutique concierge.`);
  updateMeta('og:title', boutiqueName, true);
  updateMeta('og:description', tagline, true);
  updateMeta('apple-mobile-web-app-title', boutiqueName.slice(0, 20));

  // Theme color based on settings
  const themeColor = theme === 'emerald' ? '#064e3b' : theme === 'sapphire' ? '#1e1b4b' : '#831843';
  updateMeta('theme-color', themeColor);

  // 3. Dynamically Generate & Inject Updated Web App Manifest (Blob URL)
  // This allows browsers (Chromium, Edge, Mobile Safari) to read the user-configured store name for PWA installation
  try {
    const shortName = boutiqueName.length > 12 ? boutiqueName.slice(0, 12).trim() : boutiqueName;
    const icons = [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ];

    // If custom logo exists, prepend it to icon list
    if (logoUrl) {
      icons.unshift({
        src: logoUrl,
        sizes: 'any',
        type: 'image/png',
        purpose: 'any',
      });
    }

    const manifestData = {
      id: '/',
      name: boutiqueName,
      short_name: shortName,
      description: `${boutiqueName}: ${tagline}`,
      theme_color: themeColor,
      background_color: '#fafafa',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      orientation: 'portrait-primary',
      icons,
    };

    const manifestBlob = new Blob([JSON.stringify(manifestData, null, 2)], {
      type: 'application/manifest+json',
    });
    const manifestBlobUrl = URL.createObjectURL(manifestBlob);

    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestBlobUrl;
  } catch (err) {
    console.warn('Failed to dynamically update PWA manifest blob:', err);
  }
}
