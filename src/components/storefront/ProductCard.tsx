import React, { useState } from 'react';
import { Product } from '../../types/store';
import { formatPrice, calculateDiscount } from '../../utils/upi';
import { Play, ShoppingBag, Eye, Star, Plus, Minus, Check, Heart } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

interface ProductCardProps {
  product: Product;
  onOpenDetails: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onOpenDetails }) => {
  const { addToCart, settings, getProductAverageRating, toggleWishlist, isInWishlist } = useStore();
  const { rating, count } = getProductAverageRating(product.id);
  const [quantity, setQuantity] = useState(1);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const inWishlist = isInWishlist(product.id);

  const isOutOfStock = product.stockStatus === 'out_of_stock' || (product.stockCount !== undefined && product.stockCount <= 0);
  const maxStock = isOutOfStock ? 0 : (product.stockCount !== undefined && product.stockCount > 0 ? product.stockCount : 99);

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
      {/* Product Image Area */}
      <div className="relative aspect-4/5 bg-neutral-100 overflow-hidden">
        <img
          src={product.images[0] || '/src/assets/images/hero_saree_atelier_1791651761357.jpg'}
          alt={product.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Top Badges (Discount Offer % Tag & Video Reel) */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          {discount.hasDiscount && (
            <div className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-bold shadow-md tracking-wider">
              {discount.discountPercentage}% OFF
            </div>
          )}
          {hasVideo && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-white text-[10px] font-medium tracking-wide">
              <Play className="w-2.5 h-2.5 fill-white text-white" />
              <span>Video</span>
            </div>
          )}
        </div>

        {/* Stock availability badge */}
        {isOutOfStock ? (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-neutral-900/90 text-neutral-300 text-[11px] font-medium border border-neutral-700">
            Out of Stock
          </div>
        ) : product.stockCount !== undefined && product.stockCount <= 3 ? (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-rose-900/90 text-rose-200 text-[11px] font-medium border border-rose-700/60 shadow-xs">
            Only {product.stockCount} Left
          </div>
        ) : (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-emerald-950/85 text-emerald-300 text-[11px] font-medium border border-emerald-700/50 backdrop-blur-xs">
            {product.stockCount ? `${product.stockCount} Available` : 'In Stock'}
          </div>
        )}

        {/* Hover Quick Actions */}
        <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-2">
          <button
            onClick={handleQuickAdd}
            disabled={isOutOfStock}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg backdrop-blur-xs transition ${
              isOutOfStock
                ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed'
                : addedSuccess
                ? 'bg-emerald-700 text-white'
                : 'bg-white hover:bg-neutral-950 text-neutral-950 hover:text-white'
            }`}
          >
            {addedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Added {quantity}!</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{isOutOfStock ? 'Sold Out' : quantity > 1 ? `Add (${quantity}) to Bag` : 'Add to Bag'}</span>
              </>
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(product);
            }}
            className="p-2.5 rounded-xl bg-white/90 hover:bg-neutral-950 text-neutral-950 hover:text-white transition shadow-lg"
            title="View Saree Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Details Area */}
      <div className="p-4 flex flex-col flex-1">
        {/* Metadata with Unique Product Code */}
        <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5 font-medium">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-amber-800 uppercase tracking-wider text-[11px] font-semibold">{product.fabric}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{product.color}</span>
          </div>
          <span className="font-mono text-[10px] font-semibold text-neutral-600 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded tracking-wider shrink-0" title={`Unique Code: ${product.productCode}`}>
            {product.productCode}
          </span>
        </div>

        <h3 className={`font-serif text-base sm:text-lg font-bold line-clamp-1 transition-colors ${
          isDark ? 'text-white group-hover:text-amber-300' : 'text-neutral-900 group-hover:text-rose-900'
        }`}>
          {product.title}
        </h3>

        {/* Customer Rating and Review Count (Controlled by Storefront Display Toggle) */}
        {settings.storefrontDisplay?.showCustomerReviews !== false && (
          <div className="flex items-center gap-1.5 text-xs mt-1 mb-1.5">
            <div className="flex items-center text-amber-500">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              <span className={`font-bold ml-1 text-xs ${isDark ? 'text-neutral-200' : 'text-neutral-900'}`}>{rating.toFixed(1)}</span>
            </div>
            <span className="text-neutral-400 text-[11px]">
              ({count > 0 ? `${count} ${count === 1 ? 'review' : 'reviews'}` : 'New drape'})
            </span>
          </div>
        )}

        <p className={`text-xs line-clamp-2 mt-0.5 mb-3 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
          {product.subtitle || product.description}
        </p>

        {/* Pricing & Offer Details */}
        <div className={`mt-auto pt-2 border-t ${isDark ? 'border-neutral-800' : 'border-neutral-100'}`}>
          <div className="flex items-baseline justify-between flex-wrap gap-1">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className={`text-base sm:text-lg font-bold tabular-nums ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                {formatPrice(discount.sellingPrice)}
              </span>
              {discount.hasDiscount && (
                <span className="text-xs text-neutral-400 line-through tabular-nums">
                  {formatPrice(discount.mrp)}
                </span>
              )}
              {discount.hasDiscount && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                  {discount.discountPercentage}% OFF
                </span>
              )}
            </div>

            {settings.delivery?.freeDeliveryEnabled && product.price >= settings.delivery.freeDeliveryThreshold ? (
              <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md">
                Free Delivery
              </span>
            ) : settings.delivery?.shippingFee ? (
              <span className="text-[10px] text-neutral-600 font-medium bg-neutral-100 px-2 py-0.5 rounded-md">
                +₹{settings.delivery.shippingFee} Delivery
              </span>
            ) : null}
          </div>

          {/* Offer Savings in Amount */}
          {discount.hasDiscount && (
            <p className="text-[11px] font-semibold text-emerald-700 mt-1 flex items-center gap-1">
              <span>🏷️ Save {formatPrice(discount.discountAmount)}</span>
            </p>
          )}
        </div>

        {/* Public Front Quantity Selector & Add to Bag (User Request) */}
        <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center gap-2">
          {!isOutOfStock ? (
            <>
              {/* Quantity Stepper */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center border border-neutral-200 rounded-xl bg-neutral-50 shadow-2xs overflow-hidden shrink-0"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (quantity > 1) setQuantity((q) => q - 1);
                  }}
                  disabled={quantity <= 1}
                  className="p-1.5 hover:bg-neutral-200 text-neutral-600 disabled:opacity-30 transition"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-2 text-xs font-bold tabular-nums text-neutral-800 min-w-5 text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (quantity < maxStock) setQuantity((q) => q + 1);
                  }}
                  disabled={quantity >= maxStock}
                  className="p-1.5 hover:bg-neutral-200 text-neutral-600 disabled:opacity-30 transition"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Add to Bag Action */}
              <button
                type="button"
                onClick={handleQuickAdd}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs ${
                  addedSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-900 hover:bg-amber-600 text-white'
                }`}
              >
                {addedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Added {quantity}!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>{quantity > 1 ? `Add (${quantity}) to Bag` : 'Add to Bag'}</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="w-full py-1.5 px-3 rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-500 text-center text-xs font-semibold flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Out of Stock</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
