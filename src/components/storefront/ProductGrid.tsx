import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from './ProductCard';
import { Product } from '../../types/store';
import {
  Search,
  SlidersHorizontal,
  X,
  Sparkles,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Check,
  RotateCcw,
} from 'lucide-react';
import { getCategoryPluralName } from '../../utils/productValidation';

interface ProductGridProps {
  onOpenDetails: (product: Product) => void;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  onOpenDetails,
  selectedCategory = 'all',
  onSelectCategory,
}) => {
  const { publicProducts, settings } = useStore();
  const isDark = settings.themeMode === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'newest' | 'name-asc' | 'name-desc'>('newest');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Multi-select dropdown filters: Stock, Price Range, Colour, Size
  const [selectedStockStatuses, setSelectedStockStatuses] = useState<string[]>([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<'stock' | 'price' | 'color' | 'size' | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pagination State for scalability
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(9); // 9 items per page (3x3 grid)

  // Reset to page 1 whenever filters or search criteria change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedCategory,
    selectedStockStatuses,
    selectedPriceRanges,
    selectedColors,
    selectedSizes,
    searchQuery,
    sortBy,
    pageSize,
  ]);

  // Available unique fabrics, colors, and sizes ONLY from products published from the admin page
  const publishedFabrics = useMemo(() => {
    const set = new Set<string>();
    publicProducts.forEach((p) => {
      if (p.fabric && p.fabric.trim()) {
        set.add(p.fabric.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [publicProducts]);

  const publishedColors = useMemo(() => {
    const set = new Set<string>();
    publicProducts.forEach((p) => {
      if (p.color && p.color.trim()) {
        set.add(p.color.trim());
      }
      const attrs = (p as any).attributes || p.customAttributes;
      if (attrs) {
        Object.entries(attrs).forEach(([k, v]) => {
          if ((k.toLowerCase().includes('color') || k.toLowerCase().includes('shade')) && v && String(v).trim()) {
            set.add(String(v).trim());
          }
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [publicProducts]);

  const publishedSizes = useMemo(() => {
    const set = new Set<string>();
    publicProducts.forEach((p) => {
      if ((p as any).size && String((p as any).size).trim()) {
        set.add(String((p as any).size).trim());
      }
      if (p.lengthMeters) {
        set.add(`${p.lengthMeters}m`);
      }
      if (p.bustSize) {
        set.add(p.bustSize);
      }
      if (p.kurtiLength) {
        set.add(p.kurtiLength);
      }
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
    });
    if (set.size === 0) {
      ['5.5m Standard', '6.2m With Blouse', 'Free Size', 'Ready-to-Wear'].forEach((s) => set.add(s));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [publicProducts]);

  // Filter products matching all selected dropdowns
  const filteredProducts = useMemo(() => {
    return publicProducts
      .filter((p) => {
        // Category / Fabric
        if (selectedCategory !== 'all') {
          const matchCategory =
            (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase()) ||
            (p.fabric && p.fabric.toLowerCase() === selectedCategory.toLowerCase());
          if (!matchCategory) return false;
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

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            p.title.toLowerCase().includes(q) ||
            (p.fabric && p.fabric.toLowerCase().includes(q)) ||
            p.color.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q);
          if (!match) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'name-asc') return a.title.localeCompare(b.title);
        if (sortBy === 'name-desc') return b.title.localeCompare(a.title);
        // Default: newest arrivals first
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [
    publicProducts,
    selectedCategory,
    selectedStockStatuses,
    selectedPriceRanges,
    selectedColors,
    selectedSizes,
    searchQuery,
    sortBy,
  ]);

  const activeFilterCount =
    (selectedCategory !== 'all' ? 1 : 0) +
    selectedStockStatuses.length +
    selectedPriceRanges.length +
    selectedColors.length +
    selectedSizes.length +
    (searchQuery ? 1 : 0);

  const resetFilters = () => {
    onSelectCategory?.('all');
    setSelectedStockStatuses([]);
    setSelectedPriceRanges([]);
    setSelectedColors([]);
    setSelectedSizes([]);
    setSearchQuery('');
    setSortBy('newest');
    setCurrentPage(1);
    setOpenDropdown(null);
  };

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

  // Scalable Pagination Calculations
  const totalProducts = filteredProducts.length;
  const isAllPages = pageSize === -1;
  const effectivePageSize = isAllPages ? Math.max(1, totalProducts) : pageSize;
  const totalPages = isAllPages ? 1 : Math.max(1, Math.ceil(totalProducts / effectivePageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedProducts = useMemo(() => {
    if (isAllPages) return filteredProducts;
    const start = (safeCurrentPage - 1) * effectivePageSize;
    return filteredProducts.slice(start, start + effectivePageSize);
  }, [filteredProducts, safeCurrentPage, effectivePageSize, isAllPages]);

  const startItem = totalProducts === 0 ? 0 : isAllPages ? 1 : (safeCurrentPage - 1) * effectivePageSize + 1;
  const endItem = isAllPages ? totalProducts : Math.min(safeCurrentPage * effectivePageSize, totalProducts);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === safeCurrentPage) return;
    setCurrentPage(newPage);
    if (typeof window !== 'undefined') {
      const el = document.getElementById('catalog');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (safeCurrentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages];
  };

  return (
    <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-700 font-semibold tracking-wider uppercase mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Featured Collections</span>
          </div>
          <h2 className={`text-2xl sm:text-3xl font-serif font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            {selectedCategory && selectedCategory !== 'all'
              ? `Explore ${selectedCategory}`
              : 'Explore All Products'}
          </h2>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Showing {filteredProducts.length} of {publicProducts.length}{' '}
            {selectedCategory && selectedCategory !== 'all'
              ? getCategoryPluralName(selectedCategory).toLowerCase()
              : 'products'}
          </p>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap sm:flex-nowrap">
          {/* Search Box */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, SKU code..."
              className={`w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 ${
                isDark
                  ? 'bg-neutral-900 border-neutral-800 text-white placeholder-neutral-500'
                  : 'bg-white border-neutral-300 text-neutral-900'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className={`flex items-center gap-1.5 border rounded-xl px-2.5 py-1.5 shadow-xs shrink-0 ${
            isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-200' : 'bg-white border-neutral-300 text-neutral-800'
          }`}>
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={`text-xs sm:text-sm bg-transparent font-medium focus:outline-hidden cursor-pointer ${
                isDark ? 'text-neutral-200 bg-neutral-900' : 'text-neutral-800 bg-white'
              }`}
            >
              <option value="newest" className={isDark ? 'bg-neutral-900 text-white' : ''}>Newest Arrivals</option>
              <option value="price-asc" className={isDark ? 'bg-neutral-900 text-white' : ''}>Price: Low to High</option>
              <option value="price-desc" className={isDark ? 'bg-neutral-900 text-white' : ''}>Price: High to Low</option>
              <option value="name-asc" className={isDark ? 'bg-neutral-900 text-white' : ''}>Name: A to Z</option>
              <option value="name-desc" className={isDark ? 'bg-neutral-900 text-white' : ''}>Name: Z to A</option>
            </select>
          </div>

          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="md:hidden p-2 rounded-xl bg-white border border-neutral-300 text-neutral-700 relative"
            aria-label="Filter"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-neutral-950 font-bold text-[10px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>


      {/* 4 Multi-Select Dropdowns: Stock, Price Range, Colour, Size */}
      <div ref={dropdownRef} className="relative z-40 mb-8 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Stock Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'stock' ? null : 'stock')}
              className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-2xs ${
                selectedStockStatuses.length > 0
                  ? 'bg-amber-500 text-neutral-950 border-amber-600'
                  : isDark
                  ? 'bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800'
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
              <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-3 z-50 space-y-2 animate-in fade-in-50 zoom-in-95 ring-1 ring-black/10">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
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
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isChecked ? 'bg-amber-500 border-amber-600 text-neutral-950' : 'border-neutral-300 dark:border-neutral-700'
                          }`}>
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className={isChecked ? 'font-bold text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300'}>
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

          {/* Price Range Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'price' ? null : 'price')}
              className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-2xs ${
                selectedPriceRanges.length > 0
                  ? 'bg-amber-500 text-neutral-950 border-amber-600'
                  : isDark
                  ? 'bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800'
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
              <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-3 z-50 space-y-2 animate-in fade-in-50 zoom-in-95 ring-1 ring-black/10">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
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
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isChecked ? 'bg-amber-500 border-amber-600 text-neutral-950' : 'border-neutral-300 dark:border-neutral-700'
                          }`}>
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className={isChecked ? 'font-bold text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300'}>
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

          {/* Colour Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'color' ? null : 'color')}
              className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-2xs ${
                selectedColors.length > 0
                  ? 'bg-amber-500 text-neutral-950 border-amber-600'
                  : isDark
                  ? 'bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800'
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
              <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-60 sm:w-64 max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-3 z-50 space-y-2 animate-in fade-in-50 zoom-in-95 ring-1 ring-black/10">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
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
                  {publishedColors.length === 0 ? (
                    <p className="text-xs text-neutral-400 p-2 text-center">No colors configured</p>
                  ) : (
                    publishedColors.map((color) => {
                      const isChecked = selectedColors.includes(color);
                      return (
                        <label
                          key={color}
                          onClick={() => toggleColor(color)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isChecked ? 'bg-amber-500 border-amber-600 text-neutral-950' : 'border-neutral-300 dark:border-neutral-700'
                            }`}>
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className="w-3 h-3 rounded-full border border-neutral-300 shrink-0" style={{ backgroundColor: color.toLowerCase() }} />
                            <span className={isChecked ? 'font-bold text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300'}>
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

          {/* Size Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'size' ? null : 'size')}
              className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-2xs ${
                selectedSizes.length > 0
                  ? 'bg-amber-500 text-neutral-950 border-amber-600'
                  : isDark
                  ? 'bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800'
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
              <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-60 sm:w-64 max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-3 z-50 space-y-2 animate-in fade-in-50 zoom-in-95 ring-1 ring-black/10">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
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
                  {publishedSizes.map((size) => {
                    const isChecked = selectedSizes.includes(size);
                    return (
                      <label
                        key={size}
                        onClick={() => toggleSize(size)}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isChecked ? 'bg-amber-500 border-amber-600 text-neutral-950' : 'border-neutral-300 dark:border-neutral-700'
                          }`}>
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className={isChecked ? 'font-bold text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300'}>
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

          {/* Reset Filters Action */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1 ml-auto cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset all filters</span>
            </button>
          )}
        </div>

        {/* Active Filter Badges */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-[11px] text-neutral-400 font-medium mr-1">Active:</span>
            {selectedStockStatuses.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 text-xs font-medium"
              >
                <span>Stock: {s === 'instock' ? 'In Stock' : s === 'outofstock' ? 'Out of Stock' : 'Restocked'}</span>
                <button type="button" onClick={() => toggleStockStatus(s)} className="hover:text-black dark:hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedPriceRanges.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200 text-xs font-medium"
              >
                <span>Price: ₹{p}</span>
                <button type="button" onClick={() => togglePriceRange(p)} className="hover:text-black dark:hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedColors.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200 text-xs font-medium"
              >
                <span>Colour: {c}</span>
                <button type="button" onClick={() => toggleColor(c)} className="hover:text-black dark:hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedSizes.map((sz) => (
              <span
                key={sz}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200 text-xs font-medium"
              >
                <span>Size: {sz}</span>
                <button type="button" onClick={() => toggleSize(sz)} className="hover:text-black dark:hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Grid of Products */}
      {filteredProducts.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-neutral-200 p-8">
          <p className="font-serif text-xl font-bold text-neutral-800">
            No {selectedCategory !== 'all' ? getCategoryPluralName(selectedCategory) : 'Products'} Found
          </p>
          <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
            We couldn't find any {selectedCategory !== 'all' ? getCategoryPluralName(selectedCategory).toLowerCase() : 'products'} matching your selected filters. Try choosing a different option or resetting your search.
          </p>
          <button
            onClick={resetFilters}
            className="mt-4 px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {paginatedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenDetails={onOpenDetails}
              />
            ))}
          </div>

          {/* Scalable Page Numbers & Navigation Controls Below Products */}
          <div className="mt-10 pt-6 border-t border-neutral-200 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Left: Product Count & Per Page Selector */}
            <div className="flex items-center gap-3 text-xs text-neutral-600 flex-wrap justify-center md:justify-start">
              <span>
                Showing <strong className="text-neutral-900 font-bold">{startItem}–{endItem}</strong> of{' '}
                <strong className="text-neutral-900 font-bold">{totalProducts}</strong> {selectedCategory !== 'all' ? getCategoryPluralName(selectedCategory).toLowerCase() : 'sarees'}
              </span>

              {totalProducts > 9 && (
                <div className="flex items-center gap-1 pl-2 border-l border-neutral-200">
                  <span className="text-neutral-500 text-[11px]">Per Page:</span>
                  {[9, 18, 36, -1].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setPageSize(size);
                        setCurrentPage(1);
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                        pageSize === size
                          ? 'bg-amber-500 text-neutral-950 font-bold shadow-2xs'
                          : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {size === -1 ? 'All' : size}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Page Numbers & Previous / Next Controls */}
            {totalPages > 1 && (
              <nav aria-label="Product pagination" className="flex items-center gap-1.5 flex-wrap justify-center">
                {/* Previous Page Button */}
                <button
                  type="button"
                  onClick={() => handlePageChange(safeCurrentPage - 1)}
                  disabled={safeCurrentPage <= 1}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition ${
                    safeCurrentPage <= 1
                      ? 'text-neutral-300 bg-neutral-50 cursor-not-allowed border border-neutral-100'
                      : 'text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 cursor-pointer shadow-2xs'
                  }`}
                  aria-label="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                {/* Page Number Buttons */}
                {getPageNumbers().map((item, idx) => {
                  if (item === '...') {
                    return (
                      <span
                        key={`ellipsis-${idx}`}
                        className="w-8 h-8 flex items-center justify-center text-neutral-400 text-xs select-none"
                      >
                        …
                      </span>
                    );
                  }

                  const pageNum = Number(item);
                  const isActive = pageNum === safeCurrentPage;

                  return (
                    <button
                      key={`page-${pageNum}`}
                      type="button"
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                        isActive
                          ? 'bg-neutral-900 text-white shadow-xs ring-2 ring-amber-400/60'
                          : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 shadow-2xs'
                      }`}
                      aria-label={`Go to page ${pageNum}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                {/* Next Page Button */}
                <button
                  type="button"
                  onClick={() => handlePageChange(safeCurrentPage + 1)}
                  disabled={safeCurrentPage >= totalPages}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition ${
                    safeCurrentPage >= totalPages
                      ? 'text-neutral-300 bg-neutral-50 cursor-not-allowed border border-neutral-100'
                      : 'text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 cursor-pointer shadow-2xs'
                  }`}
                  aria-label="Next Page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </nav>
            )}
          </div>
        </>
      )}
    </section>
  );
};
