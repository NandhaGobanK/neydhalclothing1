import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types/store';
import { Heart, ShoppingBag, Check, ArrowRight, Sparkles } from 'lucide-react';
import { formatPrice } from '../../utils/upi';

interface WishlistBrowserProps {
  onOpenDetails: (product: Product) => void;
  onExploreCatalog: () => void;
}

export const WishlistBrowser: React.FC<WishlistBrowserProps> = ({
  onOpenDetails,
  onExploreCatalog,
}) => {
  const { publicProducts, wishlist, toggleWishlist, addToCart } = useStore();
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  const wishlistProducts = publicProducts.filter((p) => wishlist.includes(p.id));

  const handleQuickAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    addToCart(product, 1);
    setAddedProductId(product.id);
    setTimeout(() => setAddedProductId(null), 1800);
  };

  return (
    <div className="min-h-screen pb-24 bg-neutral-50/50">
      {/* Header */}
      <div className="sticky top-18 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-4 py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
              <Heart className="w-4 h-4 fill-rose-600 text-rose-600" />
            </span>
            <div>
              <h1 className="font-serif font-bold text-base sm:text-lg text-neutral-900">
                Your Saved Saree Wishlist
              </h1>
              <p className="text-[11px] text-neutral-500">
                {wishlistProducts.length} {wishlistProducts.length === 1 ? 'item' : 'items'} saved for special occasions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onExploreCatalog}
            className="text-xs font-semibold text-neutral-700 hover:text-neutral-900 px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 transition cursor-pointer"
          >
            Explore Catalog
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {wishlistProducts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-neutral-200 p-12 text-center max-w-md mx-auto space-y-4 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-400 mx-auto flex items-center justify-center">
              <Heart className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif font-bold text-neutral-900 text-lg">
                Your Wishlist is Empty
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Save your favorite bridal drapes, Kanjivaram silks, and festive sarees by tapping the heart icon while browsing.
              </p>
            </div>
            <button
              type="button"
              onClick={onExploreCatalog}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Discover Products</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {wishlistProducts.map((product) => {
              const discountPercent =
                product.originalPrice && product.originalPrice > product.price
                  ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                  : null;

              return (
                <div
                  key={product.id}
                  onClick={() => onOpenDetails(product)}
                  className="group bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col cursor-pointer relative"
                >
                  <div className="relative aspect-3/4 overflow-hidden bg-neutral-100">
                    <img
                      src={product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWishlist(product.id);
                      }}
                      className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white text-rose-600 ring-2 ring-rose-500 flex items-center justify-center shadow-md cursor-pointer"
                      title="Remove from wishlist"
                    >
                      <Heart className="w-4 h-4 fill-rose-600" />
                    </button>

                    {discountPercent && discountPercent > 0 && (
                      <div className="absolute top-2.5 left-2.5 bg-rose-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-md shadow-xs">
                        {discountPercent}% OFF
                      </div>
                    )}

                    <div className="absolute bottom-2 left-2 bg-neutral-900/80 backdrop-blur-xs text-amber-200 font-mono text-[9px] px-1.5 py-0.5 rounded border border-neutral-700/60 font-semibold tracking-wider">
                      {product.productCode}
                    </div>
                  </div>

                  <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-medium">
                        <span>{product.fabric}</span>
                        <span>•</span>
                        <span>{product.color}</span>
                      </div>
                      <h3 className="font-serif font-bold text-xs sm:text-sm text-neutral-900 group-hover:text-amber-800 transition line-clamp-2 mt-0.5 leading-snug">
                        {product.title}
                      </h3>
                    </div>

                    <div className="pt-1 border-t border-neutral-100 flex items-baseline justify-between gap-1 flex-wrap">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-sm sm:text-base text-neutral-900 tabular-nums">
                          {formatPrice(product.price)}
                        </span>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span className="text-[11px] text-neutral-400 line-through tabular-nums">
                            {formatPrice(product.originalPrice)}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleQuickAddToCart(e, product)}
                        disabled={product.stockStatus === 'out_of_stock'}
                        className={`p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                          addedProductId === product.id
                            ? 'bg-emerald-600 text-white'
                            : product.stockStatus === 'out_of_stock'
                            ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                        }`}
                      >
                        {addedProductId === product.id ? (
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
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
