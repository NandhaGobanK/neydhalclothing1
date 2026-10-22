import React from 'react';
import { useStore } from '../../context/StoreContext';
import { formatPrice } from '../../utils/upi';
import { X, Trash2, Plus, Minus, ArrowRight, ShoppingBag, ShieldCheck, Truck, Sparkles, AlertCircle } from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    products,
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
    cartStockWarning,
    clearCartStockWarning,
  } = useStore();

  const [localWarning, setLocalWarning] = React.useState<string | null>(null);

  // Automatically sync store warning
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

  // Clamp any cart items exceeding live inventory stock on drawer open
  React.useEffect(() => {
    if (isCartOpen) {
      cart.forEach((item) => {
        const live = products.find((p) => p.id === item.product.id) || item.product;
        const availableStock = Math.max(0, live.stockCount ?? 99);
        if (item.quantity > availableStock) {
          updateCartQuantity(item.product.id, availableStock);
          setLocalWarning(
            `Quantity for ${item.product.title} was capped to the available stock of ${availableStock}.`
          );
        }
      });
    }
  }, [isCartOpen, cart, products, updateCartQuantity]);

  if (!isCartOpen) return null;

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const deliveryConfig = settings.delivery;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-neutral-800" />
            <h2 className="font-serif text-lg font-bold text-neutral-900">
              Your Shopping Bag
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
              {cartCount} {cartCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
            aria-label="Close bag"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stock Limit Warning Notice Banner */}
        {localWarning && (
          <div className="mx-4 sm:mx-5 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="font-semibold">{localWarning}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setLocalWarning(null);
                clearCartStockWarning();
              }}
              className="text-amber-800 hover:text-amber-950 p-1 font-bold"
              aria-label="Dismiss warning"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content */}
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-800 mb-4">
              <ShoppingBag className="w-8 h-8 stroke-1" />
            </div>
            <h3 className="font-serif text-lg font-bold text-neutral-800 mb-1">
              Your shopping bag is empty
            </h3>
            <p className="text-xs text-neutral-500 max-w-xs mb-6">
              Explore our catalog and select an exquisite handcrafted piece.
            </p>
            <button
              onClick={() => setIsCartOpen(false)}
              className="px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <>
            {/* Items list */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-neutral-100 space-y-4">
              {cart.map((item) => {
                const liveProd = products.find((p) => p.id === item.product.id) || item.product;
                const availableStock = Math.max(0, liveProd.stockCount ?? 99);
                const isAtMaxStock = item.quantity >= availableStock;

                const handleIncrement = () => {
                  if (isAtMaxStock) {
                    setLocalWarning(`Cannot add more items; stock limit reached (${availableStock} available in stock)`);
                    return;
                  }
                  updateCartQuantity(item.product.id, item.quantity + 1);
                };

                return (
                  <div key={item.product.id} className="pt-4 first:pt-0 flex gap-3.5">
                    <img
                      src={item.product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                      alt={item.product.title}
                      referrerPolicy="no-referrer"
                      className="w-20 h-24 object-cover rounded-xl bg-neutral-100 border border-neutral-200/60 shrink-0"
                    />
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-serif text-sm font-bold text-neutral-900 line-clamp-1">
                            {item.product.title}
                          </h4>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-neutral-400 hover:text-rose-700 p-1 cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[11px] text-amber-800 font-medium">
                          {item.product.fabric ? `${item.product.fabric} · ` : ''}{item.product.color}
                        </p>
                        {/* Stock limit helper indicator */}
                        <p className="text-[10px] text-neutral-500 mt-0.5">
                          Available Stock: <span className="font-semibold text-neutral-800">{availableStock}</span>
                          {isAtMaxStock && (
                            <span className="text-amber-700 font-bold ml-1.5">(Max in bag)</span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border border-neutral-200 rounded-lg bg-neutral-50">
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                            className="p-1 hover:bg-neutral-200 text-neutral-600 rounded-l-lg transition cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2.5 text-xs font-semibold tabular-nums text-neutral-800">
                            {item.quantity}
                          </span>
                          <button
                            onClick={handleIncrement}
                            disabled={isAtMaxStock}
                            className={`p-1 rounded-r-lg transition ${
                              isAtMaxStock
                                ? 'opacity-30 cursor-not-allowed text-neutral-400'
                                : 'hover:bg-neutral-200 text-neutral-600 cursor-pointer'
                            }`}
                            aria-label="Increase quantity"
                            title={isAtMaxStock ? 'Cannot add more items; stock limit reached' : 'Increase quantity'}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-xs font-bold text-neutral-900 tabular-nums">
                          {formatPrice(item.product.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Summary */}
            <div className="p-4 sm:p-5 border-t border-neutral-200 bg-neutral-50/70 space-y-3">
              {/* Free Delivery Threshold Progress Notice */}
              {deliveryConfig?.freeDeliveryEnabled && (
                <div className={`p-3 rounded-xl border text-xs ${
                  isFreeDeliveryUnlocked
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Truck className={`w-3.5 h-3.5 ${isFreeDeliveryUnlocked ? 'text-emerald-600' : 'text-amber-700'}`} />
                      <span>{isFreeDeliveryUnlocked ? '🎉 Free Delivery Unlocked!' : 'Free Delivery Goal'}</span>
                    </span>
                    <span className="font-bold text-[11px]">
                      {isFreeDeliveryUnlocked
                        ? 'Eligible'
                        : `Add ${formatPrice(amountNeededForFreeDelivery)} more`}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${isFreeDeliveryUnlocked ? 'bg-emerald-600' : 'bg-amber-600'}`}
                      style={{
                        width: `${Math.min(100, Math.round((cartTotal / (deliveryConfig.freeDeliveryThreshold || 1)) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-neutral-600 mt-1">
                    {isFreeDeliveryUnlocked
                      ? `Your order exceeds ${formatPrice(deliveryConfig.freeDeliveryThreshold)}. Free delivery is enabled!`
                      : `Free Delivery applies on orders above ${formatPrice(deliveryConfig.freeDeliveryThreshold)} (Fixed by boutique).`}
                  </p>
                </div>
              )}

              {/* Price Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-neutral-600">
                  <span>Bag Subtotal</span>
                  <span className="font-semibold text-neutral-900 tabular-nums">{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-neutral-600">
                  <span>Delivery Charges</span>
                  {cartShippingFee === 0 ? (
                    <span className="font-semibold text-emerald-700">Free</span>
                  ) : (
                    <span className="font-semibold text-neutral-900 tabular-nums">{formatPrice(cartShippingFee)}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-base font-bold text-neutral-900 pt-2 border-t border-neutral-200">
                <span>Total Payable</span>
                <span className="tabular-nums text-lg text-neutral-950 font-serif">
                  {formatPrice(cartGrandTotal)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Notice: No cancellation once the order is shipped</span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={clearCart}
                  className="px-3 py-3 rounded-xl border border-neutral-200 text-neutral-500 hover:text-neutral-800 hover:bg-white text-xs font-medium transition"
                  title="Clear bag"
                >
                  Clear
                </button>
                <button
                  onClick={handleProceedToCheckout}
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition"
                >
                  <span>Buy Now / Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
