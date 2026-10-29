import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product } from '../../types/store';
import { useStore } from '../../context/StoreContext';
import { formatPrice, calculateDiscount, getProductShareUrl } from '../../utils/upi';
import { parseVideoUrl } from '../../utils/video';
import { isProductInActiveCategories, getCategorySingularName, getCategoryPluralName, isProductRestocked, getRestockRemainingTime } from '../../utils/productValidation';
import { downloadSingleImage, downloadAllProductImagesZip } from '../../utils/imageDownload';
import {
  ArrowLeft,
  ShoppingBag,
  Heart,
  Share2,
  Check,
  CheckCircle,
  Clock,
  Truck,
  ShieldCheck,
  Star,
  Play,
  Instagram,
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  Download,
  Copy,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface ProductDetailPageProps {
  product: Product;
  onBack: () => void;
  onSelectProduct?: (product: Product) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  product: initialProduct,
  onBack,
  onSelectProduct,
}) => {
  const [product, setProduct] = useState<Product>(initialProduct);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'photos' | 'video' | 'shorts'>('photos');
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSku, setCopiedSku] = useState(false);
  const [imageFitMode, setImageFitMode] = useState<'contain' | 'cover'>('cover');
  const [isDownloadingSingle, setIsDownloadingSingle] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Sync state when product prop changes
  useEffect(() => {
    setProduct(initialProduct);
    setSelectedImageIndex(0);
    setActiveTab('photos');
    setQuantity(1);
    setAddedFeedback(false);
  }, [initialProduct.id]);

  const {
    products,
    categories,
    cart,
    addToCart,
    cartCount,
    setIsCartOpen,
    setIsCheckoutOpen,
    settings,
    productAttributes,
    getProductReviews,
    getProductAverageRating,
    addReview,
    wishlist,
    toggleWishlist,
    isInWishlist,
  } = useStore();

  const isDark = settings.themeMode === 'dark';
  const hasRestockTag = isProductRestocked(product);
  const restockTimeLeft = getRestockRemainingTime(product);
  const isOutOfStock =
    product.stockStatus === 'out_of_stock' ||
    (product.stockCount !== undefined && product.stockCount <= 0);
  const maxStock = product.stockCount !== undefined ? Math.max(1, product.stockCount) : 10;
  const inWishlist = isInWishlist(product.id);
  const discount = calculateDiscount(product.price, product.originalPrice);

  const videoInfo = useMemo(() => parseVideoUrl(product.videoUrl), [product.videoUrl]);
  const shortsInfo = useMemo(() => parseVideoUrl(product.instagramShortsUrl), [product.instagramShortsUrl]);

  const itemSingular = getCategorySingularName(product.category);
  const itemPlural = getCategoryPluralName(product.category);

  // Single photo download
  const handleDownloadActiveImage = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentImg = product.images[selectedImageIndex] || product.images[0];
    if (!currentImg) return;
    setIsDownloadingSingle(true);
    const cleanTitle = (product.title || 'product').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${settings.boutiqueName}_${cleanTitle}_${product.productCode || 'sku'}_img${selectedImageIndex + 1}.jpg`;
    await downloadSingleImage(currentImg, filename);
    setIsDownloadingSingle(false);
    setDownloadNotice('Photo downloaded! ✓');
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  // ZIP download for all photos
  const handleDownloadAllZip = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!product.images || product.images.length === 0) return;
    setIsDownloadingZip(true);
    await downloadAllProductImagesZip(product.title, product.productCode, product.images);
    setIsDownloadingZip(false);
    setDownloadNotice(`All ${product.images.length} photos downloaded! ✓`);
    setTimeout(() => setDownloadNotice(null), 3500);
  };

  const handleCopySku = () => {
    if (!product.productCode) return;
    navigator.clipboard.writeText(product.productCode);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  const handleShare = () => {
    const shareUrl = getProductShareUrl(product, settings);
    const offerText = discount.hasDiscount
      ? ` (${discount.discountPercentage}% OFF - Save ${formatPrice(discount.discountAmount)})`
      : '';
    const shareMessage = `Explore ${product.title} at ${settings.boutiqueName}:\nFabric: ${product.fabric || 'Pure Silk'}\nPrice: ${formatPrice(product.price)}${offerText}\n\nView details: ${shareUrl}`;

    if (navigator.share) {
      navigator.share({
        title: `${product.title} - ${settings.boutiqueName}`,
        text: shareMessage,
        url: shareUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareMessage);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addToCart(product, quantity);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2200);
  };

  const handleInstantBuy = () => {
    if (isOutOfStock) return;
    addToCart(product, quantity);
    setIsCheckoutOpen(true);
  };

  // Cross-sell suggestions: active products from current category and store
  const suggestedItems = useMemo(() => {
    const valid = products.filter(
      (p) =>
        p.id !== product.id &&
        p.isVisible !== false &&
        isProductInActiveCategories(p, categories)
    );
    const sameCategory = valid.filter(
      (p) => p.category?.toLowerCase() === product.category?.toLowerCase()
    );
    const otherCategories = valid.filter(
      (p) => p.category?.toLowerCase() !== product.category?.toLowerCase()
    );
    return [...sameCategory, ...otherCategories].slice(0, 12);
  }, [product, products, categories]);

  // Customer Reviews
  const reviews = getProductReviews(product.id);
  const { rating: avgRating, count: reviewCount } = getProductAverageRating(product.id);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newAuthor, setNewAuthor] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newComment, setNewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState(false);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthor.trim() || !newComment.trim()) return;

    try {
      setIsSubmittingReview(true);
      await addReview({
        productId: product.id,
        customerName: newAuthor.trim(),
        city: newCity.trim() || undefined,
        rating: newRating,
        comment: newComment.trim(),
        verifiedBuyer: true,
      });
      setReviewSubmitSuccess(true);
      setShowReviewForm(false);
      setNewAuthor('');
      setNewCity('');
      setNewComment('');
      setTimeout(() => setReviewSubmitSuccess(false), 4000);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="min-h-screen pb-28 bg-neutral-50/70">
      {/* Top Navigation Bar with Clean Single Arrow */}
      <div className="sticky top-18 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-4 py-3 sm:py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-neutral-700 hover:text-neutral-950 px-3 py-1.5 rounded-xl hover:bg-neutral-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-rose-900" />
            <span>Back to Collections</span>
          </button>

          {/* Breadcrumb info */}
          <div className="hidden md:flex items-center gap-2 text-xs text-neutral-500 font-medium">
            <span>{settings.boutiqueName || 'Store'}</span>
            <span>/</span>
            <span className="text-neutral-700">{product.category || 'Collection'}</span>
            <span>/</span>
            <span className="text-neutral-950 font-semibold truncate max-w-xs">{product.title}</span>
          </div>

          {/* Quick Utility Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Share product link"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{copiedLink ? 'Copied!' : 'Share'}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                inWishlist
                  ? 'border-rose-300 bg-rose-50 text-rose-600'
                  : 'border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700'
              }`}
              title={inWishlist ? 'Saved in Wishlist' : 'Add to Wishlist'}
            >
              <Heart className="w-3.5 h-3.5" fill={inWishlist ? 'currentColor' : 'none'} />
              <span className="hidden sm:inline">{inWishlist ? 'Wishlisted' : 'Wishlist'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer relative"
              title="View Shopping Bag"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bag</span>
              {cartCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-neutral-950 text-[10px] font-bold">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Single-Screen-Optimized Product Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-8">
        {/* Core Showcase Grid (Designed to fit on a single screen without vertical overflow) */}
        <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm overflow-hidden p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Left Column: Media Stage & Gallery (Compact & Viewport-calibrated) */}
            <div className="lg:col-span-6 flex flex-col gap-3">
              {/* Media Mode Tabs (Photos / Loom Video / Reels) */}
              {(videoInfo || shortsInfo) && (
                <div className="p-1 bg-neutral-100 rounded-xl flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('photos')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      activeTab === 'photos'
                        ? 'bg-white text-neutral-900 shadow-xs font-bold'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Photos ({product.images.length})</span>
                  </button>
                  {videoInfo && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('video')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        activeTab === 'video'
                          ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Product Video</span>
                    </button>
                  )}
                  {shortsInfo && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('shorts')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        activeTab === 'shorts'
                          ? 'bg-rose-600 text-white font-bold shadow-xs'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      <Instagram className="w-3.5 h-3.5" />
                      <span>Reel</span>
                    </button>
                  )}
                </div>
              )}

              {/* Main Photo / Video Viewer Stage (max-h-56vh keeps it cleanly within a single screen) */}
              <div className="relative w-full h-[40vh] sm:h-[48vh] lg:h-[54vh] max-h-[500px] rounded-2xl bg-neutral-900/5 border border-neutral-200/80 overflow-hidden flex items-center justify-center">
                {(activeTab === 'video' && videoInfo) || (activeTab === 'shorts' && shortsInfo) ? (
                  (() => {
                    const currentMedia = activeTab === 'shorts' ? shortsInfo! : videoInfo!;
                    return (
                      <div className="w-full h-full bg-black flex items-center justify-center">
                        {currentMedia.type === 'youtube' && currentMedia.embedUrl ? (
                          <iframe
                            src={currentMedia.embedUrl}
                            title={`${product.title} Video Preview`}
                            className="w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : currentMedia.type === 'instagram' && currentMedia.embedUrl ? (
                          <iframe
                            src={currentMedia.embedUrl}
                            title={`${product.title} Instagram Reel`}
                            className="w-full h-full border-0"
                            allowFullScreen
                          />
                        ) : currentMedia.type === 'direct' && currentMedia.embedUrl ? (
                          <video
                            src={currentMedia.embedUrl}
                            controls
                            playsInline
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="p-4 text-center text-white space-y-2">
                            <p className="text-xs">Direct Media Link</p>
                            <a
                              href={currentMedia.originalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-neutral-950 text-xs font-bold"
                            >
                              <span>Open External Reel</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="w-full h-full relative flex items-center justify-center bg-neutral-900/5">
                    <img
                      src={product.images[selectedImageIndex] || product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                      alt={product.title}
                      className={`w-full h-full ${
                        imageFitMode === 'contain' ? 'object-contain p-2' : 'object-cover object-top'
                      } transition-all duration-300`}
                    />

                    {/* Out of Stock Overlay */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-10 pointer-events-none">
                        <span className="px-3.5 py-1.5 rounded-full bg-rose-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg border border-rose-400">
                          Sold Out · Restock In Progress
                        </span>
                      </div>
                    )}

                    {/* Left / Right Carousel Controls */}
                    {product.images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedImageIndex((prev) =>
                              prev === 0 ? product.images.length - 1 : prev - 1
                            )
                          }
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white text-neutral-800 shadow-md flex items-center justify-center transition cursor-pointer z-10"
                          title="Previous photo"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedImageIndex((prev) =>
                              prev === product.images.length - 1 ? 0 : prev + 1
                            )
                          }
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white text-neutral-800 shadow-md flex items-center justify-center transition cursor-pointer z-10"
                          title="Next photo"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* Floating Controls Bar at Bottom of Image */}
                    <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between pointer-events-none z-10">
                      <div className="flex items-center gap-1.5 pointer-events-auto">
                        <button
                          type="button"
                          onClick={handleDownloadActiveImage}
                          disabled={isDownloadingSingle}
                          className="px-2.5 py-1 rounded-lg bg-black/75 hover:bg-black text-white text-[10px] font-semibold flex items-center gap-1 backdrop-blur-xs transition cursor-pointer"
                          title="Download high-resolution photo"
                        >
                          <Download className="w-3 h-3 text-amber-300" />
                          <span>{isDownloadingSingle ? 'Saving...' : 'Save Photo'}</span>
                        </button>
                        {product.images.length > 1 && (
                          <button
                            type="button"
                            onClick={handleDownloadAllZip}
                            disabled={isDownloadingZip}
                            className="px-2.5 py-1 rounded-lg bg-black/75 hover:bg-black text-white text-[10px] font-semibold flex items-center gap-1 backdrop-blur-xs transition cursor-pointer"
                            title={`Download all ${product.images.length} photos as ZIP`}
                          >
                            <Download className="w-3 h-3 text-emerald-400" />
                            <span>{isDownloadingZip ? 'Archiving...' : `All (${product.images.length}) ZIP`}</span>
                          </button>
                        )}
                      </div>

                      {/* Image Fit Mode Toggle */}
                      <button
                        type="button"
                        onClick={() => setImageFitMode((m) => (m === 'cover' ? 'contain' : 'cover'))}
                        className="pointer-events-auto px-2.5 py-1 rounded-lg bg-black/80 hover:bg-black text-white text-[11px] font-semibold backdrop-blur-xs transition cursor-pointer flex items-center gap-1.5 border border-white/20 shadow-md"
                        title={imageFitMode === 'cover' ? 'Switch to Fit to Screen' : 'Switch to Full View'}
                      >
                        {imageFitMode === 'cover' ? (
                          <>
                            <Minimize2 className="w-3.5 h-3.5 text-amber-300" />
                            <span>Fit to Screen</span>
                          </>
                        ) : (
                          <>
                            <Maximize2 className="w-3.5 h-3.5 text-amber-300" />
                            <span>Full View</span>
                          </>
                        )}
                      </button>
                    </div>

                    {downloadNotice && (
                      <div className="absolute top-3 inset-x-3 z-20 bg-emerald-600 text-white text-xs font-bold py-1.5 px-3 rounded-xl shadow-lg text-center animate-in fade-in">
                        {downloadNotice}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Thumbnails Row */}
              {product.images.length > 1 && activeTab === 'photos' && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                        selectedImageIndex === idx
                          ? 'border-amber-500 ring-2 ring-amber-400/30'
                          : 'border-neutral-200 hover:border-neutral-400 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Information, Pricing, Actions (fits comfortably without deep scrolling) */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                {/* Badges strip: SKU, Category, Restocked, Discount */}
                <div className="flex items-center gap-2 flex-wrap">
                  {product.productCode && (
                    <button
                      type="button"
                      onClick={handleCopySku}
                      className="font-mono text-xs font-bold text-amber-950 bg-amber-50 border border-amber-300/80 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 hover:bg-amber-100 transition cursor-pointer"
                      title="Click to copy SKU"
                    >
                      <span>{product.productCode}</span>
                      {copiedSku ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-amber-700" />
                      )}
                    </button>
                  )}

                  <span className="text-xs font-semibold text-neutral-600 bg-neutral-100 px-2.5 py-0.5 rounded-lg">
                    {product.fabric || 'Pure Silk'}
                  </span>

                  <span className="text-xs font-semibold text-neutral-600 bg-neutral-100 px-2.5 py-0.5 rounded-lg">
                    {product.color}
                  </span>

                  {hasRestockTag && !isOutOfStock && (
                    <span className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
                      <span>Restocked</span>
                    </span>
                  )}

                  {discount.hasDiscount && (
                    <span className="bg-rose-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-lg">
                      {discount.discountPercentage}% OFF
                    </span>
                  )}
                </div>

                {/* Saree Title */}
                <div>
                  <h1 className="font-serif font-bold text-xl sm:text-2xl lg:text-3xl text-neutral-900 leading-tight">
                    {product.title}
                  </h1>
                  {product.subtitle && (
                    <p className="text-xs sm:text-sm text-neutral-500 font-serif italic mt-0.5">
                      {product.subtitle}
                    </p>
                  )}
                </div>

                {/* Star Ratings Summary */}
                <div className="flex items-center gap-2 pt-0.5">
                  <div className="flex items-center text-amber-500">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= Math.round(avgRating)
                            ? 'fill-amber-400 text-amber-500'
                            : 'text-neutral-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-neutral-800">
                    {avgRating > 0 ? avgRating.toFixed(1) : '5.0'}
                  </span>
                  <span className="text-neutral-400 text-xs">•</span>
                  <span className="text-xs text-neutral-500">
                    {reviewCount > 0 ? `${reviewCount} reviews` : 'Curated Collection'}
                  </span>
                </div>

                {/* Price Display */}
                <div className="pt-2 border-t border-neutral-100 flex items-baseline gap-3 flex-wrap">
                  <span className="font-serif font-bold text-2xl sm:text-3xl text-neutral-950 tabular-nums">
                    {formatPrice(product.price)}
                  </span>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm sm:text-base text-neutral-400 line-through tabular-nums">
                        {formatPrice(product.originalPrice)}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Save {formatPrice(discount.discountAmount)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Stock Indicator */}
                <div className="flex items-center gap-2 text-xs">
                  {isOutOfStock ? (
                    <span className="font-bold text-rose-600 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      <span>Out of stock for immediate dispatch</span>
                    </span>
                  ) : product.stockCount !== undefined && product.stockCount <= 3 ? (
                    <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Only {product.stockCount} piece{product.stockCount > 1 ? 's' : ''} left in stock!</span>
                    </span>
                  ) : (
                    <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ready for Dispatch • {product.stockCount ? `${product.stockCount} available` : 'In Stock'}</span>
                    </span>
                  )}
                </div>

                {/* Quantity Selector */}
                {!isOutOfStock && (
                  <div className="pt-2 flex items-center gap-3">
                    <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                      Quantity:
                    </span>
                    <div className="inline-flex items-center rounded-xl border border-neutral-300 bg-white shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        className="p-2 hover:bg-neutral-100 text-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold text-xs sm:text-sm px-3.5 py-1 text-neutral-900 min-w-8 text-center tabular-nums">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
                        disabled={quantity >= maxStock}
                        className="p-2 hover:bg-neutral-100 text-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Main Action CTAs */}
                <div className="pt-3 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isOutOfStock}
                    className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition cursor-pointer ${
                      isOutOfStock
                        ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed'
                        : addedFeedback
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'border-neutral-900 text-neutral-900 hover:bg-neutral-100 bg-white'
                    }`}
                  >
                    {addedFeedback ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>Added to Bag!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        <span>Add to Bag</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleInstantBuy}
                    disabled={isOutOfStock}
                    className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
                      isOutOfStock
                        ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none'
                        : 'bg-rose-900 hover:bg-rose-800 text-white shadow-rose-950/20'
                    }`}
                  >
                    <span>Buy Now</span>
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                {/* Value Propositions Strip */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-100 text-center">
                  <div className="p-2 rounded-xl bg-neutral-50 border border-neutral-100">
                    <ShieldCheck className="w-4 h-4 text-amber-700 mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-neutral-800 block">Quality Assured</span>
                    <span className="text-[9px] text-neutral-500">100% Certified Quality</span>
                  </div>
                  <div className="p-2 rounded-xl bg-neutral-50 border border-neutral-100">
                    <Truck className="w-4 h-4 text-blue-700 mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-neutral-800 block">Insured Dispatch</span>
                    <span className="text-[9px] text-neutral-500">Fast Express Courier</span>
                  </div>
                  <div className="p-2 rounded-xl bg-neutral-50 border border-neutral-100">
                    <Sparkles className="w-4 h-4 text-purple-700 mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-neutral-800 block">Retail Assurance</span>
                    <span className="text-[9px] text-neutral-500">Direct Brand Value</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Product Specifications & Description */}
        <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="font-serif font-bold text-lg sm:text-xl text-neutral-900">
              Product Specifications & Details
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Verified product details, fabric guidelines, and styling attributes
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {product.fabric && (
              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Fabric Type
                </span>
                <span className="font-bold text-neutral-900 text-sm">{product.fabric}</span>
              </div>
            )}
            {product.color && (
              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Shade & Hue
                </span>
                <span className="font-bold text-neutral-900 text-sm">{product.color}</span>
              </div>
            )}
            {product.weaveDetails && (
              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Pattern & Fabric Style
                </span>
                <span className="font-bold text-neutral-900 text-sm">{product.weaveDetails}</span>
              </div>
            )}
            {product.borderType && (
              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Border Design
                </span>
                <span className="font-bold text-neutral-900 text-sm">{product.borderType}</span>
              </div>
            )}
            {product.lengthMeters !== undefined && (
              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Length
                </span>
                <span className="font-bold text-neutral-900 text-sm">{product.lengthMeters} Meters</span>
              </div>
            )}
            {product.blousePieceIncluded !== undefined && (
              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Blouse Piece
                </span>
                <span className="font-bold text-neutral-900 text-sm">
                  {product.blousePieceIncluded ? 'Included in Fabric' : 'Fabric Only (No Blouse)'}
                </span>
              </div>
            )}
            {product.palluDetails && (
              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Pallu Details
                </span>
                <span className="font-bold text-neutral-900 text-sm">{product.palluDetails}</span>
              </div>
            )}
            {product.occasion && (
              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Suggested Occasion
                </span>
                <span className="font-bold text-neutral-900 text-sm">{product.occasion}</span>
              </div>
            )}
          </div>

          {product.description && (
            <div className="space-y-2 pt-2 border-t border-neutral-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Product Description & Highlights
              </h3>
              <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed whitespace-pre-line font-serif">
                {product.description}
              </p>
            </div>
          )}
        </div>

        {/* Customer Reviews & Testimonials Section */}
        <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-neutral-100 pb-4">
            <div>
              <h2 className="font-serif font-bold text-lg sm:text-xl text-neutral-900 flex items-center gap-2">
                <span>Customer Reviews</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-sans font-bold">
                  {reviewCount}
                </span>
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Verified customer reviews and feedback
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowReviewForm((v) => !v)}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer"
            >
              {showReviewForm ? 'Cancel Review' : 'Write a Review'}
            </button>
          </div>

          {/* New Review Form */}
          {showReviewForm && (
            <form onSubmit={handleSubmitReview} className="bg-neutral-50 p-4 sm:p-6 rounded-2xl border border-neutral-200 space-y-4">
              <h4 className="font-bold text-xs text-neutral-900">Write Your Feedback</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-600">Your Rating:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      className="p-1 cursor-pointer"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= newRating ? 'fill-amber-400 text-amber-500' : 'text-neutral-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  placeholder="Your Name (e.g., Ananya S.)"
                  className="px-3 py-2 rounded-xl border border-neutral-200 text-xs bg-white text-neutral-900"
                />
                <input
                  type="text"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="Your City (e.g., Chennai, Bengaluru)"
                  className="px-3 py-2 rounded-xl border border-neutral-200 text-xs bg-white text-neutral-900"
                />
              </div>

              <textarea
                required
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your experience regarding the saree drape, luster, and packaging..."
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs bg-white text-neutral-900"
              />

              <button
                type="submit"
                disabled={isSubmittingReview}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition cursor-pointer"
              >
                {isSubmittingReview ? 'Submitting...' : 'Post Review'}
              </button>
            </form>
          )}

          {reviewSubmitSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Thank you! Your verified review has been published.</span>
            </div>
          )}

          {/* Reviews List */}
          {reviews.length === 0 ? (
            <div className="text-center py-6 text-neutral-500 text-xs">
              No reviews yet for this product. Be the first customer to share your experience!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-4 rounded-2xl bg-neutral-50/70 border border-neutral-200/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-neutral-900">{rev.customerName}</span>
                    <div className="flex items-center text-amber-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3 h-3 ${s <= rev.rating ? 'fill-amber-400 text-amber-500' : 'text-neutral-300'}`}
                        />
                      ))}
                    </div>
                  </div>
                  {rev.city && <span className="text-[10px] text-neutral-400 block">{rev.city}</span>}
                  <p className="text-xs text-neutral-700 leading-relaxed font-serif italic">"{rev.comment}"</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Suggested Products Carousel (Compact image size, smooth horizontal scrolling) */}
        {suggestedItems.length > 0 && (
          <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm p-5 sm:p-7 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-serif font-bold text-base sm:text-lg text-neutral-900">
                  Suggested Products
                </h3>
                <p className="text-xs text-neutral-500">
                  Recommended items curated from our store
                </p>
              </div>

              {/* Carousel Left / Right Scroll Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => scrollCarousel('left')}
                  className="w-8 h-8 rounded-full border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 flex items-center justify-center transition cursor-pointer shadow-2xs"
                  title="Previous suggestions"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollCarousel('right')}
                  className="w-8 h-8 rounded-full border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 flex items-center justify-center transition cursor-pointer shadow-2xs"
                  title="Next suggestions"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Compact Carousel Items */}
            <div
              ref={carouselRef}
              className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x snap-mandatory no-scrollbar"
            >
              {suggestedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setProduct(item);
                    setSelectedImageIndex(0);
                    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                    if (onSelectProduct) onSelectProduct(item);
                  }}
                  className="group w-40 sm:w-48 shrink-0 snap-start bg-neutral-50/80 hover:bg-white rounded-2xl border border-neutral-200/90 overflow-hidden shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                >
                  {/* Compact Image Container */}
                  <div className="relative h-36 sm:h-44 w-full overflow-hidden bg-neutral-200">
                    <img
                      src={item.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {item.productCode && (
                      <span className="absolute bottom-1.5 left-1.5 text-[9px] font-mono font-bold bg-black/75 text-amber-300 px-1.5 py-0.5 rounded backdrop-blur-xs">
                        {item.productCode}
                      </span>
                    )}
                  </div>

                  {/* Card Content & Action Buttons */}
                  <div className="p-2.5 sm:p-3 flex flex-col flex-1 justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="text-[10px] text-neutral-500 font-medium truncate">
                        {item.fabric || 'Pure Silk'} {item.color ? `• ${item.color}` : ''}
                      </div>
                      <h4 className="font-serif font-bold text-xs text-neutral-900 line-clamp-2 leading-tight group-hover:text-amber-800 transition">
                        {item.title}
                      </h4>
                    </div>

                    <div className="pt-1 border-t border-neutral-200/60 flex items-center justify-between gap-1.5">
                      <div className="flex items-baseline gap-1">
                        <span className="font-serif font-bold text-xs sm:text-sm text-neutral-950">
                          {formatPrice(item.price)}
                        </span>
                        {item.originalPrice && item.originalPrice > item.price && (
                          <span className="text-[10px] text-neutral-400 line-through">
                            {formatPrice(item.originalPrice)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(item, 1);
                          }}
                          className="px-2 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[10px] font-bold flex items-center gap-1 transition"
                          title="Add to bag"
                        >
                          <ShoppingBag className="w-2.5 h-2.5" />
                          <span className="hidden xs:inline">Add</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(item, 1);
                            setIsCheckoutOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-900 hover:bg-rose-800 text-white text-[10px] font-bold transition"
                          title="Buy now"
                        >
                          BUY
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
