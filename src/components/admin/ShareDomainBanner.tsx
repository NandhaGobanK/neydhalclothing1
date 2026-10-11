import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { getPublicStoreUrl } from '../../utils/upi';
import {
  Share2,
  Copy,
  Check,
  MessageCircle,
  Instagram,
  Facebook,
  Smartphone,
  ExternalLink,
  Globe,
  QrCode,
} from 'lucide-react';

interface ShareDomainBannerProps {
  onOpenDetailedModal?: () => void;
  className?: string;
}

export const ShareDomainBanner: React.FC<ShareDomainBannerProps> = ({
  onOpenDetailedModal,
  className = '',
}) => {
  const { settings } = useStore();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedInstagram, setCopiedInstagram] = useState(false);

  const storeUrl = getPublicStoreUrl(settings) || (typeof window !== 'undefined' ? window.location.origin : '');
  const boutiqueName = settings.boutiqueName || 'Heritage Saree Boutique';
  const tagline = settings.tagline || 'Exquisite Handcrafted Handloom Sarees';

  const defaultShareMessage = `Namaste! 🙏✨\nExplore authentic handcrafted sarees and exquisite handlooms at *${boutiqueName}*.\n\n${tagline}\n\n🛍️ Browse our latest collection & order online:\n👉 ${storeUrl}\n\n📦 Insured Express Delivery across India.`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = storeUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleWhatsAppShare = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(defaultShareMessage)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleFacebookShare = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storeUrl)}&quote=${encodeURIComponent(`Discover authentic handloom sarees at ${boutiqueName} ✨`)}`;
    window.open(fbUrl, '_blank', 'noopener,noreferrer');
  };

  const handleInstagramShare = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopiedInstagram(true);
      setTimeout(() => setCopiedInstagram(false), 3000);
    } catch {
      setCopiedInstagram(true);
      setTimeout(() => setCopiedInstagram(false), 3000);
    }

    if (settings.instagramHandle) {
      const cleanHandle = settings.instagramHandle.replace(/^@/, '');
      window.open(`https://www.instagram.com/${cleanHandle}/`, '_blank', 'noopener,noreferrer');
    } else {
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: boutiqueName,
          text: defaultShareMessage,
          url: storeUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-950 via-neutral-900 to-neutral-950 text-white p-4 sm:p-5 border border-amber-500/30 shadow-md ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Info & Link */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
              <Share2 className="w-3 h-3 text-amber-400" />
              <span>Share Store with Customers</span>
            </span>
            <span className="text-[11px] text-neutral-400 font-medium">
              Live Public Catalog
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-serif font-bold text-white">
              {boutiqueName} Store Link
            </h3>
            <span className="font-mono text-xs text-amber-200/90 truncate max-w-xs sm:max-w-md bg-neutral-950/60 px-2.5 py-1 rounded-lg border border-neutral-800">
              {storeUrl}
            </span>
          </div>

          <p className="text-xs text-neutral-300 max-w-xl font-light">
            Send this public domain link to customers so they can view sarees, select weaves, track orders, and checkout.
          </p>
        </div>

        {/* Right: Instant Share Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {/* WhatsApp */}
          <button
            onClick={handleWhatsAppShare}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Share store link on WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>

          {/* Instagram */}
          <button
            onClick={handleInstagramShare}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Copy link for Instagram Story / Bio / DM"
          >
            <Instagram className="w-4 h-4" />
            <span>{copiedInstagram ? 'Copied & Open IG' : 'Instagram'}</span>
          </button>

          {/* Facebook */}
          <button
            onClick={handleFacebookShare}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Share store link on Facebook"
          >
            <Facebook className="w-4 h-4" />
            <span className="hidden sm:inline">Facebook</span>
          </button>

          {/* In-built Apps / Native Share */}
          <button
            onClick={handleNativeShare}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold shadow-xs transition cursor-pointer"
            title="Share via device's in-built apps"
          >
            <Smartphone className="w-4 h-4" />
            <span>Phone Apps</span>
          </button>

          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium border border-neutral-700 transition cursor-pointer"
            title="Copy domain URL"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-neutral-300" />}
            <span>{copiedLink ? 'Copied' : 'Copy'}</span>
          </button>

          {/* More / QR Modal */}
          {onOpenDetailedModal && (
            <button
              onClick={onOpenDetailedModal}
              className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-amber-300 border border-neutral-700 transition cursor-pointer"
              title="Open QR Code and full sharing options"
            >
              <QrCode className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
