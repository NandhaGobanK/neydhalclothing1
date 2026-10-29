import React, { useState } from 'react';
import { Product } from '../../types/store';
import { formatPrice, calculateDiscount } from '../../utils/upi';
import { Play, ShoppingBag, Eye, Star, Plus, Minus, Check, Heart, Sparkles, Clock } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { isProductRestocked, getRestockRemainingTime } from '../../utils/productValidation';

interface ProductCardProps {
  product: Product;
  onOpenDetails: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onOpenDetails }) => {
  const { addToCart, settings, getProductAverageRating, toggleWishlist, isInWishlist, setIsCheckoutOpen } = useStore();
  const { rating, count } = getProductAverageRating(product.id);
  const [quantity, setQuantity] = useState(1);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const inWishlist = isInWishlist(product.id);

  const isOutOfStock = product.stockStatus === 'out_of_stock' || (product.stockCount !== undefined && product.stockCount <= 0);
  const maxStock = isOutOfStock ? 0 : (product.stockCount !== undefined && product.stockCount > 0 ? product.stockCount : 99);
  const hasRestockTag = isProductRestocked(product, settings?.restockTagDurationHours);
  const restockTimeLeft = hasRestockTag ? getRestockRemainingTime(product, settings?.restockTagDurationHours) : null;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    addToCart(product, quantity);
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2000);
  };

  const hasVideo = !!product.videoUrl || !!product.instagramShortsUrl;
  const discount = calculateDiscount(product.price, product.originalPrice);
  const isDark = settings.themeMode === 'dark';

  return (
    <div
      onClick={() => onOpenDetails(product)}
      className={`group cursor-pointer flex flex-col rounded-2xl overflow-hidden transition-all duration-200 shadow-xs hover:shadow-xl hover:-translate-y-1 ${
        isDark
          ? 'bg-neutral-900 border border-neutral-800 text-neutral-100 hover:border-neutral-700'
          : 'bg-white border border-neutral-200/80 text-neutral-900'
      }`}
    >
      {/* Product Image Area: Calibrated to exact 356 × 498 pixels aspect ratio */}
      <div className="relative aspect-[356/498] bg-neutral-100 overflow-hidden">
        <img
          src={product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
          alt={product.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Top Badges (Offer Tag, Stock Tag directly below Offer, Restocked Badge & Video Reel) */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start z-10">
          {discount.hasDiscount && (
            <div className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-bold shadow-md tracking-wider">
              {discount.discountPercentage}% OFF
            </div>
          )}

          {/* Stock tag placed directly below the Offer tag */}
          {!isOutOfStock ? (
            product.stockCount !== undefined && product.stockCount <= 3 ? (
              <div className="px-2 py-0.5 rounded-full bg-rose-900/90 text-rose-200 text-[10px] font-bold border border-rose-700/60 shadow-xs backdrop-blur-xs">
                Only {product.stockCount} Left
              </div>
            ) : (
              <div className="px-2 py-0.5 rounded-full bg-emerald-950/85 text-emerald-300 text-[10px] font-bold border border-emerald-700/50 backdrop-blur-xs">
                {product.stockCount ? `${product.stockCount} in stock` : 'In Stock'}
              </div>
            )
          ) : (
            <div className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-bold text-[10px] shadow-sm">
              Out of Stock
            </div>
          )}

          {hasRestockTag && !isOutOfStock && (
            <div 
              title={restockTimeLeft ? `Restocked! Tag expires in ${restockTimeLeft}` : 'Recently Restocked'}
              className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-md tracking-wider flex items-center gap-1 border border-emerald-400 animate-in zoom-in-75"
            >
              <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
              <span>Restocked</span>
            </div>
          )}
          {hasVideo && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-white text-[10px] font-medium tracking-wide">
              <Play className="w-2.5 h-2.5 fill-white text-white" />
              <span>Video</span>
            </div>
          )}
        </div>

        {/* Top-Right Action Controls (Wishlist Heart only - Download is exclusive to Product Detail page) */}
        <div className="absolute top-3 right-3 z-15 flex flex-col gap-1.5 items-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(product.id);
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md backdrop-blur-md transition-all duration-200 cursor-pointer ${
              inWishlist
                ? 'bg-rose-600 text-white ring-2 ring-white scale-105 shadow-rose-900/30'
                : 'bg-white/85 text-neutral-700 hover:text-rose-600 hover:bg-white hover:scale-105'
            }`}
            title={inWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
            aria-label={inWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
          >
            <Heart
              className="w-4 h-4 transition-transform active:scale-125"
              fill={inWishlist ? 'currentColor' : 'none'}
            />
          </button>
        </div>

        {/* Prominent Out-of-Stock Center Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center p-4 text-center pointer-events-none animate-in fade-in duration-200">
            <span className="px-3.5 py-1.5 rounded-full bg-rose-600 text-white font-bold text-xs uppercase tracking-wider shadow-xl border border-rose-400 flex items-center gap-1.5 ring-2 ring-black/40">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Out of Stock</span>
            </span>
            <p className="text-[11px] text-neutral-200 font-medium mt-1.5 drop-shadow-md">
              Sold out · Restock in progress
            </p>
          </div>
        )}

        {/* SKU Identifier Badge */}
        {product.productCode && (
          <div className="absolute bottom-2 left-2 bg-neutral-900/80 backdrop-blur-xs text-amber-200 font-mono text-[9px] px-1.5 py-0.5 rounded border border-neutral-700/60 font-semibold tracking-wider z-10">
            {product.productCode}
          </div>
        )}
      </div>

      {/* Details Area — Exact Match with Category Template */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-2">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-medium">
            <span>{product.fabric}</span>
            <span>•</span>
            <span>{product.color}</span>
          </div>
          <h3 className={`font-serif font-bold text-xs sm:text-sm line-clamp-2 mt-0.5 leading-snug transition-colors ${
            isDark ? 'text-white group-hover:text-amber-300' : 'text-neutral-900 group-hover:text-rose-900'
          }`}>
            {product.title}
          </h3>
        </div>

        {/* Pricing block & Action buttons: Add and BUY */}
        <div className={`pt-1 border-t ${isDark ? 'border-neutral-800' : 'border-neutral-100'} flex items-baseline justify-between gap-1 flex-wrap`}>
          <div className="flex items-baseline gap-1.5">
            <span className={`font-bold text-sm sm:text-base tabular-nums ${isDark ? 'text-white' : 'text-neutral-900'}`}>
              {formatPrice(discount.sellingPrice)}
            </span>
            {discount.hasDiscount && (
              <span className="text-[11px] text-neutral-400 line-through tabular-nums">
                {formatPrice(discount.mrp)}
              </span>
            )}
          </div>

          {/* Action buttons: Add & BUY */}
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={isOutOfStock}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                addedSuccess
                  ? 'bg-emerald-600 text-white'
                  : isOutOfStock
                  ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
              }`}
              title="Add to bag"
            >
              {addedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[10px]">Added</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[10px]">Add</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isOutOfStock) {
                  addToCart(product, 1);
                  setIsCheckoutOpen(true);
                }
              }}
              disabled={isOutOfStock}
              className="p-1.5 sm:px-3 sm:py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 bg-rose-900 hover:bg-rose-800 text-white cursor-pointer shadow-2xs disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed"
              title="Buy now with instant checkout"
            >
              <span className="text-[10px] uppercase tracking-wider">BUY</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
