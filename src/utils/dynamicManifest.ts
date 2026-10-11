/**
 * Utility to dynamically update document title and meta tags
 * while preserving the valid HTTP(S) PWA manifest for browser installation.
 */
import { StoreSettings } from '../types/store';

export function syncPWAAndDocumentMetadata(settings: Partial<StoreSettings>) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const boutiqueName = settings.boutiqueName?.trim() || 'Neydhal Clothing';
  const tagline = settings.tagline?.trim() || 'Pure Silk & Handcrafted Heirlooms';
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
}
