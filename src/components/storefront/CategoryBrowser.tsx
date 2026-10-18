import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, SareeCategory } from '../../types/store';
import {
  ChevronLeft,
  Sparkles,
  Heart,
  ShoppingBag,
  SlidersHorizontal,
  Search,
  Check,
  Eye,
  ArrowRight,
  Grid,
} from 'lucide-react';
import { formatPrice } from '../../utils/upi';

interface CategoryBrowserProps {
  onOpenDetails: (product: Product) => void;
  selectedCategoryName?: string;
  onSelectCategory?: (categoryName: string) => void;
  onBackToHome?: () => void;
}

export const CategoryBrowser: React.FC<CategoryBrowserProps> = ({
  onOpenDetails,
  selectedCategoryName,
  onSelectCategory,
  onBackToHome,
}) => {
  const {
    publicProducts,
    categories,
    addToCart,
    wishlist,
    toggleWishlist,
    isInWishlist,
  } = useStore();

  const [activeCategory, setActiveCategory] = useState<string | null>(
    selectedCategoryName && selectedCategoryName !== 'all' ? selectedCategoryName : null
  );

  const [searchFilter, setSearchFilter] = useState('');
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  // Group products by category to show counts
  const categoryCounts = React.useMemo(() => {
    const map: Record<string, number> = {};
    publicProducts.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [publicProducts]);

  // When a category is clicked
  const handleCategoryClick = (categoryName: string) => {
    setActiveCategory(categoryName);
    onSelectCategory?.(categoryName);
  };

  const handleBackToAllCategories = () => {
    setActiveCategory(null);
    onSelectCategory?.('all');
  };

  // Products for selected category
  const categoryProducts = React.useMemo(() => {
    if (!activeCategory) return [];
    return publicProducts.filter((p) => {
      const matchesCategory =
        p.category === activeCategory ||
        p.category?.toLowerCase() === activeCategory.toLowerCase() ||
        p.fabric?.toLowerCase() === activeCategory.toLowerCase();

      if (!matchesCategory) return false;

      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.productCode.toLowerCase().includes(q) ||
          p.color.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [publicProducts, activeCategory, searchFilter]);

  const activeCategoryObj = categories.find(
    (c) => c.name.toLowerCase() === (activeCategory || '').toLowerCase()
  );

  const handleQuickAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    addToCart(product, 1);
    setAddedProductId(product.id);
    setTimeout(() => setAddedProductId(null), 1800);
  };

  const handleToggleWishlist = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    toggleWishlist(productId);
  };

  // 1. DEDICATED CATEGORY RESULTS PAGE (Second Image in User Request)
  if (activeCategory) {
    return (
      <div className="min-h-screen pb-24 bg-neutral-50/50">
        {/* Category Header Bar with Back Button */}
        <div className="sticky top-18 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-4 py-3 sm:py-4 shadow-2xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBackToAllCategories}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-neutral-700 hover:text-neutral-950 px-2.5 py-1.5 rounded-xl hover:bg-neutral-100 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-rose-900" />
              <span>All Categories</span>
            </button>

            <h1 className="font-serif font-bold text-sm sm:text-base text-neutral-900 truncate">
              {activeCategory}
            </h1>

            <span className="text-[11px] font-semibold text-rose-900 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
              {categoryProducts.length} Items
            </span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 space-y-4">
          {/* Category Banner Card */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 text-white p-5 sm:p-6 shadow-md">
            <div className="relative z-10 max-w-xl space-y-1.5">
              <span className="text-[10px] sm:text-xs uppercase tracking-widest text-amber-300 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Handloom Specialty Category</span>
              </span>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-wide">
                {activeCategory}
              </h2>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {activeCategoryObj?.description ||
                  `Explore our curated heirloom ${activeCategory} collection woven with tested zari and certified silk mark quality.`}
              </p>
            </div>
            {activeCategoryObj?.imageUrl && (
              <img
                src={activeCategoryObj.imageUrl}
                alt={activeCategory}
                className="absolute right-0 top-0 bottom-0 w-1/3 object-cover opacity-30 mask-image pointer-events-none"
              />
            )}
          </div>

          {/* Results Notification Banner (matching user prompt: "We found 40 items for you!") */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-neutral-200/90 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold text-neutral-900">
                We found <span className="text-rose-900 font-extrabold">{categoryProducts.length} items</span> for you in{' '}
                <span className="underline decoration-amber-400 underline-offset-2">{activeCategory}</span>!
              </p>
            </div>

            {/* Quick in-category search */}
            <div className="relative min-w-[200px] sm:w-64">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter in this category..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-neutral-200 text-xs text-neutral-900 bg-neutral-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
          </div>

          {/* Product Listing Grid */}
          {categoryProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
                <Grid className="w-6 h-6" />
              </div>
              <h3 className="font-serif font-bold text-neutral-900 text-base">
                No items currently found in {activeCategory}
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                Our weavers are continuously adding fresh heirloom drapes to this category. Browse other categories below or check back soon!
              </p>
              <button
                type="button"
                onClick={handleBackToAllCategories}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition cursor-pointer"
              >
                <span>Browse All Categories</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {categoryProducts.map((product) => {
                const inWishlist = isInWishlist(product.id);
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
                    {/* Top image container with wishlist heart & discount badge */}
                    <div className="relative aspect-3/4 overflow-hidden bg-neutral-100">
                      <img
                        src={product.images[0] || '/src/assets/images/hero_saree_atelier_1791651761357.jpg'}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />

                      {/* Wishlist Heart Button (interactive toggle) */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleWishlist(e, product.id)}
                        className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center shadow-md backdrop-blur-md transition cursor-pointer ${
                          inWishlist
                            ? 'bg-white text-rose-600 ring-2 ring-rose-500'
                            : 'bg-white/80 hover:bg-white text-neutral-700 hover:text-rose-600'
                        }`}
                        title={inWishlist ? 'Remove from wishlist' : 'Save to wishlist'}
                      >
                        <Heart
                          className="w-4 h-4 transition-transform active:scale-125"
                          fill={inWishlist ? 'currentColor' : 'none'}
                        />
                      </button>

                      {/* Discount Percentage Badge */}
                      {discountPercent && discountPercent > 0 && (
                        <div className="absolute top-2.5 left-2.5 bg-rose-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-md shadow-xs tracking-tight">
                          {discountPercent}% OFF
                        </div>
                      )}

                      {/* SKU Identifier Badge */}
                      <div className="absolute bottom-2 left-2 bg-neutral-900/80 backdrop-blur-xs text-amber-200 font-mono text-[9px] px-1.5 py-0.5 rounded border border-neutral-700/60 font-semibold tracking-wider">
                        {product.productCode}
                      </div>
                    </div>

                    {/* Card Content */}
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

                      {/* Pricing block */}
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

                        {/* Quick Add to Cart button */}
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
                          title="Add to bag"
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
  }

  // 2. ALL CATEGORIES VIEW (First Image in User Request)
  return (
    <div className="min-h-screen pb-24 bg-neutral-50/50">
      {/* Category Header */}
      <div className="sticky top-18 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-4 py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-rose-100 text-rose-900 flex items-center justify-center font-bold">
              <Grid className="w-4 h-4" />
            </span>
            <div>
              <h1 className="font-serif font-bold text-base sm:text-lg text-neutral-900">
                All Saree & Apparel Categories
              </h1>
              <p className="text-[11px] text-neutral-500">
                Browse our exclusive handloom collections grouped by style & occasion
              </p>
            </div>
          </div>

          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 transition cursor-pointer"
            >
              Back to Home
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Visual Category Cards Grid (Poontamil sarees, Foil print sarees, Soft menna work saree, Cotton kids dhoti set, Tissue dhoti set, Couple combo / silk dhoti shirt) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {categories.map((category) => {
            const count = categoryCounts[category.name] || 0;
            return (
              <div
                key={category.id}
                onClick={() => handleCategoryClick(category.name)}
                className="group relative bg-white rounded-2xl border border-neutral-200/90 overflow-hidden shadow-2xs hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                {/* Visual Category Preview Image */}
                <div className="relative aspect-16/9 sm:aspect-4/3 w-full overflow-hidden bg-neutral-100">
                  <img
                    src={category.imageUrl || '/src/assets/images/hero_saree_atelier_1791651761357.jpg'}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                  {/* Item Count Pill */}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-neutral-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                    {count} {count === 1 ? 'Design' : 'Designs'}
                  </div>

                  {/* Category Title Overlay */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300">
                      Explore Collection
                    </span>
                    <h3 className="font-serif font-bold text-lg sm:text-xl text-white group-hover:text-amber-200 transition">
                      {category.name}
                    </h3>
                  </div>
                </div>

                {/* Category Card Footer */}
                <div className="p-4 bg-white flex items-center justify-between text-xs border-t border-neutral-100">
                  <p className="text-neutral-500 line-clamp-1 pr-2 text-[11px]">
                    {category.description || 'Authentic pure handloom weave with tested quality.'}
                  </p>
                  <span className="text-rose-900 font-bold inline-flex items-center gap-1 shrink-0 group-hover:translate-x-1 transition-transform">
                    <span>View items</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
