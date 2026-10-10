import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, SareeFabric, SareeColor } from '../../types/store';
import { formatPrice } from '../../utils/upi';
import {
  Plus,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Video,
  Image as ImageIcon,
  Check,
  X,
  Upload,
  Sparkles,
} from 'lucide-react';

export const ProductManager: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, toggleProductVisibility } = useStore();

  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [productCode, setProductCode] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [fabric, setFabric] = useState<SareeFabric>('Kanjivaram Silk');
  const [color, setColor] = useState<SareeColor>('Crimson Red');
  const [price, setPrice] = useState<number>(25000);
  const [originalPrice, setOriginalPrice] = useState<number>(30000);
  const [stockStatus, setStockStatus] = useState<'in_stock' | 'out_of_stock' | 'limited'>('in_stock');
  const [stockCount, setStockCount] = useState<number>(5);
  const [isVisible, setIsVisible] = useState(true);
  const [images, setImages] = useState<string[]>([
    '/src/assets/images/saree_kanjivaram_crimson_1791651781402.jpg',
  ]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [weaveDetails, setWeaveDetails] = useState('');
  const [borderType, setBorderType] = useState('');
  const [blousePieceIncluded, setBlousePieceIncluded] = useState(true);
  const [lengthMeters, setLengthMeters] = useState(6.3);
  const [occasion, setOccasion] = useState('Bridal & Wedding');

  const generateSuggestedSku = (fab: SareeFabric, col: SareeColor) => {
    const prefix = fab.substring(0, 3).toUpperCase();
    const colPrefix = col.substring(0, 4).toUpperCase();
    const randomCode = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${colPrefix}-${randomCode}`;
  };

  const fabrics: SareeFabric[] = [
    'Kanjivaram Silk',
    'Banarasi Brocade',
    'Chanderi Tissue',
    'Organza Silk',
    'Pure Georgette',
    'Tussar Handloom',
    'Cotton Silk',
  ];

  const colors: SareeColor[] = [
    'Crimson Red',
    'Emerald Green',
    'Lavender',
    'Royal Blue',
    'Mustard Gold',
    'Rani Pink',
    'Midnight Black',
    'Ivory Cream',
  ];

  const openAddModal = () => {
    setEditingProduct(null);
    setProductCode(generateSuggestedSku('Kanjivaram Silk', 'Crimson Red'));
    setTitle('');
    setSubtitle('');
    setDescription('');
    setFabric('Kanjivaram Silk');
    setColor('Crimson Red');
    setPrice(28000);
    setOriginalPrice(34000);
    setStockStatus('in_stock');
    setStockCount(3);
    setIsVisible(true);
    setImages(['/src/assets/images/saree_kanjivaram_crimson_1791651781402.jpg']);
    setImageUrlInput('');
    setVideoUrl('https://www.youtube.com/watch?v=0hW73jL76bY');
    setWeaveDetails('Hand-interlocked Korvai weave with pure zari');
    setBorderType('Contrast 8-inch Temple Gopuram border');
    setBlousePieceIncluded(true);
    setLengthMeters(6.3);
    setOccasion('Wedding & Reception');
    setIsEditingModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setProductCode(prod.productCode || generateSuggestedSku(prod.fabric, prod.color));
    setTitle(prod.title);
    setSubtitle(prod.subtitle || '');
    setDescription(prod.description);
    setFabric(prod.fabric);
    setColor(prod.color);
    setPrice(prod.price);
    setOriginalPrice(prod.originalPrice || prod.price);
    setStockStatus(prod.stockStatus);
    setStockCount(prod.stockCount);
    setIsVisible(prod.isVisible);
    setImages(prod.images || []);
    setImageUrlInput('');
    setVideoUrl(prod.videoUrl || '');
    setWeaveDetails(prod.weaveDetails || '');
    setBorderType(prod.borderType || '');
    setBlousePieceIncluded(prod.blousePieceIncluded);
    setLengthMeters(prod.lengthMeters || 6.3);
    setOccasion(prod.occasion || 'Festive');
    setIsEditingModalOpen(true);
  };

  const handleAddImageUrl = () => {
    if (imageUrlInput.trim()) {
      setImages([...images, imageUrlInput.trim()]);
      setImageUrlInput('');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImages([...images, reader.result]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalSku = productCode.trim() || generateSuggestedSku(fabric, color);

    const payload = {
      productCode: finalSku,
      title: title.trim(),
      subtitle: subtitle.trim(),
      description: description.trim(),
      fabric,
      color,
      price: Number(price),
      originalPrice: Number(originalPrice) || undefined,
      stockStatus,
      stockCount: Number(stockCount),
      isVisible,
      images: images.length > 0 ? images : ['/src/assets/images/hero_saree_atelier_1791651761357.jpg'],
      videoUrl: videoUrl.trim() || undefined,
      weaveDetails: weaveDetails.trim(),
      borderType: borderType.trim(),
      blousePieceIncluded,
      lengthMeters: Number(lengthMeters),
      occasion: occasion.trim(),
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, payload);
    } else {
      addProduct(payload);
    }

    setIsEditingModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900">
            Saree Catalog & Inventory
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Total {products.length} sarees · {products.filter((p) => p.isVisible).length} visible on storefront
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Saree</span>
        </button>
      </div>

      {/* Saree Inventory Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-3">Unique Code / SKU</th>
                <th className="py-3 px-4">Saree</th>
                <th className="py-3 px-4">Fabric & Color</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Stock</th>
                <th className="py-3 px-4">Storefront Visibility</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-neutral-50/50 transition">
                  {/* SKU Unique Code */}
                  <td className="py-3 px-3">
                    <span className="font-mono text-xs font-bold text-rose-950 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      {product.productCode}
                    </span>
                  </td>

                  {/* Saree Image & Title */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.images[0] || '/src/assets/images/hero_saree_atelier_1791651761357.jpg'}
                        alt={product.title}
                        className="w-12 h-14 object-cover rounded-lg bg-neutral-100 border border-neutral-200 shrink-0"
                      />
                      <div className="min-w-0 max-w-xs">
                        <p className="font-serif font-bold text-sm text-neutral-900 truncate">
                          {product.title}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                          {product.videoUrl && (
                            <span className="flex items-center gap-1 text-rose-800 font-semibold">
                              <Video className="w-3 h-3" />
                              <span>Video</span>
                            </span>
                          )}
                          <span>{product.images.length} photos</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Fabric & Color */}
                  <td className="py-3 px-4">
                    <p className="font-semibold text-neutral-800">{product.fabric}</p>
                    <p className="text-neutral-500 text-[11px]">{product.color}</p>
                  </td>

                  {/* Price */}
                  <td className="py-3 px-4">
                    <p className="font-bold text-neutral-900 tabular-nums">{formatPrice(product.price)}</p>
                    {product.originalPrice && (
                      <p className="text-[11px] text-neutral-400 line-through tabular-nums">
                        {formatPrice(product.originalPrice)}
                      </p>
                    )}
                  </td>

                  {/* Stock */}
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        product.stockStatus === 'in_stock'
                          ? 'bg-emerald-100 text-emerald-800'
                          : product.stockStatus === 'limited'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {product.stockStatus === 'in_stock'
                        ? `In Stock (${product.stockCount})`
                        : product.stockStatus === 'limited'
                        ? `Limited (${product.stockCount})`
                        : 'Out of Stock'}
                    </span>
                  </td>

                  {/* Visibility Toggle Button */}
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleProductVisibility(product.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${
                        product.isVisible
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                          : 'bg-neutral-100 text-neutral-500 border border-neutral-300 hover:bg-neutral-200'
                      }`}
                      title="Click to toggle public storefront display"
                    >
                      {product.isVisible ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Visible</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Hidden</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEditModal(product)}
                        className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition"
                        title="Edit Saree Details"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${product.title}"?`)) {
                            deleteProduct(product.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition"
                        title="Delete Saree"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Saree Modal */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-900 text-white shrink-0">
              <h3 className="font-serif text-lg sm:text-xl font-bold">
                {editingProduct ? 'Edit Saree Details' : 'Add New Handloom Saree'}
              </h3>
              <button
                onClick={() => setIsEditingModalOpen(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveProduct} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-neutral-800">
                      Product Unique Code (SKU - Product & Color Wise) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setProductCode(generateSuggestedSku(fabric, color))}
                      className="text-[11px] text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1 transition"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>Regenerate Code from Fabric & Color</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value.toUpperCase())}
                    required
                    placeholder="e.g. KAN-CRIM-101"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono text-xs uppercase text-neutral-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Unique SKU code for this specific drape & colorway. Used to record exact sales attribution, analytics, and stock records.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-neutral-800 mb-1">Saree Name / Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Maharani Pure Kanjivaram Bridal Silk"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-neutral-700 mb-1">Subtitle / Weave Highlight</label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="e.g. Pure Mulberry Silk with 3G Pure Gold Zari"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Fabric Category *</label>
                  <select
                    value={fabric}
                    onChange={(e) => setFabric(e.target.value as SareeFabric)}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900"
                  >
                    {fabrics.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Color Palette *</label>
                  <select
                    value={color}
                    onChange={(e) => setColor(e.target.value as SareeColor)}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900"
                  >
                    {colors.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-neutral-800 mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    required
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Original Price (₹) (Optional Discount MRP)</label>
                  <input
                    type="number"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Stock Status</label>
                  <select
                    value={stockStatus}
                    onChange={(e) => setStockStatus(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900"
                  >
                    <option value="in_stock">In Stock</option>
                    <option value="limited">Limited Pieces</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Stock Units</label>
                  <input
                    type="number"
                    value={stockCount}
                    onChange={(e) => setStockCount(Number(e.target.value))}
                    min={0}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-neutral-700 mb-1">Artisan Story / Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the handloom weaving details, origin, motif meanings, and pallu craftsmanship..."
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Video Drape URL (YouTube, Instagram Reel, or MP4)
                  </label>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://instagram.com/reel/..."
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                  />
                </div>

                {/* Saree Images Management */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="block font-bold text-neutral-800">Saree Photos (URLs or Upload)</label>
                  
                  {/* Preview image thumbnails */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative w-16 h-20 rounded-lg overflow-hidden border border-neutral-300 group">
                        <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="Paste image URL here"
                      className="flex-1 p-2 rounded-xl border border-neutral-300 text-neutral-900"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="px-3 py-2 rounded-xl bg-neutral-900 text-white font-medium hover:bg-neutral-800"
                    >
                      Add URL
                    </button>
                    <label className="px-3 py-2 rounded-xl bg-neutral-100 border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-200 cursor-pointer flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Weave Specifications */}
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Weave Technique</label>
                  <input
                    type="text"
                    value={weaveDetails}
                    onChange={(e) => setWeaveDetails(e.target.value)}
                    placeholder="e.g. Double-Korvai Handloom"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Border & Pallu Detail</label>
                  <input
                    type="text"
                    value={borderType}
                    onChange={(e) => setBorderType(e.target.value)}
                    placeholder="e.g. 9-inch Temple Border"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Length (Meters)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={lengthMeters}
                    onChange={(e) => setLengthMeters(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Occasion</label>
                  <input
                    type="text"
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                    placeholder="e.g. Bridal Muhurtham"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div>
                    <p className="font-bold text-neutral-900">Show on Public Storefront</p>
                    <p className="text-neutral-500 text-[11px]">Toggle whether customers can view & purchase this saree</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(e) => setIsVisible(e.target.checked)}
                    className="w-5 h-5 rounded text-rose-900 cursor-pointer"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-neutral-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditingModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold shadow-sm"
                >
                  {editingProduct ? 'Save Changes' : 'Publish Saree'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
