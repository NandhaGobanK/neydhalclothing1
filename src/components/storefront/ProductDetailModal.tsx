import React, { useState } from 'react';
import { Product } from '../../types/store';
import { useStore } from '../../context/StoreContext';
import { formatPrice } from '../../utils/upi';
import { parseVideoUrl } from '../../utils/video';
import {
  X,
  ShoppingBag,
  Play,
  Image as ImageIcon,
  CheckCircle,
  Truck,
  ShieldCheck,
  Share2,
  ExternalLink,
} from 'lucide-react';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose }) => {
  const { addToCart, setIsCartOpen, setIsCheckoutOpen } = useStore();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'photos' | 'video'>('photos');
  const [copiedLink, setCopiedLink] = useState(false);

  const videoInfo = parseVideoUrl(product.videoUrl);
  const isOutOfStock = product.stockStatus === 'out_of_stock';

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addToCart(product, 1);
  };

  const handleInstantBuy = () => {
    if (isOutOfStock) return;
    addToCart(product, 1);
    onClose();
    setIsCheckoutOpen(true);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.title,
        text: `Look at this gorgeous ${product.fabric} saree at Aara Heritage Boutique: ${product.title}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-neutral-900/60 hover:bg-neutral-900 text-white transition-colors"
          aria-label="Close details"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left Column: Visual Media Gallery & Video */}
          <div className="bg-neutral-100 flex flex-col justify-between border-b md:border-b-0 md:border-r border-neutral-200">
            {/* Media Tabs if video is available */}
            {videoInfo && (
              <div className="p-3 bg-neutral-900 flex items-center justify-center gap-2">
                <button
                  onClick={() => setActiveTab('photos')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'photos'
                      ? 'bg-amber-500 text-neutral-950'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Saree Photos</span>
                </button>
                <button
                  onClick={() => setActiveTab('video')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'video'
                      ? 'bg-amber-500 text-neutral-950'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Video Preview (Drape)</span>
                </button>
              </div>
            )}

            {/* Media Display Area */}
            <div className="relative aspect-4/5 sm:aspect-square md:aspect-auto md:h-120 bg-neutral-100 flex items-center justify-center overflow-hidden">
              {activeTab === 'video' && videoInfo ? (
                <div className="w-full h-full bg-black flex flex-col items-center justify-center">
                  {videoInfo.type === 'youtube' && videoInfo.embedUrl ? (
                    <iframe
                      src={videoInfo.embedUrl}
                      title={`${product.title} Video Preview`}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : videoInfo.type === 'instagram' && videoInfo.embedUrl ? (
                    <iframe
                      src={videoInfo.embedUrl}
                      title={`${product.title} Instagram Reel`}
                      className="w-full h-full border-0"
                      allowFullScreen
                    />
                  ) : videoInfo.type === 'direct' && videoInfo.embedUrl ? (
                    <video
                      src={videoInfo.embedUrl}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="p-6 text-center text-neutral-300">
                      <p className="text-sm font-semibold mb-2">External Video Preview</p>
                      <a
                        href={videoInfo.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-neutral-950 text-xs font-bold"
                      >
                        <span>Watch on Instagram / YouTube</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <img
                  src={product.images[selectedImageIndex] || product.images[0]}
                  alt={product.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center"
                />
              )}
            </div>

            {/* Thumbnails row if multiple images */}
            {product.images.length > 1 && (
              <div className="p-3 bg-neutral-200/50 flex items-center gap-2 overflow-x-auto">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedImageIndex(idx);
                      setActiveTab('photos');
                    }}
                    className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition shrink-0 ${
                      selectedImageIndex === idx && activeTab === 'photos'
                        ? 'border-rose-900 scale-105'
                        : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Detailed Product Purchase Module */}
          <div className="p-6 sm:p-8 flex flex-col justify-between max-h-[85vh] overflow-y-auto">
            <div>
              {/* Category & Status */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs text-neutral-500 flex-wrap">
                  <span className="text-amber-800 font-bold uppercase tracking-wider text-[11px]">
                    {product.fabric}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{product.color}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded shadow-2xs">
                    Code: {product.productCode}
                  </span>
                </div>
                <button
                  onClick={handleShare}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
                  title="Share Saree Link"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
              {copiedLink && (
                <p className="text-[11px] text-emerald-700 mb-2">Link copied to clipboard!</p>
              )}

              {/* Title & Subtitle */}
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-900 leading-tight mb-2">
                {product.title}
              </h2>
              {product.subtitle && (
                <p className="text-xs sm:text-sm text-neutral-600 mb-4 font-medium italic">
                  {product.subtitle}
                </p>
              )}

              {/* Pricing */}
              <div className="flex items-baseline gap-3 pb-4 mb-4 border-b border-neutral-100">
                <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tabular-nums">
                  {formatPrice(product.price)}
                </span>
                {product.originalPrice && (
                  <span className="text-sm text-neutral-400 line-through tabular-nums">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                  Free Insured Express Delivery
                </span>
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed mb-6">
                {product.description}
              </p>

              {/* Artisan Specification Table */}
              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 mb-6 space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-neutral-200/60 items-center">
                  <span className="text-neutral-500 font-medium">Unique Product Code</span>
                  <span className="font-mono font-bold text-neutral-950 bg-white border border-neutral-300 px-2 py-0.5 rounded text-[11px]">
                    {product.productCode}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-200/60">
                  <span className="text-neutral-500">Weave Technique</span>
                  <span className="font-medium text-neutral-900 text-right">{product.weaveDetails}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-200/60">
                  <span className="text-neutral-500">Border & Pallu</span>
                  <span className="font-medium text-neutral-900 text-right">{product.borderType}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-200/60">
                  <span className="text-neutral-500">Blouse Piece</span>
                  <span className="font-medium text-neutral-900">
                    {product.blousePieceIncluded ? 'Included (0.8m Running Silk)' : 'Not Included'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-200/60">
                  <span className="text-neutral-500">Total Saree Length</span>
                  <span className="font-medium text-neutral-900">{product.lengthMeters} Meters</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">Recommended Occasion</span>
                  <span className="font-medium text-neutral-900">{product.occasion}</span>
                </div>
              </div>

              {/* Trust highlights */}
              <div className="grid grid-cols-2 gap-3 mb-6 text-[11px] text-neutral-600">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Silk Mark Registered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Ships in 24-48 Hours</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Direct Artisan Handloom</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>100% Refund Safeguard</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-neutral-100 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`flex-1 py-3.5 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 border transition ${
                  isOutOfStock
                    ? 'bg-neutral-200 text-neutral-400 border-neutral-300 cursor-not-allowed'
                    : 'border-neutral-900 text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add to Shopping Bag</span>
              </button>

              <button
                onClick={handleInstantBuy}
                disabled={isOutOfStock}
                className={`flex-1 py-3.5 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition ${
                  isOutOfStock
                    ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-amber-500/20'
                }`}
              >
                <span>{isOutOfStock ? 'Currently Sold Out' : 'Prepaid UPI Reservation'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
