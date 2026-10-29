import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, SareeCategory } from '../../types/store';
import {
  ChevronLeft,
  ChevronRight,
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
  | 'newest'
  | 'price_low'
  | 'price_high'
  | 'name_asc'
  | 'name_desc';

const SORT_OPTIONS: { id: CategorySortOption; label: string }[] = [
  { id: 'newest', label: 'Newest Arrivals' },
  { id: 'price_low', label: 'Price: Low to High' },
  { id: 'price_high', label: 'Price: High to Low' },
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
  const [selectedStockStatuses, setSelectedStockStatuses] = useState<string[]>([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<'stock' | 'price' | 'color' | 'size' | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const [categoryRestockFilter, setCategoryRestockFilter] = useState<'all' | 'restocked'>('all');
  const [sortBy, setSortBy] = useState<CategorySortOption>('newest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = React.useRef<HTMLDivElement>(null);

  const [selectedFabric, setSelectedFabric] = useState<string>('all');
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  // Scalable Pagination for In-Category Products
  const [categoryPage, setCategoryPage] = useState<number>(1);
  const [categoryPageSize, setCategoryPageSize] = useState<number>(9);

  // Scalable Pagination for Collections Cards Grid
  const [collectionsPage, setCollectionsPage] = useState<number>(1);
  const collectionsPageSize = 9;

  // Reset category product pagination when filters or category changes
  React.useEffect(() => {
    setCategoryPage(1);
  }, [
    activeCategory,
    searchFilter,
    selectedStockStatuses,
    selectedPriceRanges,
    selectedColors,
    selectedSizes,
    selectedFabric,
    sortBy,
    categoryPageSize,
  ]);

  // Reset collections pagination when collection filter changes
  React.useEffect(() => {
    setCollectionsPage(1);
  }, [categoryRestockFilter]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Group products by category to show counts
  const categoryCounts = React.useMemo(() => {
    const map: Record<string, number> = {};
    publicProducts.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [publicProducts]);

  // Dynamic colors derived from products in active category
  const categoryColors = React.useMemo(() => {
    if (!activeCategory) return [];
    const set = new Set<string>();
    publicProducts.forEach((p) => {
      const matches =
        p.category === activeCategory ||
        p.category?.toLowerCase() === activeCategory.toLowerCase();
      if (matches) {
        if (p.color && p.color.trim()) set.add(p.color.trim());
        const attrs = (p as any).attributes || p.customAttributes;
        if (attrs) {
          Object.entries(attrs).forEach(([k, v]) => {
            if (
              (k.toLowerCase().includes('color') || k.toLowerCase().includes('shade')) &&
              v &&
              String(v).trim()
            ) {
              set.add(String(v).trim());
            }
          });
        }
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [publicProducts, activeCategory]);

  // Dynamic sizes derived from products in active category
  const categorySizes = React.useMemo(() => {
    if (!activeCategory) return [];
    const set = new Set<string>();
    publicProducts.forEach((p) => {
      const matches =
        p.category === activeCategory ||
        p.category?.toLowerCase() === activeCategory.toLowerCase();
      if (matches) {
        if ((p as any).size && String((p as any).size).trim()) {
          set.add(String((p as any).size).trim());
        }
        if (p.lengthMeters) set.add(`${p.lengthMeters}m`);
        if (p.bustSize) set.add(p.bustSize);
        if (p.kurtiLength) set.add(p.kurtiLength);
        const attrs = (p as any).attributes || p.customAttributes;
        if (attrs) {
          Object.entries(attrs).forEach(([k, v]) => {
            if (
              (k.toLowerCase().includes('size') ||
                k.toLowerCase().includes('length') ||
                k.toLowerCase().includes('dimension')) &&
              v &&
              String(v).trim()
            ) {
              set.add(String(v).trim());
            }
          });
        }
      }
    });
    if (set.size === 0) {
      ['5.5m Standard', '6.2m with Blouse', 'Free Size', 'Ready-to-Wear'].forEach((s) => set.add(s));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [publicProducts, activeCategory]);

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

  const toggleStockStatus = (status: string) => {
    setSelectedStockStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const togglePriceRange = (range: string) => {
    setSelectedPriceRanges((prev) =>
      prev.includes(range) ? prev.filter((r) => r !== range) : [...prev, range]
    );
  };

  const toggleColor = (color: string) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const resetAllCategoryFilters = () => {
    setSelectedStockStatuses([]);
    setSelectedPriceRanges([]);
    setSelectedColors([]);
    setSelectedSizes([]);
    setSelectedFabric('all');
    setSearchFilter('');
    setSortBy('newest');
    setCategoryPage(1);
    setOpenDropdown(null);
  };

  // When a category is clicked
  const handleCategoryClick = (categoryName: string) => {
    setActiveCategory(categoryName);
    resetAllCategoryFilters();
    onSelectCategory?.(categoryName);
  };

  const handleBackToAllCategories = () => {
    setActiveCategory(null);
    resetAllCategoryFilters();
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

      // Stock Filter (Multi-select OR: instock, outofstock, restocked)
      if (selectedStockStatuses.length > 0) {
        const matchesStock = selectedStockStatuses.some((status) => {
          if (status === 'instock') return p.stockCount > 0 || p.stockStatus === 'in_stock';
          if (status === 'outofstock') return p.stockCount <= 0 || p.stockStatus === 'out_of_stock';
          if (status === 'restocked') return p.isRestocked === true;
          return false;
        });
        if (!matchesStock) return false;
      }

      // Price Range Filter (Multi-select OR: 0-100, 100-500, 500-1000, 1000-2000, 2000+)
      if (selectedPriceRanges.length > 0) {
        const matchesPrice = selectedPriceRanges.some((range) => {
          if (range === '0-100') return p.price >= 0 && p.price <= 100;
          if (range === '100-500') return p.price > 100 && p.price <= 500;
          if (range === '500-1000') return p.price > 500 && p.price <= 1000;
          if (range === '1000-2000') return p.price > 1000 && p.price <= 2000;
          if (range === '2000+') return p.price > 2000;
          return false;
        });
        if (!matchesPrice) return false;
      }

      // Colour Filter (Multi-select OR)
      if (selectedColors.length > 0) {
        const attrs = (p as any).attributes || p.customAttributes;
        const productColors = [
          p.color,
          ...(attrs ? Object.values(attrs).map(String) : []),
        ].map((c) => (c || '').toLowerCase().trim());
        const matchesColor = selectedColors.some((c) =>
          productColors.includes(c.toLowerCase().trim())
        );
        if (!matchesColor) return false;
      }

      // Size Filter (Multi-select OR)
      if (selectedSizes.length > 0) {
        const attrs = (p as any).attributes || p.customAttributes;
        const productSizes = [
          (p as any).size,
          p.lengthMeters ? `${p.lengthMeters}m` : null,
          p.bustSize,
          p.kurtiLength,
          ...(attrs ? Object.values(attrs).map(String) : []),
        ]
          .filter(Boolean)
          .map((s) => String(s).toLowerCase().trim());
        const matchesSize = selectedSizes.some((s) =>
          productSizes.some((ps) => ps.includes(s.toLowerCase().trim()) || s.toLowerCase().includes(ps))
        );
        if (!matchesSize) return false;
      }

      // Fabric filter
      if (selectedFabric !== 'all' && p.fabric !== selectedFabric) {
        return false;
      }

      return true;
    });

    // Sorting (Featured first removed, default to newest)
    if (sortBy === 'price_low') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_high') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (sortBy === 'name_asc') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'name_desc') {
      list = [...list].sort((a, b) => b.title.localeCompare(a.title));
    } else {
      // Default: newest arrivals
      list = [...list].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    }

    return list;
  }, [
    publicProducts,
    activeCategory,
    searchFilter,
    selectedStockStatuses,
    selectedPriceRanges,
    selectedColors,
    selectedSizes,
    selectedFabric,
    sortBy,
  ]);

  const activeCategoryFilterCount =
    selectedStockStatuses.length +
    selectedPriceRanges.length +
    selectedColors.length +
    selectedSizes.length +
    (selectedFabric !== 'all' ? 1 : 0) +
    (searchFilter ? 1 : 0);

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

  // 1. DEDICATED CATEGORY RESULTS PAGE (Exact match with user requests)
  if (activeCategory) {
    return (
      <div className="min-h-screen pb-24 bg-white">
        {/* Category Header Bar with Back Button and Bold, Boxed, Colourful Title Badge */}
        <div className="relative z-30 bg-white border-b border-neutral-200 px-4 py-3 sm:py-3.5 shadow-2xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleBackToAllCategories}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-neutral-700 hover:text-neutral-950 px-2.5 py-1.5 rounded-xl hover:bg-neutral-100 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-rose-900" />
              <span>All Categories</span>
            </button>

            {/* Bold, Boxed, and Colourful Category Name Badge on Title Bar (as requested) */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-800 via-rose-700 to-amber-600 text-white font-serif font-extrabold text-sm sm:text-base shadow-sm border border-purple-400/40 tracking-wide ring-2 ring-purple-100">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="truncate max-w-[220px] sm:max-w-none">{activeCategory}</span>
            </div>

            <span className="text-[11px] font-semibold text-rose-900 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
              {categoryProducts.length} Items
            </span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 space-y-4">
          {/* In-Category Search and Filtering Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs font-bold text-neutral-900">
                  We found <span className="text-rose-900 font-extrabold">{categoryProducts.length} items</span> for you in{' '}
                  <span className="underline decoration-amber-400 underline-offset-2">{activeCategory}</span>
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                {/* In-Category Search Input */}
                <div className="relative flex-1 sm:w-72">
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

                {/* Sort Dropdown (Featured First removed) */}
                <div className="relative inline-block text-left" ref={sortRef}>
                  <button
                    type="button"
                    onClick={() => setIsSortOpen((v) => !v)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 text-xs font-semibold shadow-2xs transition cursor-pointer"
                    aria-expanded={isSortOpen}
                    aria-haspopup="true"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                    <span>
                      {SORT_OPTIONS.find((o) => o.id === sortBy)?.label || 'Newest Arrivals'}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-neutral-700 transition-transform duration-200 ${
                        isSortOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isSortOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/10">
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
                            className={`w-full text-left px-4 py-2 text-xs transition cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-amber-500 text-neutral-950 font-bold'
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
              </div>
            </div>

            {/* 4 Multi-Select Dropdowns: Stock, Price Range, Colour, Size (Exact match with Product Page) */}
            <div ref={dropdownRef} className="relative z-40 pt-2 border-t border-neutral-100 space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* 1. Stock Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'stock' ? null : 'stock')}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-2xs ${
                      selectedStockStatuses.length > 0
                        ? 'bg-amber-500 text-neutral-950 border-amber-600'
                        : 'bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50'
                    }`}
                  >
                    <span>Stock</span>
                    {selectedStockStatuses.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-neutral-950 text-white text-[10px] font-bold flex items-center justify-center">
                        {selectedStockStatuses.length}
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'stock' ? 'rotate-180' : ''}`} />
                  </button>

                  {openDropdown === 'stock' && (
                    <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-white border border-neutral-200 shadow-2xl p-3 z-50 space-y-2 animate-in fade-in-50 zoom-in-95 ring-1 ring-black/10">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Stock Availability</span>
                        {selectedStockStatuses.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedStockStatuses([])}
                            className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {[
                          { id: 'instock', label: 'In Stock' },
                          { id: 'outofstock', label: 'Out of Stock' },
                          { id: 'restocked', label: 'Restocked' },
                        ].map((opt) => {
                          const isChecked = selectedStockStatuses.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              onClick={() => toggleStockStatus(opt.id)}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                  isChecked ? 'bg-amber-500 border-amber-600 text-neutral-950' : 'border-neutral-300'
                                }`}>
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <span className={isChecked ? 'font-bold text-neutral-900' : 'text-neutral-700'}>
                                  {opt.label}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Price Range Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'price' ? null : 'price')}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-2xs ${
                      selectedPriceRanges.length > 0
                        ? 'bg-amber-500 text-neutral-950 border-amber-600'
                        : 'bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50'
                    }`}
                  >
                    <span>Price Range</span>
                    {selectedPriceRanges.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-neutral-950 text-white text-[10px] font-bold flex items-center justify-center">
                        {selectedPriceRanges.length}
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'price' ? 'rotate-180' : ''}`} />
                  </button>

                  {openDropdown === 'price' && (
                    <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-white border border-neutral-200 shadow-2xl p-3 z-50 space-y-2 animate-in fade-in-50 zoom-in-95 ring-1 ring-black/10">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Price Range (₹)</span>
                        {selectedPriceRanges.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedPriceRanges([])}
                            className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {[
                          { id: '0-100', label: '0 - 100' },
                          { id: '100-500', label: '100 - 500' },
                          { id: '500-1000', label: '500 - 1000' },
                          { id: '1000-2000', label: '1000 - 2000' },
                          { id: '2000+', label: '2000+' },
                        ].map((opt) => {
                          const isChecked = selectedPriceRanges.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              onClick={() => togglePriceRange(opt.id)}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                  isChecked ? 'bg-amber-500 border-amber-600 text-neutral-950' : 'border-neutral-300'
                                }`}>
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <span className={isChecked ? 'font-bold text-neutral-900' : 'text-neutral-700'}>
                                  ₹{opt.label}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Colour Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'color' ? null : 'color')}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-2xs ${
                      selectedColors.length > 0
                        ? 'bg-amber-500 text-neutral-950 border-amber-600'
                        : 'bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50'
                    }`}
                  >
                    <span>Colour</span>
                    {selectedColors.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-neutral-950 text-white text-[10px] font-bold flex items-center justify-center">
                        {selectedColors.length}
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'color' ? 'rotate-180' : ''}`} />
                  </button>

                  {openDropdown === 'color' && (
                    <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-60 sm:w-64 max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto rounded-2xl bg-white border border-neutral-200 shadow-2xl p-3 z-50 space-y-2 animate-in fade-in-50 zoom-in-95 ring-1 ring-black/10">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Colour Shades</span>
                        {selectedColors.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedColors([])}
                            className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {categoryColors.length === 0 ? (
                          <p className="text-xs text-neutral-400 p-2 text-center">No colors configured</p>
                        ) : (
                          categoryColors.map((color) => {
                            const isChecked = selectedColors.includes(color);
                            return (
                              <label
                                key={color}
                                onClick={() => toggleColor(color)}
                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                    isChecked ? 'bg-amber-500 border-amber-600 text-neutral-950' : 'border-neutral-300'
                                  }`}>
                                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <span className="w-3 h-3 rounded-full border border-neutral-300 shrink-0" style={{ backgroundColor: color.toLowerCase() }} />
                                  <span className={isChecked ? 'font-bold text-neutral-900' : 'text-neutral-700'}>
                                    {color}
                                  </span>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Size Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'size' ? null : 'size')}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-2xs ${
                      selectedSizes.length > 0
                        ? 'bg-amber-500 text-neutral-950 border-amber-600'
                        : 'bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50'
                    }`}
                  >
                    <span>Size</span>
                    {selectedSizes.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-neutral-950 text-white text-[10px] font-bold flex items-center justify-center">
                        {selectedSizes.length}
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'size' ? 'rotate-180' : ''}`} />
                  </button>

                  {openDropdown === 'size' && (
                    <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-60 sm:w-64 max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto rounded-2xl bg-white border border-neutral-200 shadow-2xl p-3 z-50 space-y-2 animate-in fade-in-50 zoom-in-95 ring-1 ring-black/10">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Dimensions & Size</span>
                        {selectedSizes.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedSizes([])}
                            className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {categorySizes.map((size) => {
                          const isChecked = selectedSizes.includes(size);
                          return (
                            <label
                              key={size}
                              onClick={() => toggleSize(size)}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                  isChecked ? 'bg-amber-500 border-amber-600 text-neutral-950' : 'border-neutral-300'
                                }`}>
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <span className={isChecked ? 'font-bold text-neutral-900' : 'text-neutral-700'}>
                                  {size}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Fabric Selector if multiple fabrics */}
                {categoryFabrics.length > 1 && (
                  <div className="flex items-center gap-1">
                    <select
                      value={selectedFabric}
                      onChange={(e) => setSelectedFabric(e.target.value)}
                      className="p-2 rounded-xl border border-neutral-300 bg-white text-neutral-800 text-xs font-semibold cursor-pointer shadow-2xs"
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

                {/* Reset all filters button */}
                {activeCategoryFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetAllCategoryFilters}
                    className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reset all filters</span>
                  </button>
                )}
              </div>

              {/* Active Filter Badges Bar */}
              {activeCategoryFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  <span className="text-[11px] text-neutral-500 font-semibold mr-1">Active:</span>
                  {selectedStockStatuses.map((s) => (
                    <span
                      key={s}
                      onClick={() => toggleStockStatus(s)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-semibold cursor-pointer hover:bg-amber-200"
                    >
                      <span>Stock: {s === 'instock' ? 'In Stock' : s === 'outofstock' ? 'Out of Stock' : 'Restocked'}</span>
                      <X className="w-3 h-3" />
                    </span>
                  ))}
                  {selectedPriceRanges.map((r) => (
                    <span
                      key={r}
                      onClick={() => togglePriceRange(r)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 text-[11px] font-semibold cursor-pointer hover:bg-blue-200"
                    >
                      <span>Price: ₹{r}</span>
                      <X className="w-3 h-3" />
                    </span>
                  ))}
                  {selectedColors.map((c) => (
                    <span
                      key={c}
                      onClick={() => toggleColor(c)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 text-[11px] font-semibold cursor-pointer hover:bg-purple-200"
                    >
                      <span>Color: {c}</span>
                      <X className="w-3 h-3" />
                    </span>
                  ))}
                  {selectedSizes.map((sz) => (
                    <span
                      key={sz}
                      onClick={() => toggleSize(sz)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-semibold cursor-pointer hover:bg-emerald-200"
                    >
                      <span>Size: {sz}</span>
                      <X className="w-3 h-3" />
                    </span>
                  ))}
                  {selectedFabric !== 'all' && (
                    <span
                      onClick={() => setSelectedFabric('all')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-900 text-[11px] font-semibold cursor-pointer hover:bg-rose-200"
                    >
                      <span>Fabric: {selectedFabric}</span>
                      <X className="w-3 h-3" />
                    </span>
                  )}
                  {searchFilter && (
                    <span
                      onClick={() => setSearchFilter('')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-200 text-neutral-800 text-[11px] font-semibold cursor-pointer hover:bg-neutral-300"
                    >
                      <span>Search: "{searchFilter}"</span>
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </div>
              )}
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
            <>
              {(() => {
              const totalItems = categoryProducts.length;
              const isAll = categoryPageSize === -1;
              const effectiveSize = isAll ? Math.max(1, totalItems) : categoryPageSize;
              const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / effectiveSize));
              const safePage = Math.min(Math.max(1, categoryPage), totalPages);
              const paginatedCategoryProducts = isAll ? categoryProducts : categoryProducts.slice((safePage - 1) * effectiveSize, safePage * effectiveSize);

              return (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3.5 sm:gap-5">
                  {paginatedCategoryProducts.map((product) => {
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
                    {/* Top image container: Calibrated to exact 356 × 498 pixels aspect ratio */}
                    <div className="relative aspect-[356/498] overflow-hidden bg-neutral-100">
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

                      {/* Top Badges (Offer tag, Stock tag directly below Offer, and Restocked tag) */}
                      <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start z-10">
                        {discountPercent && discountPercent > 0 && (
                          <div className="bg-rose-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-md shadow-xs tracking-tight">
                            {discountPercent}% OFF
                          </div>
                        )}
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
                        {product.isRestocked && !isOutOfStock && (
                          <div className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-md shadow-xs tracking-tight flex items-center gap-1 border border-emerald-400 animate-in zoom-in-75">
                            <Sparkles className="w-2.5 h-2.5 text-amber-300 fill-amber-300" />
                            <span>Restocked</span>
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
          );
        })()}

            {/* Scalable Page Numbers & Navigation Controls Below Category Products */}
            {(() => {
              const totalItems = categoryProducts.length;
              const isAll = categoryPageSize === -1;
              const effectiveSize = isAll ? Math.max(1, totalItems) : categoryPageSize;
              const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / effectiveSize));
              const safePage = Math.min(Math.max(1, categoryPage), totalPages);
              const startItem = totalItems === 0 ? 0 : isAll ? 1 : (safePage - 1) * effectiveSize + 1;
              const endItem = isAll ? totalItems : Math.min(safePage * effectiveSize, totalItems);

              const handleCategoryPageChange = (p: number) => {
                if (p < 1 || p > totalPages || p === safePage) return;
                setCategoryPage(p);
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              };

              const getCategoryPageNumbers = () => {
                if (totalPages <= 7) {
                  return Array.from({ length: totalPages }, (_, i) => i + 1);
                }
                if (safePage <= 4) {
                  return [1, 2, 3, 4, 5, '...', totalPages];
                }
                if (safePage >= totalPages - 3) {
                  return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
                }
                return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
              };

              return (
                <div className="mt-8 pt-6 border-t border-neutral-200 flex flex-col md:flex-row items-center justify-between gap-4">
                  {/* Left: Product count & per page selector */}
                  <div className="flex items-center gap-3 text-xs text-neutral-600 flex-wrap justify-center md:justify-start">
                    <span>
                      Showing <strong className="text-neutral-900 font-bold">{startItem}–{endItem}</strong> of{' '}
                      <strong className="text-neutral-900 font-bold">{totalItems}</strong> items
                    </span>

                    {totalItems > 9 && (
                      <div className="flex items-center gap-1 pl-2 border-l border-neutral-200">
                        <span className="text-neutral-500 text-[11px]">Per Page:</span>
                        {[9, 18, 36, -1].map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => {
                              setCategoryPageSize(size);
                              setCategoryPage(1);
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                              categoryPageSize === size
                                ? 'bg-amber-500 text-neutral-950 font-bold shadow-2xs'
                                : 'bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200'
                            }`}
                          >
                            {size === -1 ? 'All' : size}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Page Numbers */}
                  {totalPages > 1 && (
                    <nav aria-label="Category products pagination" className="flex items-center gap-1.5 flex-wrap justify-center">
                      <button
                        type="button"
                        onClick={() => handleCategoryPageChange(safePage - 1)}
                        disabled={safePage <= 1}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition ${
                          safePage <= 1
                            ? 'text-neutral-300 bg-neutral-100 cursor-not-allowed'
                            : 'text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 cursor-pointer shadow-2xs'
                        }`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Prev</span>
                      </button>

                      {getCategoryPageNumbers().map((item, idx) => {
                        if (item === '...') {
                          return (
                            <span key={`cat-ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-neutral-400 text-xs">
                              …
                            </span>
                          );
                        }

                        const pageNum = Number(item);
                        const isActive = pageNum === safePage;

                        return (
                          <button
                            key={`cat-page-${pageNum}`}
                            type="button"
                            onClick={() => handleCategoryPageChange(pageNum)}
                            className={`w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                              isActive
                                ? 'bg-neutral-900 text-white shadow-xs ring-2 ring-amber-400/60'
                                : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 shadow-2xs'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => handleCategoryPageChange(safePage + 1)}
                        disabled={safePage >= totalPages}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition ${
                          safePage >= totalPages
                            ? 'text-neutral-300 bg-neutral-100 cursor-not-allowed'
                            : 'text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 cursor-pointer shadow-2xs'
                        }`}
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </nav>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

  // 2. ALL CATEGORIES VIEW (First Image in User Request)
  return (
    <div className="min-h-screen pb-24 bg-white">
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
          (() => {
            const displayedCategories = categories.filter((c) =>
              categoryRestockFilter === 'restocked' ? isCategoryRestocked(c.name) : true
            );
            const totalCollections = displayedCategories.length;
            const totalCollectionPages = Math.max(1, Math.ceil(totalCollections / collectionsPageSize));
            const safeCollPage = Math.min(Math.max(1, collectionsPage), totalCollectionPages);
            const paginatedCategories = displayedCategories.slice(
              (safeCollPage - 1) * collectionsPageSize,
              safeCollPage * collectionsPageSize
            );

            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3.5 sm:gap-5">
                  {paginatedCategories.map((category) => {
                    const count = categoryCounts[category.name] || 0;
                    const isRestocked = isCategoryRestocked(category.name);

                    return (
                      <div
                        key={category.id}
                        onClick={() => handleCategoryClick(category.name)}
                        className="group relative bg-white rounded-2xl border border-neutral-200/90 overflow-hidden shadow-2xs hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between"
                      >
                        {/* Visual Category Preview Image: Calibrated to exact 356 × 498 pixels aspect ratio */}
                        <div className="relative aspect-[356/498] w-full overflow-hidden bg-neutral-900 flex items-center justify-center">
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

                {/* Scalable Page Numbers for Collections View */}
                {totalCollectionPages > 1 && (
                  <div className="mt-8 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <span className="text-xs text-neutral-600">
                      Showing <strong>{(safeCollPage - 1) * collectionsPageSize + 1}–{Math.min(safeCollPage * collectionsPageSize, totalCollections)}</strong> of <strong>{totalCollections}</strong> collections
                    </span>

                    <nav aria-label="Collections pagination" className="flex items-center gap-1.5 flex-wrap justify-center">
                      <button
                        type="button"
                        onClick={() => setCollectionsPage((p) => Math.max(1, p - 1))}
                        disabled={safeCollPage <= 1}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition ${
                          safeCollPage <= 1
                            ? 'text-neutral-300 bg-neutral-100 cursor-not-allowed'
                            : 'text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 cursor-pointer shadow-2xs'
                        }`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>

                      {Array.from({ length: totalCollectionPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={`coll-page-${pageNum}`}
                          type="button"
                          onClick={() => setCollectionsPage(pageNum)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                            pageNum === safeCollPage
                              ? 'bg-neutral-900 text-white shadow-xs ring-2 ring-amber-400/60'
                              : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 shadow-2xs'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setCollectionsPage((p) => Math.min(totalCollectionPages, p + 1))}
                        disabled={safeCollPage >= totalCollectionPages}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition ${
                          safeCollPage >= totalCollectionPages
                            ? 'text-neutral-300 bg-neutral-100 cursor-not-allowed'
                            : 'text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 cursor-pointer shadow-2xs'
                        }`}
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </nav>
                  </div>
                )}
              </>
            );
          })()
        )}
      </div>
    </div>
  );
};
