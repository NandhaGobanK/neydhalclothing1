import React from 'react';
import { useStore } from '../../context/StoreContext';
import { formatPrice } from '../../utils/upi';
import { Product } from '../../types/store';
import { isProductInActiveCategories } from '../../utils/productValidation';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShoppingBag,
  ShieldCheck,
  Truck,
  Sparkles,
  AlertCircle,
  Check,
} from 'lucide-react';

interface CartPageProps {
  onContinueShopping?: () => void;
  onOpenProductDetails?: (product: Product) => void;
}

export const CartPage: React.FC<CartPageProps> = ({
  onContinueShopping,
  onOpenProductDetails,
}) => {
  const {
    cart,
    products,
    categories,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    cartTotal,
    cartCount,
    cartShippingFee,
    isFreeDeliveryUnlocked,
    amountNeededForFreeDelivery,
    cartGrandTotal,
    settings,
    setIsCheckoutOpen,
    setCustomerActiveTab,
    cartStockWarning,
    clearCartStockWarning,
    dismissCartPriceAlert,
  } = useStore();

  const [localWarning, setLocalWarning] = React.useState<string | null>(null);
  const [addedCrossSell, setAddedCrossSell] = React.useState<Record<string, boolean>>({});

  // Real-time valid cart items strictly filtered against active boutique categories
  const validCartItems = React.useMemo(() => {
    return cart.filter((item) => isProductInActiveCategories(item.product, categories));
  }, [cart, categories]);

  // Cross-sell recommendations derived from items currently in the cart
  const cartCrossSellSuggestions = React.useMemo(() => {
    if (validCartItems.length === 0) return [];
    const cartProductIds = new Set(validCartItems.map((i) => i.product.id));
    const activeCategoryNames = (categories || [])
      .map((c) => (c?.name ? String(c.name).toLowerCase().trim() : ''))
      .filter(Boolean);

    const linkedIds = new Set<string>();
    const fallbackCategories = new Set<string>();

    validCartItems.forEach((item) => {
      if (item.product.crossSellProductIds) {
        item.product.crossSellProductIds.forEach((id) => linkedIds.add(id));
      }
      if (item.product.crossSellCategoryNames) {
        item.product.crossSellCategoryNames.forEach((cat) => {
          const catClean = cat.toLowerCase().trim();
          if (activeCategoryNames.some((ac) => ac === catClean || ac.includes(catClean) || catClean.includes(ac))) {
            fallbackCategories.add(catClean);
          }
        });
      }
    });

    if (fallbackCategories.size === 0) {
      if (activeCategoryNames.some((ac) => ac.includes('blouse'))) {
        fallbackCategories.add('designer blouses');
      }
    }

    const directMatches = products.filter(
      (p) =>
        linkedIds.has(p.id) &&
        !cartProductIds.has(p.id) &&
        p.stockStatus !== 'out_of_stock' &&
        p.isVisible !== false &&
        isProductInActiveCategories(p, categories)
    );

    const catMatches = products.filter(
      (p) =>
        !linkedIds.has(p.id) &&
        !cartProductIds.has(p.id) &&
        p.stockStatus !== 'out_of_stock' &&
        p.isVisible !== false &&
        p.category &&
        fallbackCategories.has(p.category.toLowerCase().trim()) &&
        isProductInActiveCategories(p, categories)
    );

    return [...directMatches, ...catMatches].slice(0, 4);
  }, [validCartItems, products, categories]);

  const handleQuickAddCrossSell = (item: Product) => {
    addToCart(item, 1);
    setAddedCrossSell((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedCrossSell((prev) => ({ ...prev, [item.id]: false }));
    }, 1800);
  };

  React.useEffect(() => {
    if (cartStockWarning) {
      setLocalWarning(cartStockWarning);
      const timer = setTimeout(() => {
        setLocalWarning(null);
        clearCartStockWarning();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [cartStockWarning, clearCartStockWarning]);

  const handleBack = () => {
    if (onContinueShopping) {
      onContinueShopping();
    } else {
      setCustomerActiveTab('categories');
    }
  };

  return (
    <div className="min-h-screen pb-28 bg-neutral-50/60">
      {/* Top Header Bar */}
      <div className="sticky top-18 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-4 py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-neutral-700 hover:text-neutral-950 px-2.5 py-1.5 rounded-xl hover:bg-neutral-100 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-rose-900" />
              <span>Continue Shopping</span>
            </button>
            <div className="h-4 w-px bg-neutral-200 hidden sm:block" />
            <h1 className="font-serif font-bold text-base sm:text-lg text-neutral-900 hidden sm:block">
              Your Shopping Bag ({cartCount} {cartCount === 1 ? 'item' : 'items'})
            </h1>
          </div>

          {validCartItems.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
            >
              Empty Bag
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Real-time Inventory Alert Warning */}
        {localWarning && (
          <div className="p-3 px-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{localWarning}</span>
          </div>
        )}

        {/* Free Delivery Target Banner */}
        {settings.delivery.freeDeliveryThreshold > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/80 border border-amber-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-amber-900 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-700" />
                <span>
                  {isFreeDeliveryUnlocked
                    ? '🎉 Free Express Delivery Unlocked Across India!'
                    : `Add ${formatPrice(amountNeededForFreeDelivery)} more to unlock Free Delivery!`}
                </span>
              </span>
              <span className="font-semibold text-amber-800">
                Threshold: {formatPrice(settings.delivery.freeDeliveryThreshold)}
              </span>
            </div>
            <div className="w-full bg-amber-200/80 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-rose-700 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    (cartTotal / (settings.delivery.freeDeliveryThreshold || 1)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {validCartItems.length === 0 ? (
          <div className="bg-white rounded-3xl border border-neutral-200 p-12 text-center max-w-md mx-auto space-y-4 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-neutral-900">Your bag is currently empty</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Explore our curated collections and add your favorite styles to your bag.
              </p>
            </div>
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer shadow-sm"
            >
              <span>Explore Collections</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Cart Items */}
            <div className="lg:col-span-2 space-y-3">
              {validCartItems.map((item) => {
                const maxStock = item.product.stockCount ?? 10;
                return (
                  <div
                    key={item.product.id}
                    className="p-4 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs flex gap-3 sm:gap-4 items-center justify-between transition hover:shadow-xs"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <img
                        src={item.product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                        alt={item.product.title}
                        className="w-18 h-24 sm:w-20 sm:h-26 rounded-xl object-cover border border-neutral-200 shrink-0"
                      />
                      <div className="space-y-1 min-w-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 block">
                          {item.product.fabric || item.product.category}
                        </span>
                        <h3 className="font-serif font-bold text-xs sm:text-sm text-neutral-900 truncate">
                          {item.product.title}
                        </h3>
                        <p className="text-[11px] font-mono text-neutral-400">
                          SKU: {item.product.productCode}
                        </p>
                        <p className="font-bold text-sm text-neutral-900 pt-0.5">
                          {formatPrice(item.product.price)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="flex items-center gap-1.5 bg-neutral-100 rounded-xl p-1 border border-neutral-200">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-white hover:bg-neutral-200 text-neutral-700 flex items-center justify-center transition cursor-pointer"
                          title="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={item.quantity >= maxStock}
                          onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                          className="w-7 h-7 rounded-lg bg-white hover:bg-neutral-200 text-neutral-700 flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-neutral-400 hover:text-rose-600 transition flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Cross-Sell Recommendations Section */}
              {cartCrossSellSuggestions.length > 0 && (
                <div className="pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <h3 className="font-serif font-bold text-sm text-neutral-900">
                      Recommended Pairings & Matches
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {cartCrossSellSuggestions.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl border border-neutral-200 p-2.5 flex flex-col justify-between shadow-2xs space-y-2"
                      >
                        <div className="aspect-3/4 rounded-lg overflow-hidden bg-neutral-100">
                          <img
                            src={item.images[0]}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-[11px] font-bold text-neutral-900 line-clamp-1">{item.title}</h4>
                          <p className="text-[11px] font-bold text-rose-900">{formatPrice(item.price)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickAddCrossSell(item)}
                          className="w-full py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {addedCrossSell[item.id] ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right 1 Col: Summary & Checkout CTA */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4 shadow-2xs">
                <h3 className="font-serif font-bold text-base text-neutral-900 border-b border-neutral-100 pb-3">
                  Order Summary
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-neutral-600">
                    <span>Items Subtotal</span>
                    <span className="font-bold text-neutral-900">{formatPrice(cartTotal)}</span>
                  </div>

                  <div className="flex justify-between text-neutral-600">
                    <span>Express Courier Delivery</span>
                    <span>
                      {cartShippingFee === 0 ? (
                        <span className="text-emerald-700 font-bold uppercase tracking-wider text-[11px]">
                          FREE
                        </span>
                      ) : (
                        <span className="font-bold text-neutral-900">{formatPrice(cartShippingFee)}</span>
                      )}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-neutral-200 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-neutral-900">Grand Total</span>
                    <span className="text-lg font-serif font-bold text-neutral-950">
                      {formatPrice(cartGrandTotal)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCustomerActiveTab('checkout')}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-950 via-rose-900 to-rose-950 hover:from-rose-900 hover:to-rose-800 text-amber-200 hover:text-white font-bold text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <span>Proceed to Prepaid Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="pt-2 border-t border-neutral-100 flex items-center gap-2 text-[11px] text-neutral-500 justify-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>100% Secure Instant UPI Payment & Quality Guarantee</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
