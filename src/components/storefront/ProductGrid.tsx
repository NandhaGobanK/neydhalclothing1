import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from './ProductCard';
import { Product } from '../../types/store';
import { Search, SlidersHorizontal, X, Sparkles, ArrowUpDown } from 'lucide-react';

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
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'newest' | 'name-asc' | 'name-desc'>('featured');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Available unique fabrics and colors ONLY from products published from the admin page
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
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [publicProducts]);

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
        // Color
        if (selectedColor !== 'all' && p.color !== selectedColor) {
          return false;
        }
        // Price Range: 0-100, 100-500, 500-1000, 1000-2000, 2000+
        if (priceRange === '0-100' && (p.price < 0 || p.price > 100)) return false;
        if (priceRange === '100-500' && (p.price < 100 || p.price > 500)) return false;
        if (priceRange === '500-1000' && (p.price < 500 || p.price > 1000)) return false;
        if (priceRange === '1000-2000' && (p.price < 1000 || p.price > 2000)) return false;
        if (priceRange === 'above-2000' && p.price <= 2000) return false;
        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            p.title.toLowerCase().includes(q) ||
            p.fabric.toLowerCase().includes(q) ||
            p.color.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'newest') {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        }
        if (sortBy === 'name-asc') return a.title.localeCompare(b.title);
        if (sortBy === 'name-desc') return b.title.localeCompare(a.title);
        return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
      });
  }, [publicProducts, selectedCategory, selectedColor, priceRange, searchQuery, sortBy]);

  const activeFilterCount =
    (selectedCategory !== 'all' ? 1 : 0) +
    (selectedColor !== 'all' ? 1 : 0) +
    (priceRange !== 'all' ? 1 : 0) +
    (searchQuery ? 1 : 0);

  const resetFilters = () => {
    onSelectCategory?.('all');
    setSelectedColor('all');
    setPriceRange('all');
    setSearchQuery('');
    setSortBy('featured');
  };

  return (
    <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-700 font-semibold tracking-wider uppercase mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Handloom Masterpieces</span>
          </div>
          <h2 className={`text-2xl sm:text-3xl font-serif font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            Search Saree Catalog
          </h2>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Showing {filteredProducts.length} of {publicProducts.length} available handlooms
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
              <option value="featured" className={isDark ? 'bg-neutral-900 text-white' : ''}>Featured First</option>
              <option value="price-asc" className={isDark ? 'bg-neutral-900 text-white' : ''}>Price: Low to High</option>
              <option value="price-desc" className={isDark ? 'bg-neutral-900 text-white' : ''}>Price: High to Low</option>
              <option value="newest" className={isDark ? 'bg-neutral-900 text-white' : ''}>Newest Arrivals</option>
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

      {/* Filter Bar (Segmented button tabs) */}
      <div className={`space-y-4 mb-8 ${showMobileFilters ? 'block' : 'hidden md:block'}`}>
        {/* Fabric Filter - Only published fabrics */}
        {publishedFabrics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-neutral-100 rounded-xl">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase px-2">Fabric:</span>
            <button
              onClick={() => onSelectCategory?.('all')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
              }`}
            >
              All Fabrics
            </button>
            {publishedFabrics.map((fabric) => (
              <button
                key={fabric}
                onClick={() => onSelectCategory?.(fabric)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === fabric
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
                }`}
              >
                {fabric}
              </button>
            ))}
          </div>
        )}

        {/* Color & Price Row */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {/* Colors - Only published colors */}
          {publishedColors.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-neutral-500 font-medium">Color:</span>
              <button
                onClick={() => setSelectedColor('all')}
                className={`px-2.5 py-1 rounded-md border text-xs cursor-pointer ${
                  selectedColor === 'all'
                    ? 'border-neutral-900 bg-neutral-900 text-white font-medium'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                }`}
              >
                All Colors
              </button>
              {publishedColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`px-2.5 py-1 rounded-md border text-xs cursor-pointer ${
                    selectedColor === color
                      ? 'border-rose-900 bg-rose-50 text-rose-900 font-medium'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          )}

          {/* Price Range: 0-100, 100-500, 500-1000, 1000-2000 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-neutral-500 font-medium">Price:</span>
            {[
              { id: 'all', label: 'Any Price' },
              { id: '0-100', label: '0 - 100' },
              { id: '100-500', label: '100 - 500' },
              { id: '500-1000', label: '500 - 1000' },
              { id: '1000-2000', label: '1000 - 2000' },
              { id: 'above-2000', label: '2000+' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPriceRange(p.id)}
                className={`px-2.5 py-1 rounded-md border text-xs transition cursor-pointer ${
                  priceRange === p.id
                    ? 'border-amber-700 bg-amber-50 text-amber-900 font-bold shadow-xs'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="text-xs text-rose-700 hover:text-rose-900 underline font-medium ml-auto cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* Grid of Sarees */}
      {filteredProducts.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-neutral-200 p-8">
          <p className="font-serif text-xl font-bold text-neutral-800">No Sarees Found</p>
          <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
            We couldn't find any sarees matching your selected filters. Try choosing a different fabric or resetting your search.
          </p>
          <button
            onClick={resetFilters}
            className="mt-4 px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpenDetails={onOpenDetails}
            />
          ))}
        </div>
      )}
    </section>
  );
};
