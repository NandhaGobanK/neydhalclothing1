import React from 'react';
import { Product } from '../../types/store';
import { formatPrice } from '../../utils/upi';
import { Play, ShoppingBag, Eye } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

interface ProductCardProps {
  product: Product;
  onOpenDetails: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onOpenDetails }) => {
  const { addToCart, settings } = useStore();

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.stockStatus === 'out_of_stock') return;
    addToCart(product, 1);
  };

  const hasVideo = !!product.videoUrl;
  const isOutOfStock = product.stockStatus === 'out_of_stock';
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;

  return (
    <div
      onClick={() => onOpenDetails(product)}
      className="group cursor-pointer flex flex-col bg-white rounded-2xl overflow-hidden border border-neutral-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
    >
      {/* Product Image Area */}
      <div className="relative aspect-4/5 bg-neutral-100 overflow-hidden">
        <img
          src={product.images[0] || '/src/assets/images/hero_saree_atelier_1791651761357.jpg'}
          alt={product.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Video Preview Tag if video available */}
        {hasVideo && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-xs text-white text-[11px] font-medium tracking-wide">
            <Play className="w-3 h-3 fill-white text-white" />
            <span>Video Reel</span>
          </div>
        )}

        {/* Stock / Limited tag */}
        {isOutOfStock ? (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-neutral-900/90 text-neutral-300 text-[11px] font-medium">
            Sold Out
          </div>
        ) : product.stockStatus === 'limited' ? (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-rose-900/90 text-rose-200 text-[11px] font-medium">
            Only {product.stockCount} Left
          </div>
        ) : null}

        {/* Hover Quick Actions */}
        <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-2">
          <button
            onClick={handleQuickAdd}
            disabled={isOutOfStock}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg backdrop-blur-xs transition ${
              isOutOfStock
                ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed'
                : 'bg-white hover:bg-neutral-950 text-neutral-950 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{isOutOfStock ? 'Sold Out' : 'Add to Bag'}</span>
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

        <h3 className="font-serif text-base sm:text-lg font-bold text-neutral-900 line-clamp-1 group-hover:text-rose-900 transition-colors">
          {product.title}
        </h3>

        <p className="text-xs text-neutral-500 line-clamp-2 mt-1 mb-3">
          {product.subtitle || product.description}
        </p>

        {/* Pricing */}
        <div className="mt-auto pt-2 border-t border-neutral-100 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-base sm:text-lg font-bold text-neutral-900 tabular-nums">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-neutral-400 line-through tabular-nums">
                {formatPrice(product.originalPrice!)}
              </span>
            )}
          </div>
          {settings.delivery?.freeDeliveryEnabled && product.price >= settings.delivery.freeDeliveryThreshold ? (
            <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md">
              Free Delivery
            </span>
          ) : settings.delivery?.shippingFee ? (
            <span className="text-[11px] text-neutral-600 font-medium bg-neutral-100 px-2 py-0.5 rounded-md">
              +₹{settings.delivery.shippingFee} Delivery
            </span>
          ) : (
            <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md">
              Free Delivery
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
