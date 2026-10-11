import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { getPublicStoreUrl } from '../../utils/upi';
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Instagram,
  Facebook,
  Smartphone,
  QrCode,
  X,
  Globe,
  Sparkles,
} from 'lucide-react';

interface ShareStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareStoreModal: React.FC<ShareStoreModalProps> = ({ isOpen, onClose }) => {
  const { settings } = useStore();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedInstagram, setCopiedInstagram] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

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
      // Fallback
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
    const igMessage = `✨ Explore handcrafted sarees at ${boutiqueName}\n🔗 Store link: ${storeUrl}\n\nDM us to inquire or shop online directly!`;
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
        setShareFeedback('Shared successfully via installed apps!');
        setTimeout(() => setShareFeedback(null), 3000);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
      setShareFeedback('Device share not supported here. Domain link copied to clipboard!');
      setTimeout(() => setShareFeedback(null), 3500);
    }
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(storeUrl)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-neutral-950 via-neutral-900 to-amber-950 text-white p-5 sm:p-6 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Share2 className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-bold tracking-widest text-amber-400 uppercase">
                Customer Sharing Hub
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-white">
              Share Boutique Domain Link
            </h3>
            <p className="text-xs text-neutral-300">
              Send your boutique's live domain link to customers across WhatsApp, Instagram, Facebook, and their device apps.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Active Domain Display with Copy */}
          <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-600 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-amber-600" />
                <span>Boutique Public URL:</span>
              </span>
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-700 hover:text-amber-900 font-semibold inline-flex items-center gap-1 text-[11px]"
              >
                <span>Visit Store</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={storeUrl}
                className="w-full font-mono text-xs p-2 rounded-lg bg-white border border-neutral-300 text-neutral-900 select-all"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 transition shadow-xs cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Quick Share Channels Grid */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2.5">
              Instant Share Channels
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* WhatsApp */}
              <button
                onClick={handleWhatsAppShare}
                className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-950 flex flex-col items-center justify-center gap-1.5 text-center transition group shadow-xs cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold">WhatsApp</span>
                <span className="text-[10px] text-emerald-700 leading-tight">Direct Chat</span>
              </button>

              {/* Instagram */}
              <button
                onClick={handleInstagramShare}
                className="p-3 rounded-xl border border-pink-200 bg-pink-50/70 hover:bg-pink-100/80 text-pink-950 flex flex-col items-center justify-center gap-1.5 text-center transition group shadow-xs cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 via-rose-600 to-purple-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <Instagram className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold">Instagram</span>
                <span className="text-[10px] text-pink-700 leading-tight">
                  {copiedInstagram ? 'Link Copied!' : 'Bio / Story'}
                </span>
              </button>

              {/* Facebook */}
              <button
                onClick={handleFacebookShare}
                className="p-3 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 text-blue-950 flex flex-col items-center justify-center gap-1.5 text-center transition group shadow-xs cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <Facebook className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold">Facebook</span>
                <span className="text-[10px] text-blue-700 leading-tight">Post / Group</span>
              </button>

              {/* In-built Apps / Native Share */}
              <button
                onClick={handleNativeShare}
                className="p-3 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100/80 text-amber-950 flex flex-col items-center justify-center gap-1.5 text-center transition group shadow-xs cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <Smartphone className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold">In-Built Apps</span>
                <span className="text-[10px] text-amber-700 leading-tight">Phone Apps</span>
              </button>
            </div>
          </div>

          {/* Feedback banner */}
          {shareFeedback && (
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{shareFeedback}</span>
            </div>
          )}

          {/* Message Preview */}
          <div className="p-3.5 bg-neutral-900 text-white rounded-xl space-y-1.5 border border-neutral-800">
            <div className="flex items-center justify-between text-[11px] text-neutral-400 border-b border-neutral-800 pb-1">
              <span className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Pre-Composed Customer Invitation
              </span>
              <span>Ready to Send</span>
            </div>
            <pre className="font-mono text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
              {defaultShareMessage}
            </pre>
          </div>

          {/* Show / Hide QR Code Toggle */}
          <div className="pt-1">
            <button
              onClick={() => setShowQr(!showQr)}
              className="w-full py-2.5 px-3 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-neutral-600" />
              <span>{showQr ? 'Hide Store QR Code' : 'Show Store QR Code (In-Showroom Scan)'}</span>
            </button>

            {showQr && (
              <div className="mt-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-center space-y-2 animate-in fade-in">
                <p className="text-xs font-semibold text-neutral-700">
                  Customers can scan this QR code with their mobile camera to open the store immediately:
                </p>
                <div className="inline-block p-3 bg-white rounded-xl shadow-xs border border-neutral-200">
                  <img
                    src={qrImageUrl}
                    alt={`${boutiqueName} QR Code`}
                    className="w-44 h-44 mx-auto rounded-lg object-contain"
                  />
                </div>
                <p className="text-[11px] text-neutral-500 font-mono">
                  {storeUrl}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500">
            Available on Staff & Admin home dashboards
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-900 text-white font-semibold text-xs hover:bg-neutral-800 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
