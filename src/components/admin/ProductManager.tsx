import React, { useState, useMemo } from 'react';
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
  Lock,
  AlertCircle,
  Copy,
  Search,
} from 'lucide-react';

export const ProductManager: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, toggleProductVisibility, currentPermissions } = useStore();

  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  // Auto Generate & Confirmation States (Prompt: Auto generate enabled on add, can be disabled once colour confirmed)
  const [autoGenerateEnabled, setAutoGenerateEnabled] = useState(true);
  const [isColorConfirmed, setIsColorConfirmed] = useState(false);

  // Form Fields
  const [productCode, setProductCode] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [fabric, setFabric] = useState<SareeFabric>('Kanjivaram Silk');
  const [selectedColorOption, setSelectedColorOption] = useState<string>('Crimson Red');
  const [customColor, setCustomColor] = useState('');
  // Map of SKU codes permanently given for each color for this product
  const [assignedColorCodes, setAssignedColorCodes] = useState<Record<string, string>>({});

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

  // Guaranteed Unique SKU Generator
  const generateGuaranteedUniqueSku = (fab: string, col: string) => {
    const cleanFab = fab.replace(/[^a-zA-Z]/g, '');
    const cleanCol = col.replace(/[^a-zA-Z]/g, '');
    const prefix = (cleanFab.substring(0, 3) || 'SAR').toUpperCase();
    const colPrefix = (cleanCol.substring(0, 4) || 'COL').toUpperCase();
    let candidate = '';
    let attempts = 0;
    do {
      const randomCode = Math.floor(100 + Math.random() * 900);
      candidate = `AARA-${prefix}-${colPrefix}-${randomCode}`;
      attempts++;
    } while (
      products.some((p) => p.productCode.toUpperCase() === candidate && p.id !== editingProduct?.id) &&
      attempts < 50
    );
    return candidate;
  };

  const autoFillSareeDetails = (fab: SareeFabric, col: string) => {
    const colorDesc = col || 'Festive';
    let suggestedTitle = '';
    let suggestedSubtitle = '';
    let suggestedDesc = '';
    let suggestedWeave = '';
    let suggestedBorder = '';
    let suggestedPrice = 28500;
    let suggestedOriginal = 34000;

    switch (fab) {
      case 'Kanjivaram Silk':
        suggestedTitle = `Royal ${colorDesc} Shrimant Kanjivaram Bridal Silk`;
        suggestedSubtitle = 'Pure Mulberry Silk with Tested Gold Zari Temple Pallu';
        suggestedDesc = `Individually hand-woven over 24 artisan days in Kanchipuram, this heirloom ${colorDesc.toLowerCase()} drape features classic interlocking temple gopuram borders and delicate peacock motifs. Certified pure silk mark.`;
        suggestedWeave = 'Authentic 3-ply mulberry double-korvai handloom with gold zari';
        suggestedBorder = 'Traditional 8-inch contrast Korvai border with Mayil motifs';
        suggestedPrice = 32500;
        suggestedOriginal = 39000;
        break;
      case 'Banarasi Brocade':
        suggestedTitle = `Varanasi Kadwa ${colorDesc} Floral Brocade`;
        suggestedSubtitle = 'Fine Katan Silk with Meenakari Floral Jaal';
        suggestedDesc = `Artisan-crafted on heritage pit looms along the banks of Varanasi. Features intricate antique gold zari hunting motifs, interlocking lotus vines, and vivid ${colorDesc.toLowerCase()} butas.`;
        suggestedWeave = 'Kadwa hand-woven with individual meena threads on pure Katan silk';
        suggestedBorder = 'Intricate Shikargah border with scalloped edges';
        suggestedPrice = 29500;
        suggestedOriginal = 36000;
        break;
      case 'Chanderi Tissue':
        suggestedTitle = `Gossamer ${colorDesc} Chanderi Tissue Silk`;
        suggestedSubtitle = 'Feather-Light Mulberry with Roopa Kalabattu Silver Zari';
        suggestedDesc = `Ethereal sheer texture woven with fine gossamer silk and silver zari threads. Glistens gracefully under evening light, finished with delicate ashrafi buttis.`;
        suggestedWeave = 'Traditional pit-loom extra weft hand-interlace';
        suggestedBorder = 'Delicate 3-inch Zari Pasa border';
        suggestedPrice = 18500;
        suggestedOriginal = 22000;
        break;
      case 'Organza Silk':
        suggestedTitle = `Noor ${colorDesc} Hand-Embellished Organza Silk`;
        suggestedSubtitle = 'Translucent Crisp Organza with Gold Gota Work';
        suggestedDesc = `Fluid sheer silk organza drape adorned with hand-cut gota patti motifs and fine needlework along the perimeter. Ideal for contemporary cocktail celebrations.`;
        suggestedWeave = 'Crisp hand-twisted organza yarns with artisan hand needle embroidery';
        suggestedBorder = 'Hand-scalloped floral gota patti lace border';
        suggestedPrice = 16800;
        suggestedOriginal = 19500;
        break;
      case 'Pure Georgette':
        suggestedTitle = `Banarasi Khaddi ${colorDesc} Pure Georgette`;
        suggestedSubtitle = 'High-Twist Silk with Antique Matte Gold Jaal';
        suggestedDesc = `Body-hugging crinkled pure georgette saree steeped in rich ${colorDesc.toLowerCase()} with all-over antique gold leaf bootas and a sweeping zari pallu that drapes effortlessly.`;
        suggestedWeave = 'Khaddi Georgette high-twist silk warp with antique tilla motifs';
        suggestedBorder = 'Broad paisley border with gold fringe hem';
        suggestedPrice = 24500;
        suggestedOriginal = 29000;
        break;
      default:
        suggestedTitle = `Handcrafted ${colorDesc} ${fab} Saree`;
        suggestedSubtitle = 'Artisan-Woven Pure Silk Drape';
        suggestedDesc = `A majestic handcrafted ${fab.toLowerCase()} saree in radiant ${colorDesc.toLowerCase()}, woven by master artisans with authentic zari detailing.`;
        suggestedWeave = 'Traditional artisan handloom interlace';
        suggestedBorder = 'Contrast zari border with ornate selvedge';
        suggestedPrice = 22000;
        suggestedOriginal = 26500;
    }

    setTitle(suggestedTitle);
    setSubtitle(suggestedSubtitle);
    setDescription(suggestedDesc);
    setWeaveDetails(suggestedWeave);
    setBorderType(suggestedBorder);
    setPrice(suggestedPrice);
    setOriginalPrice(suggestedOriginal);
  };

  const copySkuToClipboard = (sku: string) => {
    navigator.clipboard.writeText(sku);
    setCopiedSku(sku);
    setTimeout(() => setCopiedSku(null), 2000);
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

  const standardColors: SareeColor[] = [
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
    setAutoGenerateEnabled(true);
    setIsColorConfirmed(false);
    const initialFabric: SareeFabric = 'Kanjivaram Silk';
    const initialColor = 'Crimson Red';
    const initialCode = generateGuaranteedUniqueSku(initialFabric, initialColor);
    setAssignedColorCodes({ [initialColor.toLowerCase()]: initialCode });
    setProductCode(initialCode);
    setFabric(initialFabric);
    setSelectedColorOption(initialColor);
    setCustomColor('');
    autoFillSareeDetails(initialFabric, initialColor);
    setStockStatus('in_stock');
    setStockCount(3);
    setIsVisible(true);
    setImages(['/src/assets/images/saree_kanjivaram_crimson_1791651781402.jpg']);
    setImageUrlInput('');
    setVideoUrl('https://www.youtube.com/watch?v=0hW73jL76bY');
    setBlousePieceIncluded(true);
    setLengthMeters(6.3);
    setOccasion('Wedding & Reception');
    setIsEditingModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setAutoGenerateEnabled(false);
    setIsColorConfirmed(true);
    const isStandard = standardColors.includes(prod.color as any);
    if (isStandard) {
      setSelectedColorOption(prod.color);
      setCustomColor('');
    } else {
      setSelectedColorOption('Other');
      setCustomColor(prod.color);
    }
    const codeMap = { [prod.color.toLowerCase()]: prod.productCode };
    setAssignedColorCodes(codeMap);
    setProductCode(prod.productCode);
    setTitle(prod.title);
    setSubtitle(prod.subtitle || '');
    setDescription(prod.description);
    setFabric(prod.fabric);
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

  const handleConfirmColor = () => {
    setIsColorConfirmed(true);
    setAutoGenerateEnabled(false); // Can be disabled once colour has been chosen and confirmed
  };

  const handleColorDropdownChange = (val: string) => {
    setSelectedColorOption(val);
    if (editingProduct || isColorConfirmed) {
      return;
    }
    const colName = val === 'Other' ? (customColor.trim() || 'Custom Colour') : val;
    const key = colName.toLowerCase();
    let currentCode = assignedColorCodes[key];
    if (!currentCode) {
      currentCode = generateGuaranteedUniqueSku(fabric, colName);
      setAssignedColorCodes((prev) => ({ ...prev, [key]: currentCode }));
    }
    setProductCode(currentCode);

    if (autoGenerateEnabled) {
      autoFillSareeDetails(fabric, colName);
    }
  };

  const handleCustomColorChange = (typed: string) => {
    setCustomColor(typed);
    if (editingProduct || isColorConfirmed) {
      return;
    }
    const colName = typed.trim() || 'Custom Colour';
    const key = colName.toLowerCase();
    let currentCode = assignedColorCodes[key];
    if (!currentCode) {
      currentCode = generateGuaranteedUniqueSku(fabric, colName);
      setAssignedColorCodes((prev) => ({ ...prev, [key]: currentCode }));
    }
    setProductCode(currentCode);

    if (autoGenerateEnabled && typed.trim().length > 2) {
      autoFillSareeDetails(fabric, typed.trim());
    }
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

    const finalColor = editingProduct
      ? editingProduct.color
      : selectedColorOption === 'Other'
      ? (customColor.trim() || 'Custom Colour')
      : selectedColorOption;
    // Once code is given for one colour of the product it cannot be changed again
    const finalSku = editingProduct
      ? editingProduct.productCode
      : (productCode.trim() || assignedColorCodes[finalColor.toLowerCase()] || generateGuaranteedUniqueSku(fabric, finalColor));

    const payload = {
      productCode: finalSku,
      title: title.trim(),
      subtitle: subtitle.trim(),
      description: description.trim(),
      fabric,
      color: finalColor as SareeColor,
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

  const canEditProducts = currentPermissions?.products?.canEdit !== false;

  const filteredProducts = useMemo(() => {
    if (!tableSearchQuery.trim()) return products;
    const q = tableSearchQuery.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.productCode.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.fabric.toLowerCase().includes(q) ||
        p.color.toLowerCase().includes(q)
    );
  }, [products, tableSearchQuery]);

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

        {canEditProducts ? (
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Saree</span>
          </button>
        ) : (
          <div className="px-3 py-1.5 rounded-xl bg-neutral-200 text-neutral-600 text-xs font-medium">
            Staff View-Only (Adding Sarees Restricted)
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-neutral-200 shadow-xs flex items-center gap-2.5">
        <Search className="w-4 h-4 text-neutral-400 shrink-0 ml-1" />
        <input
          type="text"
          value={tableSearchQuery}
          onChange={(e) => setTableSearchQuery(e.target.value)}
          placeholder="Search by Unique Saree Code (e.g. AARA-KAN-CRIM-101) or Saree Name..."
          className="flex-1 bg-transparent text-xs text-neutral-900 focus:outline-hidden"
        />
        {tableSearchQuery && (
          <button
            onClick={() => setTableSearchQuery('')}
            className="text-[11px] text-neutral-400 hover:text-neutral-700 px-2 py-0.5 rounded"
          >
            Clear
          </button>
        )}
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
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-neutral-50/50 transition">
                  {/* SKU Unique Code */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-rose-950 bg-rose-50 px-2 py-1 rounded-md border border-rose-200">
                        {product.productCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => copySkuToClipboard(product.productCode)}
                        className="p-1 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
                        title="Copy Unique Code"
                      >
                        {copiedSku === product.productCode ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
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
                      onClick={() => canEditProducts && toggleProductVisibility(product.id)}
                      disabled={!canEditProducts}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${
                        product.isVisible
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                          : 'bg-neutral-100 text-neutral-500 border border-neutral-300 hover:bg-neutral-200'
                      } ${!canEditProducts ? 'cursor-not-allowed opacity-80' : ''}`}
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
                      {canEditProducts ? (
                        <>
                          <button
                            onClick={() => openEditModal(product)}
                            className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition"
                            title="Edit Saree Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setProductToDelete(product)}
                            className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition"
                            title="Delete Saree"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openEditModal(product)}
                          className="px-2 py-1 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 text-[11px] font-medium"
                          title="View Saree Details"
                        >
                          View Details
                        </button>
                      )}
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
              {/* Auto Generate Mode Banner (Prompt: Auto generate option has to be enabled while adding the product. It can be disabled once the colour has been chosen and confirmed.) */}
              {!editingProduct && (
                <div
                  className={`p-3.5 rounded-2xl border transition-all ${
                    autoGenerateEnabled
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-950'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-xl ${autoGenerateEnabled ? 'bg-amber-500 text-neutral-950' : 'bg-neutral-200 text-neutral-500'}`}>
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs">
                            {autoGenerateEnabled ? 'Auto Generate Option: Enabled' : 'Auto Generate Option: Disabled'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              autoGenerateEnabled
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-neutral-200 text-neutral-700'
                            }`}
                          >
                            {autoGenerateEnabled ? 'Active on Add' : 'Locked'}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-600 mt-0.5">
                          {autoGenerateEnabled
                            ? 'Unique product code and handloom details are generated automatically. This can be disabled once the colour has been chosen and confirmed.'
                            : 'Auto generation has been disabled. Saree code and details are preserved.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoGenerateEnabled(!autoGenerateEnabled)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 ${
                        autoGenerateEnabled
                          ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 border-amber-600 font-bold shadow-2xs'
                          : 'bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-300'
                      }`}
                    >
                      {autoGenerateEnabled ? 'Disable Auto' : 'Enable Auto'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Unique Product Code Card */}
                <div className="sm:col-span-2 p-3.5 rounded-2xl bg-neutral-900 text-white border border-neutral-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-300 font-serif font-bold text-xs uppercase tracking-wider">
                        Unique Product Tracking Code (SKU) *
                      </span>
                      <span className="text-[10px] bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded-md font-semibold border border-emerald-700/60">
                        {editingProduct ? 'Immutable' : 'Guaranteed Unique'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => copySkuToClipboard(productCode)}
                      className="text-[11px] text-neutral-300 hover:text-white flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 rounded-lg border border-neutral-700 transition"
                      title="Copy Unique Code"
                    >
                      {copiedSku === productCode ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-mono text-base sm:text-lg font-bold tracking-wider text-amber-200 select-all">
                      {productCode}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {editingProduct
                        ? 'Permanently locked for this saree'
                        : isColorConfirmed
                        ? 'Confirmed & Locked for this colour'
                        : 'Auto-updating with colour selection'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Each product has a unique code to easily track the saree across inventory, customer receipts, and logistics.
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
                    onChange={(e) => {
                      const newFab = e.target.value as SareeFabric;
                      setFabric(newFab);
                      if (!editingProduct && !isColorConfirmed) {
                        const activeCol =
                          selectedColorOption === 'Other'
                            ? customColor.trim() || 'Custom Colour'
                            : selectedColorOption;
                        const key = activeCol.toLowerCase();
                        let newCode = assignedColorCodes[key];
                        if (!newCode) {
                          newCode = generateGuaranteedUniqueSku(newFab, activeCol);
                          setAssignedColorCodes((prev) => ({ ...prev, [key]: newCode }));
                        }
                        setProductCode(newCode);

                        if (autoGenerateEnabled) {
                          autoFillSareeDetails(newFab, activeCol);
                        }
                      }
                    }}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 font-medium"
                  >
                    {fabrics.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-neutral-700">Color Palette *</label>
                    {editingProduct ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        <Lock className="w-3 h-3 text-rose-700" />
                        <span>Colour Fixed (Immutable)</span>
                      </span>
                    ) : isColorConfirmed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Colour Confirmed</span>
                      </span>
                    ) : null}
                  </div>

                  {editingProduct ? (
                    <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-100/90 text-neutral-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-neutral-900">{editingProduct.color}</span>
                        <span className="text-[10px] text-neutral-500 font-mono">SKU #{editingProduct.productCode}</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 leading-relaxed pt-0.5">
                        The colour is permanently fixed for this saree. To offer this saree in another preferred colour, please add a new product.
                      </p>
                    </div>
                  ) : !isColorConfirmed ? (
                    <div className="space-y-2">
                      <select
                        value={selectedColorOption}
                        onChange={(e) => handleColorDropdownChange(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 font-medium"
                      >
                        {standardColors.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value="Other">+ Other (Manual / Custom Colour)</option>
                      </select>

                      {selectedColorOption === 'Other' && (
                        <div className="animate-in fade-in slide-in-from-top-1">
                          <input
                            type="text"
                            required
                            value={customColor}
                            onChange={(e) => handleCustomColorChange(e.target.value)}
                            placeholder="e.g. Peacock Teal, Coral Peach, Wine Purple"
                            className="w-full p-2 rounded-xl border border-amber-300 bg-amber-50/40 text-neutral-900 font-medium text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                          />
                        </div>
                      )}

                      {/* Explicit button to confirm colour and disable auto generation */}
                      <button
                        type="button"
                        onClick={handleConfirmColor}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Colour & Lock Unique Code</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50/70 text-emerald-950 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span className="font-bold text-xs">
                            Colour Confirmed: {selectedColorOption === 'Other' ? (customColor || 'Custom Colour') : selectedColorOption}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsColorConfirmed(false)}
                          className="text-[11px] font-semibold text-emerald-800 underline hover:text-emerald-950"
                        >
                          Change Colour
                        </button>
                      </div>
                      <p className="text-[11px] text-emerald-800/80">
                        Unique tracking code <span className="font-mono font-bold">#{productCode}</span> has been confirmed for this colour. Auto-generation has been disabled.
                      </p>
                    </div>
                  )}
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
              <div className="pt-4 border-t border-neutral-200 flex items-center justify-between gap-2.5">
                {editingProduct ? (
                  <button
                    type="button"
                    onClick={() => {
                      const prod = editingProduct;
                      setIsEditingModalOpen(false);
                      setProductToDelete(prod);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-700 hover:bg-rose-50 border border-rose-200 text-xs font-semibold transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Saree</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2.5">
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
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Saree Removal Confirmation Modal (User Request: products be removable from sarees section) */}
      {productToDelete && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Remove Saree from Catalog
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Permanently delete from boutique inventory
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProductToDelete(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-2xl border border-neutral-200">
                <img
                  src={productToDelete.images[0] || '/src/assets/images/hero_saree_atelier_1791651761357.jpg'}
                  alt={productToDelete.title}
                  className="w-14 h-16 object-cover rounded-xl bg-neutral-200 shrink-0 border border-neutral-300"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-serif font-bold text-sm text-neutral-900 truncate">
                    {productToDelete.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[10px] font-bold text-rose-950 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                      {productToDelete.productCode}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-medium">
                      {productToDelete.fabric} · {productToDelete.color}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-neutral-900 mt-1">
                    {formatPrice(productToDelete.price)}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>Confirm Permanent Removal</span>
                </p>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  Are you sure you want to remove this saree? It will be deleted from the boutique catalog, shopping bags, and inventory records. This action cannot be undone.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setProductToDelete(null)}
                  className="py-2.5 px-4 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-700 font-semibold transition text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteProduct(productToDelete.id);
                    setProductToDelete(null);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-rose-900/30"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Yes, Delete Saree</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
