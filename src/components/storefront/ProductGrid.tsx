import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from './ProductCard';
import { Product, SareeFabric, SareeColor } from '../../types/store';
import { Search, SlidersHorizontal, X, Sparkles } from 'lucide-react';

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
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Available unique fabrics and colors
  const fabrics: SareeFabric[] = [
    'Kanjivaram Silk',
    'Banarasi Brocade',
    'Chanderi Tissue',
    'Organza Silk',
    'Pure Georgette',
  ];

  const colors: SareeColor[] = [
    'Crimson Red',
    'Emerald Green',
    'Lavender',
    'Royal Blue',
    'Mustard Gold',
    'Rani Pink',
    'Ivory Cream',
  ];

  const allAvailableColors = useMemo(() => {
    const list = [...colors];
    publicProducts.forEach((p) => {
      if (p.color && !list.includes(p.color as any)) {
        list.push(p.color as any);
      }
    });
    return list;
  }, [publicProducts]);

  const filteredProducts = useMemo(() => {
    return publicProducts
      .filter((p) => {
        // Category / Fabric
        if (selectedCategory !== 'all' && p.fabric !== selectedCategory) {
          return false;
        }
        // Color
        if (selectedColor !== 'all' && p.color !== selectedColor) {
          return false;
        }
        // Price Range
        if (priceRange === 'under-20k' && p.price >= 20000) return false;
        if (priceRange === '20k-30k' && (p.price < 20000 || p.price > 30000)) return false;
        if (priceRange === 'above-30k' && p.price <= 30000) return false;
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
            Showing {filteredProducts.length} of {publicProducts.length} available handlooms
          </p>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 md:w-64">
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="py-2 px-3 text-xs sm:text-sm rounded-xl bg-white border border-neutral-300 text-neutral-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="featured">Featured First</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>

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
        {/* Fabric Filter */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-neutral-100 rounded-xl">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase px-2">Fabric:</span>
          <button
            onClick={() => onSelectCategory?.('all')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            All Fabrics
          </button>
          {fabrics.map((fabric) => (
            <button
              key={fabric}
              onClick={() => onSelectCategory?.(fabric)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                selectedCategory === fabric
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
              }`}
            >
              {fabric}
            </button>
          ))}
        </div>

        {/* Color & Price Row */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {/* Colors */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-neutral-500 font-medium">Color:</span>
            <button
              onClick={() => setSelectedColor('all')}
              className={`px-2.5 py-1 rounded-md border text-xs ${
                selectedColor === 'all'
                  ? 'border-neutral-900 bg-neutral-900 text-white font-medium'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
              }`}
            >
              All Colors
            </button>
            {allAvailableColors.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`px-2.5 py-1 rounded-md border text-xs ${
                  selectedColor === color
                    ? 'border-rose-900 bg-rose-50 text-rose-900 font-medium'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                }`}
              >
                {color}
              </button>
            ))}
          </div>

          {/* Price Range */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-neutral-500 font-medium">Price:</span>
            {[
              { id: 'all', label: 'Any Price' },
              { id: 'under-20k', label: 'Under ₹20,000' },
              { id: '20k-30k', label: '₹20k - ₹30k' },
              { id: 'above-30k', label: 'Above ₹30,000' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPriceRange(p.id)}
                className={`px-2.5 py-1 rounded-md border text-xs ${
                  priceRange === p.id
                    ? 'border-amber-700 bg-amber-50 text-amber-900 font-medium'
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
              className="text-xs text-rose-700 hover:text-rose-900 underline font-medium ml-auto"
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
