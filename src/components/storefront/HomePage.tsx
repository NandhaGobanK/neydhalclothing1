import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, SareeCategory, HeroBannerItem, VideoReelItem } from '../../types/store';
import { DEFAULT_HERO_BANNERS, DEFAULT_VIDEO_REELS } from '../../data/initialData';
import { formatPrice } from '../../utils/upi';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Play,
  X,
  Volume2,
  VolumeX,
  ShoppingBag,
  ArrowRight,
  Heart,
  Star,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';

interface HomePageProps {
  onSelectCategory: (categoryName: string) => void;
  onSelectProduct: (product: Product) => void;
  onExploreCatalog: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSelectCategory,
  onSelectProduct,
  onExploreCatalog,
}) => {
  const {
    settings,
    categories,
    publicProducts,
    addToCart,
    wishlist,
    toggleWishlist,
  } = useStore();

  const isDark = settings.themeMode === 'dark';

  // 1. Hero Banners (Auto Carousel)
  const banners: HeroBannerItem[] =
    settings.heroBanners && settings.heroBanners.length > 0
      ? settings.heroBanners
      : DEFAULT_HERO_BANNERS;

  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [isBannerPaused, setIsBannerPaused] = useState(false);

  useEffect(() => {
    if (banners.length <= 1 || isBannerPaused) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [banners.length, isBannerPaused]);

  const handlePrevBanner = () => {
    setCurrentBannerIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNextBanner = () => {
    setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
  };

  // 2. Featured Categories (Auto Carousel)
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [isCategoryPaused, setIsCategoryPaused] = useState(false);

  useEffect(() => {
    if (categories.length <= 3 || isCategoryPaused) return;
    const interval = setInterval(() => {
      if (categoryScrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = categoryScrollRef.current;
        const maxScroll = scrollWidth - clientWidth;
        const step = 260; // Card width + gap
        if (scrollLeft >= maxScroll - 20) {
          categoryScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          categoryScrollRef.current.scrollBy({ left: step, behavior: 'smooth' });
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [categories.length, isCategoryPaused]);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const step = 280;
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -step : step,
        behavior: 'smooth',
      });
    }
  };

  // 3. Shorts & Reels (Manual Carousel)
  const reels: VideoReelItem[] =
    settings.videoReels && settings.videoReels.length > 0
      ? settings.videoReels
      : DEFAULT_VIDEO_REELS;

  const reelScrollRef = useRef<HTMLDivElement>(null);
  const [activeReelModal, setActiveReelModal] = useState<VideoReelItem | null>(null);
  const [isReelMuted, setIsReelMuted] = useState(false);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  const scrollReels = (direction: 'left' | 'right') => {
    if (reelScrollRef.current) {
      const step = 240;
      reelScrollRef.current.scrollBy({
        left: direction === 'left' ? -step : step,
        behavior: 'smooth',
      });
    }
  };

  // 4. New Arrivals (Manual Carousel)
  const newArrivals = React.useMemo(() => {
    return [...publicProducts]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 10);
  }, [publicProducts]);

  const newArrivalsScrollRef = useRef<HTMLDivElement>(null);
  const scrollNewArrivals = (direction: 'left' | 'right') => {
    if (newArrivalsScrollRef.current) {
      const step = 300;
      newArrivalsScrollRef.current.scrollBy({
        left: direction === 'left' ? -step : step,
        behavior: 'smooth',
      });
    }
  };

  // 5. Best Selling Products (Manual Carousel)
  const bestSellers = React.useMemo(() => {
    return [...publicProducts]
      .filter((p) => p.isFeatured || p.stockCount > 0 || p.stockStatus === 'in_stock')
      .slice(0, 10);
  }, [publicProducts]);

  const bestSellersScrollRef = useRef<HTMLDivElement>(null);
  const scrollBestSellers = (direction: 'left' | 'right') => {
    if (bestSellersScrollRef.current) {
      const step = 300;
      bestSellersScrollRef.current.scrollBy({
        left: direction === 'left' ? -step : step,
        behavior: 'smooth',
      });
    }
  };

  // Helper to count products in a category
  const getCategoryCount = (categoryName: string) => {
    return publicProducts.filter(
      (p) => (p.category || '').toLowerCase() === categoryName.toLowerCase()
    ).length;
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-900'}`}>
      {/* ========================================================= */}
      {/* 1st TIER: Neydhal Clothing Banners (Automatic Carousel) */}
      {/* 1st TIER: Neydhal Clothing Banners (Automatic Carousel - Full Screen Width) */}
      <section
        className="w-full select-none"
        aria-label="Neydhal Banners Showcase"
      >
        <div
          className="relative w-full aspect-[1200/448] min-h-[260px] sm:min-h-[360px] md:min-h-[440px] overflow-hidden bg-neutral-950 shadow-md"
          onMouseEnter={() => setIsBannerPaused(true)}
          onMouseLeave={() => setIsBannerPaused(false)}
        >
          {banners.map((banner, index) => {
            const isActive = index === currentBannerIndex;
            return (
              <div
                key={banner.id}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
                {/* Background Banner Image */}
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="w-full h-full object-cover object-center"
                  loading={index === 0 ? 'eager' : 'lazy'}
                />

                {/* Dark Vignette Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/90 via-neutral-950/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/70 via-transparent to-black/20" />

                {/* Banner Content Panel */}
                <div className="relative z-20 h-full px-5 sm:px-8 lg:px-12 flex items-center">
                  <div className="max-w-xl py-4 sm:py-6">
                    {banner.badge && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-2 sm:mb-3 backdrop-blur-xs">
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>{banner.badge}</span>
                      </div>
                    )}
                    <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-white tracking-tight leading-tight mb-2 sm:mb-3 line-clamp-2">
                      {banner.title}
                    </h1>
                    <p className="text-neutral-200 text-xs sm:text-sm md:text-base mb-4 sm:mb-6 leading-relaxed font-light max-w-lg line-clamp-2 sm:line-clamp-3">
                      {banner.subtitle}
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (banner.linkCategory) {
                            onSelectCategory(banner.linkCategory);
                          } else {
                            onExploreCatalog();
                          }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs sm:text-sm transition-all shadow-md shadow-amber-500/25 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                      >
                        <span>{banner.buttonText || 'Explore Collection'}</span>
                        <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={onExploreCatalog}
                        className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs sm:text-sm backdrop-blur-md border border-white/20 transition cursor-pointer"
                      >
                        <span>All Sarees</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Banner Navigation Arrows */}
          {banners.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevBanner}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition cursor-pointer shadow-lg"
                aria-label="Previous banner"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                type="button"
                onClick={handleNextBanner}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition cursor-pointer shadow-lg"
                aria-label="Next banner"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Dot Indicators */}
              <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentBannerIndex(i)}
                    className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 cursor-pointer ${
                      i === currentBannerIndex ? 'w-6 sm:w-8 bg-amber-400' : 'w-1.5 sm:w-2 bg-white/40 hover:bg-white/70'
                    }`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2nd TIER: Neydhal clothing featured categories (Automatic) */}
      {/* ========================================================= */}
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6"
        onMouseEnter={() => setIsCategoryPaused(true)}
        onMouseLeave={() => setIsCategoryPaused(false)}
      >
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Curated Collections</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-serif font-bold tracking-tight">
              Neydhal clothing featured categories
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                onSelectCategory('all');
                onExploreCatalog();
              }}
              className="text-xs sm:text-sm font-semibold text-rose-900 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1 hover:underline cursor-pointer px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
              title="View all collections and filter"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollCategories('left')}
                className="w-9 h-9 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition shadow-xs cursor-pointer"
                aria-label="Scroll categories left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollCategories('right')}
                className="w-9 h-9 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition shadow-xs cursor-pointer"
                aria-label="Scroll categories right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Categories Carousel Container */}
        <div
          ref={categoryScrollRef}
          className="flex items-stretch gap-4 sm:gap-5 overflow-x-auto no-scrollbar scroll-smooth pb-3"
        >
          {categories.map((cat) => {
            const count = getCategoryCount(cat.name);
            return (
              <div
                key={cat.id}
                onClick={() => onSelectCategory(cat.name)}
                className="group shrink-0 w-[210px] sm:w-[250px] bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-amber-500/50 transition-all duration-300 cursor-pointer flex flex-col"
              >
                {/* Category Thumbnail: Calibrated to exact 356 × 498 pixels aspect ratio */}
                <div className="relative aspect-[356/498] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                  <img
                    src={cat.imageUrl || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                    alt={cat.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                  <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-semibold">
                    {count} {count === 1 ? 'Design' : 'Designs'}
                  </span>
                </div>

                {/* Category Details */}
                <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-serif font-bold text-sm sm:text-base text-neutral-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                      {cat.name}
                    </h3>
                    {cat.description && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-1 leading-relaxed">
                        {cat.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <span>View Weaves</span>
                    <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3rd TIER: Experience Neydhal clothing: shorts and reels    */}
      {/* (Manual Carousel - pure white background as requested)     */}
      {/* ========================================================= */}
      <section className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white py-5 sm:py-6 border-t border-neutral-100 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[11px] font-semibold uppercase tracking-wider mb-1.5 border border-rose-500/20">
                <Play className="w-3 h-3 fill-rose-600 text-rose-600 dark:fill-rose-300 dark:text-rose-300" />
                <span>Salem Atelier In Action</span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-serif font-bold tracking-tight text-neutral-950 dark:text-white">
                Experience Neydhal clothing: shorts and reels
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Tap any reel to watch master weavers, zari inspection, and authentic drape styling
              </p>
            </div>

            {/* Manual browsing buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollReels('left')}
                className="w-9 h-9 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-white flex items-center justify-center transition shadow-xs cursor-pointer"
                aria-label="Previous reel"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollReels('right')}
                className="w-9 h-9 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-white flex items-center justify-center transition shadow-xs cursor-pointer"
                aria-label="Next reel"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Reels Manual Scroll Row */}
          <div
            ref={reelScrollRef}
            className="flex items-stretch gap-4 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth pb-3"
          >
            {reels.map((reel) => (
              <div
                key={reel.id}
                onClick={() => setActiveReelModal(reel)}
                className="group relative shrink-0 w-[180px] sm:w-[220px] aspect-9/16 rounded-2xl overflow-hidden bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-md hover:shadow-xl cursor-pointer transform hover:scale-[1.02] transition-all duration-300"
              >
                {/* Reel Thumbnail */}
                <img
                  src={reel.thumbnailUrl}
                  alt={reel.title}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />

                {/* Gradient Shading */}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/30 to-black/30" />

                {/* Duration Badge */}
                {reel.duration && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-white text-[11px] font-mono font-semibold">
                    {reel.duration}
                  </div>
                )}

                {/* Center Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white group-hover:bg-amber-500 group-hover:border-amber-400 group-hover:text-neutral-950 transition-all duration-300 shadow-xl">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>

                {/* Title & Details at Bottom */}
                <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 text-left">
                  {reel.author && (
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-amber-400 block mb-1">
                      {reel.author}
                    </span>
                  )}
                  <h4 className="text-xs sm:text-sm font-bold text-white leading-snug line-clamp-2">
                    {reel.title}
                  </h4>
                  {reel.subtitle && (
                    <p className="text-[11px] text-neutral-300 line-clamp-1 mt-1 font-light">
                      {reel.subtitle}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4th TIER: New Arrivals (Manual Browsing Carousel)          */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 border-t border-neutral-100 dark:border-neutral-800">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Fresh off the pit loom</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-serif font-bold tracking-tight">
              New arrivals
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollNewArrivals('left')}
              className="w-9 h-9 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition shadow-xs cursor-pointer"
              aria-label="Scroll new arrivals left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollNewArrivals('right')}
              className="w-9 h-9 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition shadow-xs cursor-pointer"
              aria-label="Scroll new arrivals right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* New Arrivals Manual Scroll Row */}
        <div
          ref={newArrivalsScrollRef}
          className="flex items-stretch gap-4 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth pb-3"
        >
          {newArrivals.map((product) => {
            const isFav = wishlist.includes(product.id);
            return (
              <div
                key={product.id}
                className="group shrink-0 w-[240px] sm:w-[280px] bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col"
              >
                {/* Product Image: Calibrated to exact 356 × 498 pixels aspect ratio */}
                <div
                  className="relative aspect-[356/498] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 cursor-pointer"
                  onClick={() => onSelectProduct(product)}
                >
                  <img
                    src={product.images?.[0] || (product as any).imageUrl || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                    alt={product.title}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-amber-500 text-neutral-950 font-bold text-[10px] tracking-wide uppercase shadow-xs">
                    New Arrival
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWishlist(product.id);
                    }}
                    className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition shadow-md cursor-pointer ${
                      isFav
                        ? 'bg-rose-600 text-white'
                        : 'bg-white/90 dark:bg-neutral-900/90 text-neutral-600 dark:text-neutral-300 hover:text-rose-600'
                    }`}
                    aria-label="Add to wishlist"
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div onClick={() => onSelectProduct(product)} className="cursor-pointer">
                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 block mb-0.5">
                      {product.category || product.fabric}
                    </span>
                    <h3 className="font-serif font-bold text-sm sm:text-base text-neutral-900 dark:text-white line-clamp-1 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                      {product.title}
                    </h3>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-base font-bold text-neutral-900 dark:text-white">
                        {formatPrice(product.price)}
                      </span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="text-xs text-neutral-400 line-through">
                          {formatPrice(product.originalPrice)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectProduct(product)}
                      className="flex-1 py-2 rounded-xl bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-700 text-white text-xs font-semibold transition cursor-pointer text-center"
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      className="w-9 h-9 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-amber-500 hover:text-amber-600 flex items-center justify-center text-neutral-700 dark:text-neutral-200 transition cursor-pointer"
                      title="Add to cart"
                    >
                      <ShoppingBag className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5th TIER: Best Selling Products (Manual Carousel)         */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 border-t border-neutral-100 dark:border-neutral-800">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Patron Favorites</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-serif font-bold tracking-tight">
              Best selling products
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollBestSellers('left')}
              className="w-9 h-9 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition shadow-xs cursor-pointer"
              aria-label="Scroll best sellers left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollBestSellers('right')}
              className="w-9 h-9 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition shadow-xs cursor-pointer"
              aria-label="Scroll best sellers right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Best Sellers Manual Scroll Row */}
        <div
          ref={bestSellersScrollRef}
          className="flex items-stretch gap-4 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth pb-3"
        >
          {bestSellers.map((product) => {
            const isFav = wishlist.includes(product.id);
            return (
              <div
                key={product.id}
                className="group shrink-0 w-[240px] sm:w-[280px] bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col"
              >
                {/* Product Image: Calibrated to exact 356 × 498 pixels aspect ratio */}
                <div
                  className="relative aspect-[356/498] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 cursor-pointer"
                  onClick={() => onSelectProduct(product)}
                >
                  <img
                    src={product.images?.[0] || (product as any).imageUrl || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                    alt={product.title}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-neutral-900/90 text-amber-300 font-bold text-[10px] tracking-wide uppercase shadow-xs flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-300" />
                    <span>Best Seller</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWishlist(product.id);
                    }}
                    className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition shadow-md cursor-pointer ${
                      isFav
                        ? 'bg-rose-600 text-white'
                        : 'bg-white/90 dark:bg-neutral-900/90 text-neutral-600 dark:text-neutral-300 hover:text-rose-600'
                    }`}
                    aria-label="Add to wishlist"
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div onClick={() => onSelectProduct(product)} className="cursor-pointer">
                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 block mb-0.5">
                      {product.category || product.fabric}
                    </span>
                    <h3 className="font-serif font-bold text-sm sm:text-base text-neutral-900 dark:text-white line-clamp-1 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                      {product.title}
                    </h3>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-base font-bold text-neutral-900 dark:text-white">
                        {formatPrice(product.price)}
                      </span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="text-xs text-neutral-400 line-through">
                          {formatPrice(product.originalPrice)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectProduct(product)}
                      className="flex-1 py-2 rounded-xl bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-700 text-white text-xs font-semibold transition cursor-pointer text-center"
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      className="w-9 h-9 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-amber-500 hover:text-amber-600 flex items-center justify-center text-neutral-700 dark:text-neutral-200 transition cursor-pointer"
                      title="Add to cart"
                    >
                      <ShoppingBag className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================= */}
      {/* Interactive Reel Playback Modal                            */}
      {/* ========================================================= */}
      {activeReelModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setActiveReelModal(null)}
        >
          <div
            className="relative w-full max-w-sm sm:max-w-md aspect-9/16 max-h-[85vh] bg-neutral-950 rounded-3xl overflow-hidden shadow-2xl border border-neutral-800 flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Reel Header */}
            <div className="absolute top-0 inset-x-0 z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  {activeReelModal.author || 'Neydhal Atelier'}
                </span>
                <h4 className="text-white text-sm font-bold line-clamp-1">
                  {activeReelModal.title}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsReelMuted((m) => !m)}
                  className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition cursor-pointer"
                  aria-label={isReelMuted ? 'Unmute' : 'Mute'}
                >
                  {isReelMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReelModal(null)}
                  className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition cursor-pointer"
                  aria-label="Close reel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Video Player or Fallback Stream */}
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <video
                ref={videoPlayerRef}
                src={activeReelModal.videoUrl}
                poster={activeReelModal.thumbnailUrl}
                autoPlay
                loop
                playsInline
                muted={isReelMuted}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Bottom Reel Caption & CTA */}
            <div className="absolute bottom-0 inset-x-0 z-20 p-5 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
              <p className="text-xs text-neutral-200 leading-relaxed font-light mb-3">
                {activeReelModal.subtitle || 'Handcrafted silk masterweave from Salem atelier.'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveReelModal(null);
                    onExploreCatalog();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <span>Explore Featured Sarees</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
