import React, { useState, useEffect } from 'react';
import { Product } from '../../types/store';
import { useStore } from '../../context/StoreContext';
import { formatPrice, calculateDiscount, getProductShareUrl, getPublicStoreUrl } from '../../utils/upi';
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
  Star,
  MessageSquarePlus,
  Check,
  Plus,
  Minus,
} from 'lucide-react';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose }) => {
  const {
    addToCart,
    setIsCartOpen,
    setIsCheckoutOpen,
    settings,
    getProductReviews,
    getProductAverageRating,
    addReview,
  } = useStore();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'photos' | 'video'>('photos');
  const [copiedLink, setCopiedLink] = useState(false);

  // Customer Reviews state
  const reviews = getProductReviews(product.id);
  const { rating: avgRating, count: reviewCount } = getProductAverageRating(product.id);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newAuthor, setNewAuthor] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newTitle, setNewTitle] = useState('');
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
        title: newTitle.trim() || undefined,
        comment: newComment.trim(),
        verifiedBuyer: true,
      });

      setReviewSubmitSuccess(true);
      setNewAuthor('');
      setNewCity('');
      setNewTitle('');
      setNewComment('');
      setNewRating(5);
      setTimeout(() => {
        setReviewSubmitSuccess(false);
        setShowReviewForm(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Quantity & multi-item purchase state (User Request)
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  const videoInfo = parseVideoUrl(product.videoUrl);
  const isOutOfStock = product.stockStatus === 'out_of_stock';
  const maxStock = product.stockStatus === 'limited' && product.stockCount ? product.stockCount : 99;

  const handleIncrement = () => {
    if (quantity < maxStock) {
      setQuantity((q) => q + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity((q) => q - 1);
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
    onClose();
    setIsCheckoutOpen(true);
  };

  // Deep link sync with window URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const identifier = product.productCode || product.id;
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('product', identifier);
    const newRelativePath = `${window.location.pathname}?${searchParams.toString()}${window.location.hash || ''}`;
    window.history.replaceState(null, '', newRelativePath);

    return () => {
      const cleanupParams = new URLSearchParams(window.location.search);
      cleanupParams.delete('product');
      const cleanString = cleanupParams.toString();
      const cleanPath = `${window.location.pathname}${cleanString ? `?${cleanString}` : ''}${window.location.hash || ''}`;
      window.history.replaceState(null, '', cleanPath);
    };
  }, [product]);

  const handleShare = () => {
    const shareUrl = getProductShareUrl(product, settings);
    const discountInfo = calculateDiscount(product.price, product.originalPrice);
    const offerText = discountInfo.hasDiscount
      ? ` (${discountInfo.discountPercentage}% OFF - Save ${formatPrice(discountInfo.discountAmount)})`
      : '';
    const shareMessage = `Look at this gorgeous ${product.fabric} saree at ${settings.boutiqueName}: ${product.title}\nPrice: ${formatPrice(product.price)}${product.originalPrice ? ` (MRP: ${formatPrice(product.originalPrice)})` : ''}${offerText}\n\nView & Reserve Saree: ${shareUrl}`;

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
                <p className="text-xs sm:text-sm text-neutral-600 mb-2 font-medium italic">
                  {product.subtitle}
                </p>
              )}

              {/* Rating and Reviews Counter */}
              <div className="flex items-center gap-2 mb-4">
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
                  <span className="font-bold text-neutral-900 ml-1.5 text-xs">{avgRating.toFixed(1)}</span>
                </div>
                <span className="text-neutral-400 text-xs">·</span>
                <span className="text-neutral-600 text-xs font-medium">
                  {reviewCount} {reviewCount === 1 ? 'Customer Review' : 'Customer Reviews'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowReviewForm(!showReviewForm)}
                  className="ml-auto text-xs font-semibold text-rose-800 hover:text-rose-950 underline flex items-center gap-1"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>{showReviewForm ? 'Close form' : 'Write a review'}</span>
                </button>
              </div>

              {/* Pricing & Offer Details (MRP, Selling Price, % Tag and Amount Saved) */}
              {(() => {
                const discount = calculateDiscount(product.price, product.originalPrice);
                return (
                  <div className="pb-4 mb-4 border-b border-neutral-100 space-y-2">
                    <div className="flex items-baseline flex-wrap gap-2.5 sm:gap-3">
                      {/* Selling Price */}
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tabular-nums">
                          {formatPrice(discount.sellingPrice)}
                        </span>
                        <span className="text-[11px] text-neutral-500 font-medium">Selling Price</span>
                      </div>

                      {/* MRP */}
                      {discount.hasDiscount && (
                        <div className="flex items-baseline gap-1 text-neutral-400">
                          <span className="text-xs uppercase tracking-wider font-semibold">MRP</span>
                          <span className="text-sm sm:text-base line-through tabular-nums font-medium">
                            {formatPrice(discount.mrp)}
                          </span>
                        </div>
                      )}

                      {/* Percentage Tag */}
                      {discount.hasDiscount && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs">
                          {discount.discountPercentage}% OFF
                        </span>
                      )}

                      {/* Delivery Badge */}
                      {settings.delivery?.freeDeliveryEnabled && product.price >= settings.delivery.freeDeliveryThreshold ? (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          Free Delivery
                        </span>
                      ) : settings.delivery?.shippingFee ? (
                        <span className="text-xs font-semibold text-neutral-600 bg-neutral-100 px-2.5 py-1 rounded-full">
                          +₹{settings.delivery.shippingFee} Delivery
                        </span>
                      ) : null}
                    </div>

                    {/* Offer in Amount Saved */}
                    {discount.hasDiscount && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                        <span>🏷️ Offer:</span>
                        <span className="font-bold">Save {formatPrice(discount.discountAmount)}</span>
                        <span className="text-emerald-700 font-normal">
                          ({discount.discountPercentage}% discount on original MRP)
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

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

              {/* Customer Reviews & Feedback Section */}
              <div className="pt-2 border-t border-neutral-200/80 mb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-neutral-900 flex items-center gap-2">
                      <span>Customer Reviews</span>
                      <span className="text-xs font-sans font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                        {reviews.length}
                      </span>
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Authentic ratings from patrons across India
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReviewForm(!showReviewForm)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 hover:border-neutral-900 text-neutral-800 text-xs font-semibold transition"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    <span>{showReviewForm ? 'Cancel' : 'Write Review'}</span>
                  </button>
                </div>

                {/* Inline Review Submission Form */}
                {showReviewForm && (
                  <form onSubmit={handleSubmitReview} className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-900">Your Overall Rating:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewRating(star)}
                            className="p-1 hover:scale-110 transition"
                            title={`${star} Star`}
                          >
                            <Star
                              className={`w-5 h-5 ${
                                star <= newRating
                                  ? 'fill-amber-400 text-amber-500'
                                  : 'text-neutral-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Your Full Name *</label>
                        <input
                          type="text"
                          required
                          value={newAuthor}
                          onChange={(e) => setNewAuthor(e.target.value)}
                          placeholder="e.g. Radhika Sharma"
                          className="w-full p-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">City / Region (Optional)</label>
                        <input
                          type="text"
                          value={newCity}
                          onChange={(e) => setNewCity(e.target.value)}
                          placeholder="e.g. Hyderabad, Telangana"
                          className="w-full p-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Review Headline (Optional)</label>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Royal drape, pure gold zari luster"
                        className="w-full p-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Your Review / Experience *</label>
                      <textarea
                        required
                        rows={3}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Describe the fabric texture, zari luster, feel on the skin, and delivery experience..."
                        className="w-full p-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {reviewSubmitSuccess ? (
                        <span className="text-emerald-800 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Review submitted successfully! Thank you.</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-500">Your review will be verified and published instantly.</span>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition shadow-xs disabled:opacity-50"
                      >
                        {isSubmittingReview ? 'Submitting...' : 'Post Review'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Reviews List */}
                <div className="space-y-3">
                  {reviews.length === 0 ? (
                    <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-center text-xs text-neutral-500">
                      <p>No customer reviews yet for this saree.</p>
                      <button
                        type="button"
                        onClick={() => setShowReviewForm(true)}
                        className="mt-1.5 font-bold text-rose-800 hover:underline"
                      >
                        Be the first to share your experience!
                      </button>
                    </div>
                  ) : (
                    reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-3.5 rounded-xl bg-neutral-50/80 border border-neutral-200/70 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-900">{rev.customerName}</span>
                            {rev.city && (
                              <span className="text-[11px] text-neutral-500">({rev.city})</span>
                            )}
                            {rev.verifiedBuyer && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>Verified Buyer</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center text-amber-500">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3 h-3 ${
                                  s <= rev.rating
                                    ? 'fill-amber-400 text-amber-500'
                                    : 'text-neutral-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        {rev.title && (
                          <p className="font-semibold text-neutral-900 text-xs">{rev.title}</p>
                        )}
                        <p className="text-neutral-600 text-[11px] leading-relaxed">{rev.comment}</p>
                        <p className="text-[10px] text-neutral-400">
                          {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Quantity Selector Module (User Request: add number of products before buy or add to bag) */}
            {!isOutOfStock && (
              <div className="pt-3 pb-2 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/80 p-3.5 rounded-2xl border border-neutral-200/70 mb-2">
                <div>
                  <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <span>Number of Sarees (Quantity)</span>
                    {product.stockStatus === 'limited' && (
                      <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded-full">
                        Max {product.stockCount} left
                      </span>
                    )}
                  </span>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Subtotal for {quantity} {quantity === 1 ? 'saree' : 'sarees'}:{' '}
                    <strong className="text-neutral-950 font-bold tabular-nums">
                      {formatPrice(product.price * quantity)}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div className="flex items-center border border-neutral-300 rounded-xl bg-white shadow-2xs overflow-hidden">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      disabled={quantity <= 1}
                      className="p-2 hover:bg-neutral-100 text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3.5 text-xs font-bold tabular-nums text-neutral-900 min-w-8 text-center">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={handleIncrement}
                      disabled={quantity >= maxStock}
                      className="p-2 hover:bg-neutral-100 text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {quantity > 1 && (
                    <span className="text-[11px] font-semibold text-amber-900 bg-amber-100/70 px-2 py-1 rounded-lg">
                      {quantity} × {formatPrice(product.price)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`flex-1 py-3.5 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 border transition ${
                  isOutOfStock
                    ? 'bg-neutral-200 text-neutral-400 border-neutral-300 cursor-not-allowed'
                    : addedFeedback
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-400 shadow-xs'
                    : 'border-neutral-900 text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                {addedFeedback ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Added {quantity} to Shopping Bag!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add {quantity > 1 ? `${quantity} Sarees` : 'to Shopping Bag'}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleInstantBuy}
                disabled={isOutOfStock}
                className={`flex-1 py-3.5 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition ${
                  isOutOfStock
                    ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-amber-500/20 font-bold'
                }`}
              >
                <span>
                  {isOutOfStock
                    ? 'Currently Sold Out'
                    : quantity > 1
                    ? `Buy ${quantity} Sarees (${formatPrice(product.price * quantity)})`
                    : 'Buy Now'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
