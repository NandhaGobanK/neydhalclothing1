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
  X,
  ArrowUpDown,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import { formatPrice } from '../../utils/upi';
import { getCategoryPluralName, getCategorySingularName } from '../../utils/productValidation';

interface CategoryBrowserProps {
  onOpenDetails: (product: Product) => void;
  selectedCategoryName?: string;
  onSelectCategory?: (categoryName: string) => void;
}

export type CategorySortOption =
  | 'featured'
  | 'price_low'
  | 'price_high'
  | 'newest'
  | 'name_asc'
  | 'name_desc';

const SORT_OPTIONS: { id: CategorySortOption; label: string }[] = [
  { id: 'featured', label: 'Featured First' },
  { id: 'price_low', label: 'Price: Low to High' },
  { id: 'price_high', label: 'Price: High to Low' },
  { id: 'newest', label: 'Newest Arrivals' },
  { id: 'name_asc', label: 'Name: A to Z' },
  { id: 'name_desc', label: 'Name: Z to A' },
];

export const CategoryBrowser: React.FC<CategoryBrowserProps> = ({
  onOpenDetails,
  selectedCategoryName,
  onSelectCategory,
}) => {
  const {
    publicProducts,
    categories,
    addToCart,
    wishlist,
    toggleWishlist,
    isInWishlist,
    setIsCheckoutOpen,
    settings,
  } = useStore();

  const [activeCategory, setActiveCategory] = useState<string | null>(
    selectedCategoryName && selectedCategoryName !== 'all' ? selectedCategoryName : null
  );

  React.useEffect(() => {
    if (selectedCategoryName && selectedCategoryName !== 'all') {
      setActiveCategory(selectedCategoryName);
    } else if (selectedCategoryName === 'all') {
      setActiveCategory(null);
    }
  }, [selectedCategoryName]);

  const [searchFilter, setSearchFilter] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [restockedOnly, setRestockedOnly] = useState(false);
  const [categoryRestockFilter, setCategoryRestockFilter] = useState<'all' | 'restocked'>('all');
  const [sortBy, setSortBy] = useState<CategorySortOption>('featured');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = React.useRef<HTMLDivElement>(null);

  // Check if any active product in category is restocked
  const isCategoryRestocked = React.useCallback(
    (catName: string) => {
      return publicProducts.some(
        (p) =>
          (p.category === catName || p.category?.toLowerCase() === catName.toLowerCase()) &&
          p.isRestocked &&
          p.stockStatus !== 'out_of_stock' &&
          (p.stockCount ?? 1) > 0
      );
    },
    [publicProducts]
  );

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
    };
    if (isSortOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSortOpen]);

  const [selectedFabric, setSelectedFabric] = useState<string>('all');
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

  // Available fabrics inside active category
  const categoryFabrics = React.useMemo(() => {
    if (!activeCategory) return [];
    const set = new Set<string>();
    publicProducts.forEach((p) => {
      const matchesCategory =
        p.category === activeCategory ||
        p.category?.toLowerCase() === activeCategory.toLowerCase();
      if (matchesCategory && p.fabric) {
        set.add(p.fabric.trim());
      }
    });
    return Array.from(set).sort();
  }, [publicProducts, activeCategory]);

  // When a category is clicked
  const handleCategoryClick = (categoryName: string) => {
    setActiveCategory(categoryName);
    setSearchFilter('');
    setSelectedFabric('all');
    setInStockOnly(false);
    onSelectCategory?.(categoryName);
  };

  const handleBackToAllCategories = () => {
    setActiveCategory(null);
    setSearchFilter('');
    setSelectedFabric('all');
    setInStockOnly(false);
    onSelectCategory?.('all');
  };

  // Filtered & sorted products for selected category
  const categoryProducts = React.useMemo(() => {
    if (!activeCategory) return [];
    let list = publicProducts.filter((p) => {
      const matchesCategory =
        p.category === activeCategory ||
        p.category?.toLowerCase() === activeCategory.toLowerCase() ||
        p.fabric?.toLowerCase() === activeCategory.toLowerCase();

      if (!matchesCategory) return false;

      // In-category search by product name or SKU code (and color)
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase().trim();
        const matchesName = p.title.toLowerCase().includes(q);
        const matchesSku = p.productCode.toLowerCase().includes(q);
        const matchesColor = p.color.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesColor) return false;
      }

      // In-stock only filter
      if (inStockOnly) {
        const isOut = p.stockStatus === 'out_of_stock' || (p.stockCount !== undefined && p.stockCount <= 0);
        if (isOut) return false;
      }

      // Restocked only filter
      if (restockedOnly) {
        if (!p.isRestocked) return false;
      }

      // Fabric filter
      if (selectedFabric !== 'all' && p.fabric !== selectedFabric) {
        return false;
      }

      return true;
    });

    // Sorting matching exact reference options
    if (sortBy === 'featured') {
      list = [...list].sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
    } else if (sortBy === 'price_low') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_high') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (sortBy === 'newest') {
      list = [...list].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    } else if (sortBy === 'name_asc') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'name_desc') {
      list = [...list].sort((a, b) => b.title.localeCompare(a.title));
    }

    return list;
  }, [publicProducts, activeCategory, searchFilter, inStockOnly, restockedOnly, selectedFabric, sortBy]);

  const activeCategoryObj = categories.find(
    (c) => c.name.toLowerCase() === (activeCategory || '').toLowerCase()
  );

  const handleQuickAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    addToCart(product, 1);
    setAddedProductId(product.id);
    setTimeout(() => setAddedProductId(null), 1800);
  };

  const handleDirectBuyNow = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    addToCart(product, 1);
    setIsCheckoutOpen(true);
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
        <div className="relative z-10 bg-white border-b border-neutral-200 px-4 py-3 sm:py-4 shadow-2xs">
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
                <span>
                  {activeCategoryObj?.bannerTagline ||
                    settings.storefrontDisplay?.categoryBannerTagline ||
                    'Featured Specialty Category'}
                </span>
              </span>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-wide">
                {activeCategoryObj?.bannerTitle || activeCategory}
              </h2>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {activeCategoryObj?.bannerDescription ||
                  activeCategoryObj?.description ||
                  `Explore our curated premium ${activeCategory} catalog handcrafted with authentic materials and exceptional artisan quality.`}
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

          {/* In-Category Search and Filtering Options Bar (User Request) */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs font-bold text-neutral-900">
                  We found <span className="text-rose-900 font-extrabold">{categoryProducts.length} items</span> for you in{' '}
                  <span className="underline decoration-amber-400 underline-offset-2">{activeCategory}</span>
                </p>
              </div>

              {/* In-Category Search Input (by Product Name or SKU code) */}
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search by product name or SKU code..."
                  className="w-full pl-8 pr-8 py-2 rounded-xl border border-neutral-200 text-xs text-neutral-900 bg-neutral-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                />
                {searchFilter && (
                  <button
                    type="button"
                    onClick={() => setSearchFilter('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* In-Category Filter Controls: In-Stock Toggle, Fabric Selector, Price Sorting */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-neutral-100 text-xs">
              <span className="text-[11px] font-semibold text-neutral-500 flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3 text-amber-700" />
                <span>Filters:</span>
              </span>

              {/* In-Stock Only Chip */}
              <button
                type="button"
                onClick={() => setInStockOnly((v) => !v)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                  inStockOnly
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                    : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                {inStockOnly ? '✓ In Stock Only' : 'In Stock Only'}
              </button>

              {/* Restocked Only Chip */}
              <button
                type="button"
                onClick={() => setRestockedOnly((v) => !v)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border flex items-center gap-1 ${
                  restockedOnly
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-2xs font-bold'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>{restockedOnly ? `✓ Restocked ${getCategoryPluralName(activeCategory)}` : '✨ Restocked Only'}</span>
              </button>

              {/* Fabric Filter */}
              {categoryFabrics.length > 1 && (
                <div className="flex items-center gap-1">
                  <select
                    value={selectedFabric}
                    onChange={(e) => setSelectedFabric(e.target.value)}
                    className="p-1 px-2 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800 text-xs font-medium cursor-pointer"
                  >
                    <option value="all">All Fabrics ({categoryFabrics.length})</option>
                    {categoryFabrics.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Featured First Sorting Dropdown matching reference image */}
              <div className="relative inline-block text-left ml-auto" ref={sortRef}>
                <button
                  type="button"
                  onClick={() => setIsSortOpen((v) => !v)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 text-xs sm:text-sm font-semibold shadow-2xs transition cursor-pointer"
                  aria-expanded={isSortOpen}
                  aria-haspopup="true"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                  <span>
                    {SORT_OPTIONS.find((o) => o.id === sortBy)?.label || 'Featured First'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-neutral-700 transition-transform duration-200 ${
                      isSortOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu directly matching structure in image.png */}
                {isSortOpen && (
                  <div className="absolute right-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1 z-50 w-56 bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-150">
                    {SORT_OPTIONS.map((opt) => {
                      const isSelected = sortBy === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSortBy(opt.id);
                            setIsSortOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs sm:text-sm transition cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-blue-600 text-white font-medium shadow-xs'
                              : 'text-neutral-900 hover:bg-neutral-100 font-normal'
                          }`}
                        >
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {(searchFilter || inStockOnly || selectedFabric !== 'all' || sortBy !== 'featured') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchFilter('');
                    setInStockOnly(false);
                    setSelectedFabric('all');
                    setSortBy('featured');
                  }}
                  className="text-[11px] text-rose-700 hover:text-rose-900 font-semibold underline cursor-pointer ml-1"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Storefront Order Cancellation Policy Notice (Mandatory Requirement) */}
          <div className="p-3 px-4 rounded-xl bg-amber-50 border border-amber-200/90 flex items-center justify-between gap-3 text-xs text-amber-950 flex-wrap">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Boutique Policy Notice:</strong> No cancellation once the order is shipped
              </span>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-5">
              {categoryProducts.map((product) => {
                const inWishlist = isInWishlist(product.id);
                const isOutOfStock = product.stockStatus === 'out_of_stock' || (product.stockCount !== undefined && product.stockCount <= 0);
                const discountPercent =
                  product.originalPrice && product.originalPrice > product.price
                    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                    : null;

                return (
                  <div
                    key={product.id}
                    onClick={() => onOpenDetails(product)}
                    className="group bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col cursor-pointer relative max-w-sm w-full"
                  >
                    {/* Top image container: calibrated so card fits comfortably on a single screen */}
                    <div className="relative aspect-4/5 max-h-52 sm:max-h-60 md:max-h-68 overflow-hidden bg-neutral-100">
                      <img
                        src={product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                        alt={product.title}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />

                      {/* Prominent Out of Stock Full-Card Overlay */}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center p-2 text-center pointer-events-none animate-in fade-in">
                          <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider shadow-lg border border-rose-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span>Out of Stock</span>
                          </span>
                        </div>
                      )}

                      {/* Wishlist Heart Button (interactive toggle) */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleWishlist(e, product.id)}
                        className={`absolute top-2.5 right-2.5 z-25 w-8 h-8 rounded-full flex items-center justify-center shadow-md backdrop-blur-md transition cursor-pointer ${
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

                      {/* Top Badges (Restocked Tag & Discount) */}
                      <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start z-10">
                        {product.isRestocked && !isOutOfStock && (
                          <div className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-md shadow-xs tracking-tight flex items-center gap-1 border border-emerald-400 animate-in zoom-in-75">
                            <Sparkles className="w-2.5 h-2.5 text-amber-300 fill-amber-300" />
                            <span>Restocked</span>
                          </div>
                        )}
                        {discountPercent && discountPercent > 0 && (
                          <div className="bg-rose-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-md shadow-xs tracking-tight">
                            {discountPercent}% OFF
                          </div>
                        )}
                      </div>

                      {/* SKU Identifier Badge */}
                      <div className="absolute bottom-2 left-2 bg-neutral-900/80 backdrop-blur-xs text-amber-200 font-mono text-[9px] px-1.5 py-0.5 rounded border border-neutral-700/60 font-semibold tracking-wider z-10">
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

                        {/* Action buttons: Add to Bag & Buy Now */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleQuickAddToCart(e, product)}
                            disabled={product.stockStatus === 'out_of_stock'}
                            className={`p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                              addedProductId === product.id
                                ? 'bg-emerald-600 text-white'
                                : product.stockStatus === 'out_of_stock'
                                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
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
                          <button
                            type="button"
                            onClick={(e) => handleDirectBuyNow(e, product)}
                            disabled={product.stockStatus === 'out_of_stock'}
                            className="p-1.5 sm:px-3 sm:py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 bg-rose-900 hover:bg-rose-800 text-white cursor-pointer shadow-2xs disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed"
                            title="Buy now with instant checkout"
                          >
                            <span className="text-[10px] uppercase tracking-wider">Buy</span>
                          </button>
                        </div>
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
      <div className="relative z-10 bg-white border-b border-neutral-200 px-4 py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-rose-100 text-rose-900 flex items-center justify-center font-bold">
              <Grid className="w-4 h-4" />
            </span>
            <div>
              <h1 className="font-serif font-bold text-base sm:text-lg text-neutral-900">
                {settings.storefrontDisplay?.categorySectionTitle || 'All Collections & Categories'}
              </h1>
              <p className="text-[11px] text-neutral-500">
                {settings.storefrontDisplay?.categorySectionSubtitle ||
                  'Browse our exclusive catalog grouped by style, fabric & occasion'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Storefront Order Cancellation Policy Notice (Mandatory Requirement) */}
        <div className="p-3 px-4 rounded-xl bg-amber-50 border border-amber-200/90 flex items-center justify-between gap-3 text-xs text-amber-950 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Boutique Policy Notice:</strong> No cancellation once the order is shipped
            </span>
          </div>
        </div>

        {/* Category-Level Restock Filter Tabs */}
        <div className="flex items-center gap-2 pb-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setCategoryRestockFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              categoryRestockFilter === 'all'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
            }`}
          >
            All Collections ({categories.length})
          </button>
          <button
            type="button"
            onClick={() => setCategoryRestockFilter('restocked')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              categoryRestockFilter === 'restocked'
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-medium'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>✨ Restocked Collections ({categories.filter((c) => isCategoryRestocked(c.name)).length})</span>
          </button>
        </div>

        {/* Visual Category Cards Grid */}
        {categories.filter((c) => (categoryRestockFilter === 'restocked' ? isCategoryRestocked(c.name) : true)).length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200 space-y-2">
            <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="font-serif text-base font-bold text-neutral-900">No Restocked Collections Right Now</h3>
            <p className="text-xs text-neutral-500">All current products are at normal inventory levels.</p>
            <button
              type="button"
              onClick={() => setCategoryRestockFilter('all')}
              className="mt-2 px-4 py-1.5 rounded-xl bg-neutral-900 text-white text-xs font-semibold"
            >
              View All Collections
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {categories
              .filter((c) => (categoryRestockFilter === 'restocked' ? isCategoryRestocked(c.name) : true))
              .map((category) => {
                const count = categoryCounts[category.name] || 0;
                const isRestocked = isCategoryRestocked(category.name);

                return (
                  <div
                    key={category.id}
                    onClick={() => handleCategoryClick(category.name)}
                    className="group relative bg-white rounded-2xl border border-neutral-200/90 overflow-hidden shadow-2xs hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between"
                  >
                    {/* Visual Category Preview Image */}
                    <div className="relative aspect-16/9 sm:aspect-4/3 w-full overflow-hidden bg-neutral-900 flex items-center justify-center">
                      <img
                        src={category.imageUrl || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                        alt={category.name}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none" />

                      {/* Restocked Badge on Category Icon / Card */}
                      {isRestocked && (
                        <div className="absolute top-3 left-3 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-md border border-emerald-400 flex items-center gap-1 z-30 animate-in zoom-in-75">
                          <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
                          <span>Restocked</span>
                        </div>
                      )}

                      {/* Item Count Pill */}
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md text-neutral-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm z-30">
                        {count} {count === 1 ? getCategorySingularName(category.name) : getCategoryPluralName(category.name)}
                      </div>

                      {/* Category Title & Labels Overlay (Prominent z-30) */}
                      <div className="absolute inset-x-0 bottom-0 z-30 p-3.5 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent text-white pointer-events-none">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300 drop-shadow block">
                          Explore Collection
                        </span>
                        <h3 className="font-serif font-bold text-lg sm:text-xl text-white group-hover:text-amber-200 transition drop-shadow-md">
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
        )}
      </div>
    </div>
  );
};
