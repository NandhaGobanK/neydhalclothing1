import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../../types/store';
import { useStore } from '../../context/StoreContext';
import { formatPrice, calculateDiscount, getProductShareUrl, getPublicStoreUrl } from '../../utils/upi';
import { parseVideoUrl } from '../../utils/video';
import { isProductInActiveCategories, getCategorySingularName, getCategoryPluralName } from '../../utils/productValidation';
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
  Instagram,
  Film,
  Eye,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Trash2,
  Download,
} from 'lucide-react';
import { downloadSingleImage, downloadAllProductImagesZip } from '../../utils/imageDownload';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onSelectProduct?: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product: initialProduct, onClose, onSelectProduct }) => {
  const [product, setProduct] = useState<Product>(initialProduct);
  const [historyStack, setHistoryStack] = useState<Product[]>([]);

  useEffect(() => {
    setProduct(initialProduct);
    setHistoryStack([]);
    setSelectedImageIndex(0);
    setActiveTab('photos');
    setQuantity(1);
  }, [initialProduct.id]);

  const {
    products,
    categories,
    cart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    cartCount,
    cartTotal,
    cartGrandTotal,
    setIsCartOpen,
    setIsCheckoutOpen,
    settings,
    productAttributes,
    getProductReviews,
    getProductAverageRating,
    addReview,
    setActiveProductModal,
  } = useStore();
  const modalBoxRef = useRef<HTMLDivElement>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'photos' | 'video' | 'shorts'>('photos');
  const [copiedLink, setCopiedLink] = useState(false);
  const [imageFitMode, setImageFitMode] = useState<'cover' | 'contain'>('cover');
  const [isDownloadingSingle, setIsDownloadingSingle] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

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

  const handleDownloadAllZip = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!product.images || product.images.length === 0) return;
    setIsDownloadingZip(true);
    await downloadAllProductImagesZip(product.title, product.productCode, product.images);
    setIsDownloadingZip(false);
    setDownloadNotice(`All ${product.images.length} photos downloaded! ✓`);
    setTimeout(() => setDownloadNotice(null), 3500);
  };

  // Suggested items single-carousel state
  const carouselScrollRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (offset: number) => {
    if (carouselScrollRef.current) {
      carouselScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Unified suggested items (cross-sells specifically tailored for this product)
  const suggestedItems = React.useMemo(() => {
    // 1. Direct handpicked cross-sells
    const directIds = product.crossSellProductIds || [];
    if (directIds.length > 0) {
      // If the admin explicitly handpicked cross-sell items,
      // ONLY show those handpicked items that belong to active categories and are visible!
      return products.filter(
        (p) =>
          directIds.includes(p.id) &&
          p.id !== product.id &&
          p.stockStatus !== 'out_of_stock' &&
          p.isVisible !== false &&
          isProductInActiveCategories(p, categories)
      );
    }

    // 2. Only if no direct cross-sells were handpicked, provide sensible category recommendations:
    // Strictly filter out any categories that were removed or are not in active categories
    const activeCategoryNames = (categories || [])
      .map((c) => (c?.name ? String(c.name).toLowerCase().trim() : ''))
      .filter(Boolean);
    const candidateFallbackCategories =
      product.crossSellCategoryNames && product.crossSellCategoryNames.length > 0
        ? product.crossSellCategoryNames
        : product.productType === 'kurti'
        ? ['Ethnic Kurtis', 'Bottoms & Palazzos', 'Dupattas']
        : product.productType === 'blouse'
        ? ['Heirloom Sarees']
        : product.productType === 'jewelry'
        ? ['Heirloom Sarees', 'Designer Blouses']
        : ['Designer Blouses'];

    const validConfiguredCategories = candidateFallbackCategories.filter((catName) => {
      const clean = catName.toLowerCase().trim();
      return activeCategoryNames.some(
        (ac) => ac === clean || ac.includes(clean) || clean.includes(ac)
      );
    });

    if (validConfiguredCategories.length === 0) {
      return [];
    }

    const categoryMatches = products.filter((p) => {
      if (
        p.id === product.id ||
        p.stockStatus === 'out_of_stock' ||
        p.isVisible === false ||
        !p.category ||
        !isProductInActiveCategories(p, categories)
      ) {
        return false;
      }
      const cat = p.category.toLowerCase().trim();
      return validConfiguredCategories.some(
        (c) =>
          c.toLowerCase().trim() === cat ||
          cat.includes(c.toLowerCase().trim()) ||
          c.toLowerCase().trim().includes(cat)
      );
    });

    return categoryMatches.slice(0, 10);
  }, [product, products, categories]);

  // Suggested items added to cart tracker
  const addedCarouselItems = React.useMemo(() => {
    return suggestedItems
      .map((item) => {
        const cartEntry = cart.find((c) => c.product.id === item.id);
        return {
          item,
          quantity: cartEntry ? cartEntry.quantity : 0,
        };
      })
      .filter((entry) => entry.quantity > 0);
  }, [suggestedItems, cart]);

  const addedItemIds = React.useMemo(() => {
    return new Set(addedCarouselItems.map((entry) => entry.item.id));
  }, [addedCarouselItems]);

  // Unselected suggested items: only show items that are NOT yet selected
  // (Separates already selected products into their own dedicated column)
  const unselectedSuggestedItems = React.useMemo(() => {
    return suggestedItems.filter((item) => !addedItemIds.has(item.id));
  }, [suggestedItems, addedItemIds]);

  const carouselAddedItemsCount = React.useMemo(() => {
    return addedCarouselItems.reduce((acc, entry) => acc + entry.quantity, 0);
  }, [addedCarouselItems]);

  const carouselAddedTotalCost = React.useMemo(() => {
    return addedCarouselItems.reduce((acc, entry) => acc + entry.item.price * entry.quantity, 0);
  }, [addedCarouselItems]);

  const handleGoToCart = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (mainProductQtyInCart === 0 && !isOutOfStock && addedCarouselItems.length > 0) {
      addToCart(product, quantity);
    }
    onClose();
    setIsCartOpen(true);
  };

  // Add / Increment suggested item (+ symbol)
  const handleIncrementSuggested = (item: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const liveProd = products.find((p) => p.id === item.id) || item;
    const maxStock = Math.max(0, liveProd.stockCount ?? 99);
    const cartEntry = cart.find((c) => c.product.id === item.id);
    const currentQty = cartEntry ? cartEntry.quantity : 0;
    if (currentQty < maxStock) {
      addToCart(item, 1);
    }
  };

  // Remove / Decrement suggested item (- symbol)
  const handleDecrementSuggested = (item: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const cartEntry = cart.find((c) => c.product.id === item.id);
    if (!cartEntry) return;
    if (cartEntry.quantity > 1) {
      updateCartQuantity(item.id, cartEntry.quantity - 1);
    } else {
      removeFromCart(item.id);
    }
  };

  const handleClose = () => {
    if (historyStack.length > 0) {
      const prevProduct = historyStack[historyStack.length - 1];
      setHistoryStack((prev) => prev.slice(0, -1));
      setProduct(prevProduct);
      setSelectedImageIndex(0);
      setActiveTab('photos');
      setQuantity(1);
      if (modalBoxRef.current) {
        modalBoxRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      onClose();
    }
  };

  const handleViewSuggestedProduct = (item: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // Push the current product into the navigation history stack
    setHistoryStack((prev) => [...prev, product]);
    setProduct(item);
    setSelectedImageIndex(0);
    setActiveTab('photos');
    setQuantity(1);
    if (modalBoxRef.current) {
      modalBoxRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Keyboard Escape listener to step back or close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStack]);

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

  // Dynamic category entity naming (adapts Saree, Blouse, Kurti, Jewelry, etc.)
  const itemSingular = getCategorySingularName(product.category || product.productType);
  const itemPlural = getCategoryPluralName(product.category || product.productType);

  const videoInfo = parseVideoUrl(product.videoUrl);
  const shortsInfo = parseVideoUrl(product.instagramShortsUrl);
  const isOutOfStock = product.stockStatus === 'out_of_stock' || (product.stockCount !== undefined && product.stockCount <= 0);
  const maxStock = isOutOfStock ? 0 : (product.stockCount !== undefined && product.stockCount > 0 ? product.stockCount : 99);

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

  // Check if current main product is in cart
  const mainProductInCart = cart.find((c) => c.product.id === product.id);
  const mainProductQtyInCart = mainProductInCart ? mainProductInCart.quantity : 0;

  // Saree subtotal (either from cart if already in cart, or configured quantity * product.price)
  const currentSareeSubtotal = (mainProductInCart && mainProductQtyInCart > 0)
    ? mainProductInCart.product.price * mainProductQtyInCart
    : product.price * quantity;

  // Complete ensemble total cost (This Saree + Added Suggested Items)
  const ensembleCombinedTotal = (mainProductQtyInCart > 0 || !isOutOfStock ? currentSareeSubtotal : 0) + carouselAddedTotalCost;

  // Total items in the combined ensemble
  const totalEnsembleItemsCount = (mainProductQtyInCart > 0 || !isOutOfStock ? (mainProductQtyInCart > 0 ? mainProductQtyInCart : quantity) : 0) + carouselAddedItemsCount;

  const handleInstantBuy = () => {
    if (isOutOfStock && carouselAddedItemsCount === 0) return;
    if (!isOutOfStock) {
      addToCart(product, quantity);
    }
    onClose();
    setIsCheckoutOpen(true);
  };

  const handleBuyEnsembleNow = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (mainProductQtyInCart === 0 && !isOutOfStock) {
      addToCart(product, quantity);
    }
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
    const shareMessage = `Look at this gorgeous ${product.title} at ${settings.boutiqueName}:\nCategory: ${product.category || 'Collection'}\nPrice: ${formatPrice(product.price)}${product.originalPrice ? ` (MRP: ${formatPrice(product.originalPrice)})` : ''}${offerText}\n\nView & Reserve ${itemSingular}: ${shareUrl}`;

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
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={modalBoxRef}
        className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Dedicated Navigation Bar when viewing a suggested product from history stack */}
        {historyStack.length > 0 ? (
          <div className="bg-neutral-950 text-white px-3 sm:px-5 py-2.5 flex items-center justify-between border-b border-neutral-800 z-30 shrink-0 gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition cursor-pointer border border-white/10 active:scale-95 max-w-[70%] sm:max-w-md truncate"
              title={`Return back to ${historyStack[historyStack.length - 1].title}`}
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5] shrink-0" />
              <span className="truncate">
                Back to {historyStack[historyStack.length - 1].title}
              </span>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-medium transition cursor-pointer border border-white/10 hidden sm:inline-flex"
                title="Close modal completely"
              >
                Close All
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white transition-colors cursor-pointer border border-white/10"
                aria-label="Close modal"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Standard floating close button for root product (when no history stack bar) */
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-full bg-neutral-900/60 hover:bg-neutral-900 text-white transition-colors cursor-pointer shadow-md backdrop-blur-xs"
              aria-label="Close details"
              title="Close details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left Column: Visual Media Gallery & Video */}
          <div className="bg-neutral-100 flex flex-col justify-between border-b md:border-b-0 md:border-r border-neutral-200">
            {/* Media Tabs if video or Instagram shorts is available */}
            {(videoInfo || shortsInfo) && (
              <div className="p-2.5 bg-neutral-900 flex items-center justify-center gap-1.5 flex-wrap pr-14 md:pr-2.5">
                <button
                  onClick={() => setActiveTab('photos')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'photos'
                      ? 'bg-amber-500 text-neutral-950 shadow-xs'
                      : 'text-neutral-300 hover:text-white bg-neutral-800/80'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{itemSingular} Photos</span>
                </button>
                {videoInfo && (
                  <button
                    onClick={() => setActiveTab('video')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      activeTab === 'video'
                        ? 'bg-amber-500 text-neutral-950 shadow-xs'
                        : 'text-neutral-300 hover:text-white bg-neutral-800/80'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Loom Video</span>
                  </button>
                )}
                {shortsInfo && (
                  <button
                    onClick={() => setActiveTab('shorts')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      activeTab === 'shorts'
                        ? 'bg-pink-600 text-white shadow-xs'
                        : 'text-neutral-300 hover:text-white bg-neutral-800/80'
                    }`}
                  >
                    <Instagram className="w-3.5 h-3.5 text-pink-400" />
                    <span>Instagram Shorts</span>
                  </button>
                )}
              </div>
            )}

            {/* Media Display Area */}
            <div className="relative aspect-4/5 sm:aspect-square md:aspect-auto md:h-120 bg-neutral-100 flex items-center justify-center overflow-hidden">
              {(activeTab === 'video' && videoInfo) || (activeTab === 'shorts' && shortsInfo) ? (
                (() => {
                  const currentMedia = activeTab === 'shorts' ? shortsInfo! : videoInfo!;
                  return (
                    <div className="w-full h-full bg-black flex flex-col items-center justify-center">
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
                        <div className="p-6 text-center text-neutral-300">
                          <p className="text-sm font-semibold mb-2">Video Preview</p>
                          <a
                            href={currentMedia.originalUrl}
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
                  );
                })()
              ) : (
                <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-neutral-900 group/img">
                  <img
                    src={product.images[selectedImageIndex] || product.images[0]}
                    alt={product.title}
                    referrerPolicy="no-referrer"
                    className={`w-full h-full ${imageFitMode === 'contain' ? 'object-contain p-2' : 'object-cover object-center'} transition-all duration-300`}
                  />
                  {/* Floating Action Controls on Image (Download Photo & Fit Mode) */}
                  <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none gap-2">
                    {/* Download Controls */}
                    <div className="flex items-center gap-1.5 pointer-events-auto flex-wrap">
                      <button
                        type="button"
                        onClick={handleDownloadActiveImage}
                        disabled={isDownloadingSingle}
                        className="px-2.5 py-1 rounded-lg bg-black/80 hover:bg-black text-white text-[10px] font-semibold backdrop-blur-xs border border-white/20 transition cursor-pointer flex items-center gap-1 shadow-md opacity-90 hover:opacity-100 disabled:opacity-50"
                        title="Download high-resolution image"
                      >
                        <Download className="w-3 h-3 text-amber-300" />
                        <span>{isDownloadingSingle ? 'Saving...' : 'Download Photo'}</span>
                      </button>

                      {product.images.length > 1 && (
                        <button
                          type="button"
                          onClick={handleDownloadAllZip}
                          disabled={isDownloadingZip}
                          className="px-2.5 py-1 rounded-lg bg-black/80 hover:bg-black text-white text-[10px] font-semibold backdrop-blur-xs border border-white/20 transition cursor-pointer flex items-center gap-1 shadow-md opacity-90 hover:opacity-100 disabled:opacity-50"
                          title={`Download all ${product.images.length} photos in a ZIP archive`}
                        >
                          <Download className="w-3 h-3 text-emerald-400" />
                          <span>{isDownloadingZip ? 'Packaging ZIP...' : `All Photos (.ZIP)`}</span>
                        </button>
                      )}
                    </div>

                    {/* Image Fit Mode Switcher Pill */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageFitMode((prev) => (prev === 'cover' ? 'contain' : 'cover'));
                      }}
                      className="pointer-events-auto shrink-0 px-2.5 py-1 rounded-lg bg-black/80 hover:bg-black text-white text-[10px] font-semibold backdrop-blur-xs border border-white/20 transition cursor-pointer flex items-center gap-1 shadow-md opacity-90 hover:opacity-100"
                      title={imageFitMode === 'cover' ? 'Fit entire uncropped image' : 'Fill template view'}
                    >
                      <span>{imageFitMode === 'cover' ? '🔍 View Full' : '📐 Fill Template'}</span>
                    </button>
                  </div>

                  {downloadNotice && (
                    <div className="absolute top-3 inset-x-3 z-30 flex justify-center pointer-events-none">
                      <span className="bg-neutral-950/95 text-emerald-300 border border-emerald-500/60 text-[11px] font-bold px-3 py-1.5 rounded-full shadow-2xl backdrop-blur-xs animate-in fade-in zoom-in-95">
                        {downloadNotice}
                      </span>
                    </div>
                  )}
                </div>
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
              {/* Category, Status & Stock Availability */}
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
                  <span aria-hidden="true">·</span>
                  {/* Stock Availability Indicator */}
                  {product.isRestocked && !isOutOfStock && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white border border-emerald-400 shadow-xs">
                      <span>✨ Restocked</span>
                    </span>
                  )}
                  {isOutOfStock ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-600 text-white border border-rose-500 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                      <span>Out of Stock</span>
                    </span>
                  ) : product.stockCount !== undefined && product.stockCount <= 3 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                      <span>Limited: Only {product.stockCount} Left</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                      <span>{product.stockCount ? `${product.stockCount} Available` : 'In Stock'}</span>
                    </span>
                  )}
                </div>
                {/* Action Buttons: Save Photo & Share Link Modules */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Bold Boxed Circular Save Photo Module */}
                  <div className="relative shrink-0 flex items-center gap-1.5 p-1.5 pl-2 pr-3 bg-neutral-100 hover:bg-neutral-200/70 rounded-2xl border-2 border-neutral-900 shadow-sm transition">
                    <button
                      type="button"
                      onClick={handleDownloadActiveImage}
                      disabled={isDownloadingSingle || isDownloadingZip}
                      className="w-10 h-10 rounded-full border-2 border-neutral-950 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-neutral-950 shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center font-bold group cursor-pointer ring-2 ring-emerald-300/60 shrink-0 disabled:opacity-50"
                      title={`Download ${itemSingular} Photo`}
                      aria-label={`Download ${itemSingular} Photo`}
                    >
                      <Download className="w-5 h-5 stroke-[2.6] text-neutral-950 group-hover:scale-110 transition-transform" />
                    </button>
                    <div className="flex flex-col text-left select-none">
                      <span className="text-[11px] font-black uppercase tracking-wider text-neutral-950 leading-tight">
                        Save
                      </span>
                      <span className="text-[10px] font-semibold text-neutral-600 leading-none">
                        Photo
                      </span>
                    </div>
                  </div>

                  {/* Bold Boxed Circular Share Button Module (User Request) */}
                  <div className="relative shrink-0 flex items-center gap-2 p-1.5 pl-2 pr-3 bg-neutral-100 hover:bg-neutral-200/70 rounded-2xl border-2 border-neutral-900 shadow-sm transition">
                    <button
                      type="button"
                      onClick={handleShare}
                      className="w-10 h-10 rounded-full border-2 border-neutral-950 bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center font-bold group cursor-pointer ring-2 ring-amber-300/60 shrink-0"
                      title={`Share ${itemSingular} Link`}
                      aria-label={`Share ${itemSingular} Link`}
                    >
                      <Share2 className="w-5 h-5 stroke-[2.6] text-neutral-950 group-hover:scale-110 transition-transform" />
                    </button>
                    <div className="flex flex-col text-left select-none">
                      <span className="text-[11px] font-black uppercase tracking-wider text-neutral-950 leading-tight">
                        Share
                      </span>
                      <span className="text-[10px] font-semibold text-neutral-600 leading-none">
                        Link
                      </span>
                    </div>
                    {copiedLink && (
                      <span className="absolute -bottom-9 right-0 bg-neutral-950 text-emerald-300 border border-emerald-500/60 text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-2xl z-30 animate-in fade-in zoom-in-95">
                        Link Copied! ✓
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {copiedLink && (
                <p className="text-[11px] font-semibold text-emerald-700 mb-2">{itemSingular} link copied to clipboard! Share it with friends and family.</p>
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

              {/* Rating and Reviews Counter (Controlled by Storefront Display Toggle) */}
              {settings.storefrontDisplay?.showCustomerReviews !== false && (
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
              )}

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
                {product.fabric && (
                  <div className="flex justify-between py-1 border-b border-neutral-200/60 items-center">
                    <span className="text-neutral-500 font-medium">Fabric Type</span>
                    <span className="font-medium text-neutral-900 text-right">{product.fabric}</span>
                  </div>
                )}
                {product.color && (
                  <div className="flex justify-between py-1 border-b border-neutral-200/60 items-center">
                    <span className="text-neutral-500 font-medium">Color Palette</span>
                    <span className="font-medium text-neutral-900 text-right">{product.color}</span>
                  </div>
                )}
                {(
                  (product.specificationFields && product.specificationFields.length > 0)
                    ? product.specificationFields
                    : (product.customAttributes && Object.keys(product.customAttributes).length > 0)
                    ? Object.keys(product.customAttributes).map((k) => ({ id: k, name: k }))
                    : [
                        { id: 'attr-weave', name: 'Weave Technique' },
                        { id: 'attr-border', name: 'Border & Pallu Detail' },
                        { id: 'attr-blouse', name: 'Blouse Piece' },
                        { id: 'attr-length', name: 'Total Length' },
                        { id: 'attr-occasion', name: 'Recommended Occasion' },
                      ]
                ).map((attr, idx, arr) => {
                  let val = product.customAttributes?.[attr.id] || product.customAttributes?.[attr.name];
                  if (!val) {
                    if (attr.id === 'attr-weave' || attr.name.toLowerCase().includes('weave')) {
                      val = product.weaveDetails;
                    } else if (attr.id === 'attr-border' || attr.name.toLowerCase().includes('border')) {
                      val = product.borderType;
                    } else if (attr.id === 'attr-blouse' || attr.name.toLowerCase().includes('blouse piece')) {
                      val = product.blousePieceIncluded ? 'Included (0.8m Running Silk)' : 'Not Included';
                    } else if (attr.id === 'attr-length' || attr.name.toLowerCase().includes('saree length') || attr.name.toLowerCase().includes('total length')) {
                      val = product.lengthMeters ? `${product.lengthMeters} Meters` : undefined;
                    } else if (attr.id === 'attr-occasion' || attr.name.toLowerCase().includes('occasion')) {
                      val = product.occasion;
                    } else if (attr.id === 'attr-pallu' || attr.name.toLowerCase().includes('pallu')) {
                      val = product.palluDetails;
                    } else if (attr.id === 'attr-bust-size' || attr.name.toLowerCase().includes('bust')) {
                      val = product.bustSize;
                    } else if (attr.id === 'attr-sleeve-length' || attr.name.toLowerCase().includes('sleeve length')) {
                      val = product.sleeveLength;
                    } else if (attr.id === 'attr-neck-style' || attr.name.toLowerCase().includes('neck')) {
                      val = product.neckStyle;
                    } else if (attr.id === 'attr-lining' || attr.name.toLowerCase().includes('lining')) {
                      val = product.liningDetails;
                    } else if (attr.id === 'attr-base-metal' || attr.name.toLowerCase().includes('base metal') || attr.name.toLowerCase().includes('material')) {
                      val = product.baseMetal;
                    } else if (attr.id === 'attr-gemstones' || attr.name.toLowerCase().includes('gemstone')) {
                      val = product.gemstoneDetails;
                    } else if (attr.id === 'attr-components' || attr.name.toLowerCase().includes('components') || attr.name.toLowerCase().includes('set')) {
                      val = product.setComponents;
                    } else if (attr.id === 'attr-closure' || attr.name.toLowerCase().includes('closure')) {
                      val = product.closureType;
                    } else if (attr.id === 'attr-kurti-length' || attr.name.toLowerCase().includes('kurti length')) {
                      val = product.kurtiLength;
                    } else if (attr.id === 'attr-cut-style' || attr.name.toLowerCase().includes('silhouette') || attr.name.toLowerCase().includes('cut')) {
                      val = product.cutStyle;
                    } else if (attr.id === 'attr-sleeve-style' || attr.name.toLowerCase().includes('sleeve style')) {
                      val = product.sleeveStyle;
                    } else if (attr.id === 'attr-embroidery' || attr.name.toLowerCase().includes('embroidery') || attr.name.toLowerCase().includes('print')) {
                      val = product.embroideryDetails;
                    }
                  }
                  if (!val) return null;
                  const isLast = idx === arr.length - 1;
                  return (
                    <div
                      key={attr.id}
                      className={`flex justify-between py-1 items-center ${
                        isLast ? '' : 'border-b border-neutral-200/60'
                      }`}
                    >
                      <span className="text-neutral-500 font-medium">{attr.name}</span>
                      <span className="font-medium text-neutral-900 text-right">{val}</span>
                    </div>
                  );
                })}
              </div>


              {/* Cancellation & Refund Policy Notice on Product Front (User Request) */}
              <div className="mb-6 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 space-y-1">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Important Order Policy Notice</span>
                </div>
                <p className="text-xs text-amber-950 font-bold leading-relaxed">
                  No cancellation once the order is shipped
                </p>
              </div>

              {/* Customer Reviews & Feedback Section (Controlled by Storefront Display Toggle) */}
              {settings.storefrontDisplay?.showCustomerReviews !== false && (
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
                      <p>No customer reviews yet for this {itemSingular.toLowerCase()}.</p>
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
            )}
          </div>

            {/* Quantity Selector Module (User Request: add number of products before buy or add to bag) */}
            {!isOutOfStock && (
              <div className="pt-3 pb-2 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/80 p-3.5 rounded-2xl border border-neutral-200/70 mb-2">
                <div>
                  <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <span>Quantity ({itemPlural})</span>
                    {product.stockStatus === 'limited' && (
                      <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded-full">
                        Max {product.stockCount} left
                      </span>
                    )}
                  </span>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Subtotal for {quantity} {quantity === 1 ? itemSingular.toLowerCase() : itemPlural.toLowerCase()}:{' '}
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
                    <span>Add {quantity > 1 ? `${quantity} ${itemPlural}` : 'to Shopping Bag'}</span>
                  </>
                )}
              </button>

              <button
                onClick={carouselAddedItemsCount > 0 ? handleBuyEnsembleNow : handleInstantBuy}
                disabled={isOutOfStock && carouselAddedItemsCount === 0}
                className={`flex-1 py-3.5 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition ${
                  isOutOfStock && carouselAddedItemsCount === 0
                    ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-amber-500/20 font-bold cursor-pointer'
                }`}
              >
                <span>
                  {isOutOfStock && carouselAddedItemsCount === 0
                    ? 'Currently Sold Out'
                    : carouselAddedItemsCount > 0
                    ? `Buy Now (${formatPrice(ensembleCombinedTotal)})`
                    : quantity > 1
                    ? `Buy ${quantity} ${itemPlural} (${formatPrice(product.price * quantity)})`
                    : 'Buy Now'}
                </span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>

        {/* Suggested Items & Dedicated Already Selected Products Column */}
        {suggestedItems.length > 0 && (
          <div className="border-t border-neutral-200/90 bg-neutral-50/40 p-4 sm:p-6 select-none">
            {addedCarouselItems.length > 0 ? (
              /* Two-Column Responsive Layout: Available Suggestions on Left, Already Selected Column on Right */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Column: Remaining Unselected Suggestions (if any) */}
                <div className={unselectedSuggestedItems.length > 0 ? "lg:col-span-7 space-y-3" : "hidden"}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <h4 className="text-sm font-semibold text-neutral-900 tracking-tight">
                        Suggested Add-ons
                      </h4>
                      <span className="text-[11px] text-neutral-400 font-medium">
                        ({unselectedSuggestedItems.length} available)
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => scrollCarousel(-180)}
                        className="w-7 h-7 rounded-full bg-white border border-neutral-200 shadow-2xs hover:shadow-xs flex items-center justify-center text-neutral-700 hover:text-black hover:bg-neutral-100 transition cursor-pointer"
                        title="Scroll left"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollCarousel(180)}
                        className="w-7 h-7 rounded-full bg-white border border-neutral-200 shadow-2xs hover:shadow-xs flex items-center justify-center text-neutral-700 hover:text-black hover:bg-neutral-100 transition cursor-pointer"
                        title="Scroll right"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div
                    ref={carouselScrollRef}
                    className="flex items-center gap-3 overflow-x-auto scrollbar-none scroll-smooth py-1"
                  >
                    {unselectedSuggestedItems.map((item) => (
                      <div
                        key={item.id}
                        className="group/card relative w-28 sm:w-32 aspect-3/4 rounded-2xl border border-neutral-200 bg-white shadow-2xs overflow-hidden shrink-0 text-left hover:border-amber-400 transition"
                      >
                        {/* Product image (contain so it adjusts according to natural image size) */}
                        <button
                          type="button"
                          onClick={(e) => handleViewSuggestedProduct(item, e)}
                          className="absolute inset-0 w-full h-full cursor-pointer focus:outline-hidden p-1.5 flex items-center justify-center bg-neutral-50"
                          title={`View ${item.title}`}
                        >
                          <img
                            src={item.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                            alt={item.title}
                            className="max-h-full max-w-full object-contain group-hover/card:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </button>

                        {item.category && (
                          <span className="absolute top-1.5 left-1.5 z-10 pointer-events-none text-[8px] font-bold uppercase tracking-wider bg-black/75 text-amber-200 backdrop-blur-xs px-1.5 py-0.5 rounded-md truncate max-w-[65%]">
                            {item.category}
                          </span>
                        )}

                        {/* + Button on top-right */}
                        <button
                          type="button"
                          onClick={(e) => handleIncrementSuggested(item, e)}
                          className="absolute top-1.5 right-1.5 z-20 w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold shadow-md flex items-center justify-center transition active:scale-90 cursor-pointer"
                          title={`Add ${item.title} (+)`}
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>

                        <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-4 pb-1.5 px-2 text-white">
                          <p className="text-[10px] text-neutral-200 font-medium truncate leading-tight">
                            {item.title}
                          </p>
                          <span className="text-[11px] font-bold text-white tabular-nums block mt-0.5">
                            {formatPrice(item.price)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Dedicated "Already Selected Products" Column */}
                <div className={unselectedSuggestedItems.length > 0 ? "lg:col-span-5 space-y-3" : "lg:col-span-12 space-y-3"}>
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 via-rose-50/40 to-amber-50/70 border-2 border-amber-300/80 shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between pb-2 border-b border-amber-200/80">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h4 className="font-serif font-bold text-sm text-neutral-950">
                          Already Selected Products
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-neutral-950">
                        {addedCarouselItems.length} {addedCarouselItems.length === 1 ? 'Item' : 'Items'} Selected
                      </span>
                    </div>

                    {/* List of Already Selected Products with image, title, price, and +/- controls */}
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {addedCarouselItems.map(({ item, quantity: itmQty }) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-white border border-amber-200/80 shadow-2xs"
                        >
                          <div
                            onClick={() => handleViewSuggestedProduct(item)}
                            className="flex items-center gap-2 min-w-0 cursor-pointer group/item hover:opacity-85 transition"
                            title={`View details of ${item.title}`}
                          >
                            <div className="w-10 h-12 rounded-lg bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center shrink-0 p-0.5 group-hover/item:border-amber-400">
                              <img
                                src={item.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                                alt={item.title}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-neutral-900 text-xs truncate max-w-[130px] sm:max-w-[180px] group-hover/item:text-amber-800 transition" title={item.title}>
                                {item.title}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] font-bold text-amber-950 tabular-nums">
                                  {formatPrice(item.price)}
                                </span>
                                {item.category && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-neutral-100 text-neutral-600 truncate max-w-[80px]">
                                    {item.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quantity Controls (- / + / Remove) */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center border border-neutral-300 rounded-lg bg-neutral-50 overflow-hidden">
                              <button
                                type="button"
                                onClick={(e) => handleDecrementSuggested(item, e)}
                                className="p-1 hover:bg-neutral-200 text-neutral-700 transition cursor-pointer"
                                title="Decrease (-)"
                              >
                                <Minus className="w-3 h-3 stroke-[2.5]" />
                              </button>
                              <span className="px-2 text-xs font-bold text-neutral-900 tabular-nums min-w-[18px] text-center">
                                {itmQty}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleIncrementSuggested(item, e)}
                                className="p-1 hover:bg-neutral-200 text-neutral-700 transition cursor-pointer"
                                title="Increase (+)"
                              >
                                <Plus className="w-3 h-3 stroke-[2.5]" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromCart(item.id);
                              }}
                              className="p-1 text-neutral-400 hover:text-rose-600 transition cursor-pointer"
                              title="Remove product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Cumulative Cost Breakdown */}
                    <div className="pt-2.5 border-t border-amber-200/80 space-y-1.5 text-xs">
                      <div className="flex justify-between text-neutral-600 text-[11px]">
                        <span>This {product.productType || 'Item'} ({quantity}×):</span>
                        <span className="font-semibold text-neutral-900 tabular-nums">
                          {formatPrice(currentSareeSubtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-neutral-600 text-[11px]">
                        <span>Selected Add-ons ({carouselAddedItemsCount} pcs):</span>
                        <span className="font-semibold text-neutral-900 tabular-nums">
                          {formatPrice(carouselAddedTotalCost)}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1 border-t border-amber-200/60">
                        <div>
                          <span className="font-bold text-neutral-950 text-xs uppercase tracking-wider block">
                            Cumulative Total Cost
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            Total {totalEnsembleItemsCount} items in bundle
                          </span>
                        </div>
                        <span className="text-base sm:text-lg font-bold font-serif text-neutral-950 tabular-nums">
                          {formatPrice(ensembleCombinedTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Bundle Action Buttons: Go to Cart, Buy Now */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {/* 1. Go to Cart */}
                      <button
                        type="button"
                        onClick={handleGoToCart}
                        className="py-2.5 px-3 rounded-xl border border-amber-400 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-98 cursor-pointer"
                        title="Open shopping cart drawer"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Go to Cart</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-neutral-950 font-semibold">
                          {cartCount}
                        </span>
                      </button>

                      {/* 2. Buy Now (Instant Checkout) */}
                      <button
                        type="button"
                        onClick={handleBuyEnsembleNow}
                        className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg shadow-amber-500/20 transition active:scale-98 cursor-pointer"
                        title="Proceed directly to checkout with bundle"
                      >
                        <span>Buy Now</span>
                        <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Single Carousel view when NO items are selected yet */
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-semibold text-neutral-900 tracking-tight">
                      Suggested Items
                    </h4>
                    <span className="text-[11px] text-neutral-400 font-medium">
                      ({suggestedItems.length} items)
                    </span>
                    <span className="text-[10px] text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full font-medium hidden sm:inline">
                      Tap + to select & create bundle
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => scrollCarousel(-220)}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-neutral-200 shadow-2xs hover:shadow-xs flex items-center justify-center text-neutral-700 hover:text-black hover:bg-neutral-50 transition cursor-pointer"
                      title="Scroll left"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollCarousel(220)}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-neutral-200 shadow-2xs hover:shadow-xs flex items-center justify-center text-neutral-700 hover:text-black hover:bg-neutral-50 transition cursor-pointer"
                      title="Scroll right"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="relative group/carousel">
                  <div
                    ref={carouselScrollRef}
                    className="flex items-center gap-3 overflow-x-auto scrollbar-none scroll-smooth px-1 py-1"
                  >
                    {suggestedItems.map((item) => (
                      <div
                        key={item.id}
                        className="group/card relative w-28 sm:w-32 md:w-36 aspect-[3/4] rounded-2xl border border-neutral-200/90 hover:border-amber-400/80 bg-neutral-50 shadow-2xs overflow-hidden shrink-0 transition-all duration-200 text-left"
                      >
                        <button
                          type="button"
                          onClick={(e) => handleViewSuggestedProduct(item, e)}
                          className="absolute inset-0 w-full h-full cursor-pointer focus:outline-hidden text-left p-1 flex items-center justify-center bg-white"
                          title={`Click to view ${item.title}`}
                        >
                          <img
                            src={item.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                            alt={item.title}
                            className="max-h-full max-w-full object-contain group-hover/card:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </button>

                        {item.category && (
                          <span className="absolute top-2 left-2 z-10 pointer-events-none text-[8px] sm:text-[9px] font-bold uppercase tracking-wider bg-black/75 text-amber-200 backdrop-blur-xs px-1.5 py-0.5 rounded-md truncate max-w-[60%]">
                            {item.category}
                          </span>
                        )}

                        <div className="absolute top-2 right-2 z-20">
                          <button
                            type="button"
                            onClick={(e) => handleIncrementSuggested(item, e)}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold shadow-md border border-amber-400 flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer"
                            title={`Add ${item.title} (+)`}
                          >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </div>

                        <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-6 pb-2 px-2 text-white">
                          <p className="text-[10px] text-neutral-200 font-medium truncate leading-tight">
                            {item.title}
                          </p>
                          <span className="text-[11px] sm:text-xs font-bold text-white tabular-nums block mt-0.5">
                            {formatPrice(item.price)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
