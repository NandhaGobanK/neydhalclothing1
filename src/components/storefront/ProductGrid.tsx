import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from './ProductCard';
import { Product } from '../../types/store';
import { Search, SlidersHorizontal, X, Sparkles, ArrowUpDown, Tag } from 'lucide-react';

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
  const { publicProducts } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<
    'featured' | 'price-asc' | 'price-desc' | 'newest' | 'rating-desc' | 'name-asc' | 'name-desc'
  >('featured');
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
        // Category / Fabric (Only published)
        if (selectedCategory !== 'all' && p.fabric !== selectedCategory) {
          return false;
        }
        // Color (Only published)
        if (selectedColor !== 'all' && p.color !== selectedColor) {
          return false;
        }
        // Price Ranges: 0-100, 100-500, 500-1000, 1000-2000, and above-2000
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
            (p.productCode && p.productCode.toLowerCase().includes(q)) ||
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
        if (sortBy === 'rating-desc') {
          const ratingA = (a as any).rating || 5;
          const ratingB = (b as any).rating || 5;
          return ratingB - ratingA;
        }
        if (sortBy === 'name-asc') return a.title.localeCompare(b.title);
        if (sortBy === 'name-desc') return b.title.localeCompare(a.title);
        // Featured default
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
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900">
            Curated Saree Collection
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Showing {filteredProducts.length} of {publicProducts.length} published sarees
          </p>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap sm:flex-nowrap">
          {/* Search Box */}
          <div className="relative flex-1 md:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search silk, weave, color..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl bg-white border border-neutral-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-neutral-300 rounded-xl px-2.5 py-1.5 shadow-xs shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs sm:text-sm bg-transparent text-neutral-800 font-medium focus:outline-hidden cursor-pointer"
              title="Sort sarees"
            >
              <option value="featured">Featured First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="newest">Newest Arrivals</option>
              <option value="rating-desc">Rating: High to Low</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
            </select>
          </div>

          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="md:hidden p-2 rounded-xl bg-white border border-neutral-300 text-neutral-700 relative cursor-pointer"
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
        {/* Fabric Filter - ONLY keywords from published sarees */}
        {publishedFabrics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 p-2 bg-neutral-100 rounded-2xl">
            <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider px-2 flex items-center gap-1">
              <Tag className="w-3 h-3 text-amber-600" />
              <span>Fabrics:</span>
            </span>
            <button
              onClick={() => onSelectCategory?.('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/70'
              }`}
            >
              All Fabrics
            </button>
            {publishedFabrics.map((fabric) => (
              <button
                key={fabric}
                onClick={() => onSelectCategory?.(fabric)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === fabric
                    ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                    : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200/70'
                }`}
              >
                {fabric}
              </button>
            ))}
          </div>
        )}

        {/* Color & Price Row */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {/* Colors - ONLY keywords from published sarees */}
          {publishedColors.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-neutral-600 font-bold text-[11px] uppercase tracking-wider">Color:</span>
              <button
                onClick={() => setSelectedColor('all')}
                className={`px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition ${
                  selectedColor === 'all'
                    ? 'border-neutral-900 bg-neutral-900 text-white font-semibold shadow-xs'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                }`}
              >
                All Colors
              </button>
              {publishedColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition ${
                    selectedColor === color
                      ? 'border-rose-900 bg-rose-50 text-rose-900 font-bold shadow-xs'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          )}

          {/* Price Range: 0-100, 100-500, 500-1000, 1000-2000, above-2000 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-neutral-600 font-bold text-[11px] uppercase tracking-wider">Price Range:</span>
            {[
              { id: 'all', label: 'All Prices' },
              { id: '0-100', label: '₹0 - ₹100' },
              { id: '100-500', label: '₹100 - ₹500' },
              { id: '500-1000', label: '₹500 - ₹1,000' },
              { id: '1000-2000', label: '₹1,000 - ₹2,000' },
              { id: 'above-2000', label: 'Above ₹2,000' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPriceRange(p.id)}
                className={`px-2.5 py-1 rounded-lg border text-xs transition cursor-pointer ${
                  priceRange === p.id
                    ? 'border-amber-700 bg-amber-50 text-amber-950 font-bold shadow-xs'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="text-xs text-rose-700 hover:text-rose-900 underline font-semibold ml-auto cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* Grid of Sarees */}
      {filteredProducts.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-neutral-200 p-8 shadow-xs">
          <p className="font-serif text-xl font-bold text-neutral-800">No Sarees Found</p>
          <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
            We couldn't find any sarees matching your selected fabric, color, or price range filters. Try resetting your filters to view all published drapes.
          </p>
          <button
            onClick={resetFilters}
            className="mt-4 px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition cursor-pointer"
          >
            Reset All Filters
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
