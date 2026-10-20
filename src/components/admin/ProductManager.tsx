import React, { useState, useMemo } from 'react';
import { useStore, getBoutiqueOrderPrefix } from '../../context/StoreContext';
import { Product, SareeFabric, SareeColor, SareeCategory, ProductAttributeDefinition } from '../../types/store';
import { formatPrice } from '../../utils/upi';
import { compressImage } from '../../utils/imageCompress';
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
  ChevronRight,
  Package,
  ShoppingBag,
  ExternalLink,
  Layers,
  ArrowLeft,
  ArrowRight,
  FolderPlus,
  SlidersHorizontal,
  Settings2,
} from 'lucide-react';

export const ProductManager: React.FC = () => {
  const {
    products,
    orders,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductVisibility,
    currentPermissions,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    checkSkuUniqueInRegistry,
    toggleFabricOptional,
    settings,
  } = useStore();

  const [activeCategoryView, setActiveCategoryView] = useState<SareeCategory | null>(null);
  const [showAllSareesFlat, setShowAllSareesFlat] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<SareeCategory | null>(null);
  const [categoryToEdit, setCategoryToEdit] = useState<SareeCategory | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [editCatImg, setEditCatImg] = useState('');
  const [isEditCatImgUploading, setIsEditCatImgUploading] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [catActionError, setCatActionError] = useState<string | null>(null);

  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [selectedInventoryProduct, setSelectedInventoryProduct] = useState<Product | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  // Product-Specific Specifications / Custom Attributes State
  const [productSpecificAttributes, setProductSpecificAttributes] = useState<ProductAttributeDefinition[]>([]);
  const [customAttributesValues, setCustomAttributesValues] = useState<Record<string, string>>({});
  const [isAttributesManagerOpen, setIsAttributesManagerOpen] = useState(false);
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrPlaceholder, setNewAttrPlaceholder] = useState('');
  const [newAttrIsOptional, setNewAttrIsOptional] = useState(true);
  const [editingAttrId, setEditingAttrId] = useState<string | null>(null);
  const [editingAttrName, setEditingAttrName] = useState('');
  const [editingAttrPlaceholder, setEditingAttrPlaceholder] = useState('');
  const [editingAttrIsOptional, setEditingAttrIsOptional] = useState(true);

  // Orders linked to the clicked saree inventory (User Request 6)
  const matchingInventoryOrders = useMemo(() => {
    if (!selectedInventoryProduct) return [];
    return orders.filter((ord) =>
      ord.items.some(
        (it) =>
          it.product.id === selectedInventoryProduct.id ||
          it.product.productCode.trim().toUpperCase() === selectedInventoryProduct.productCode.trim().toUpperCase()
      )
    );
  }, [orders, selectedInventoryProduct]);

  // Auto Generate & Confirmation States (Prompt: Auto generate enabled on add, can be disabled once colour confirmed)
  const [autoGenerateEnabled, setAutoGenerateEnabled] = useState(true);
  const [isColorConfirmed, setIsColorConfirmed] = useState(false);

  // Form Fields
  const [productCode, setProductCode] = useState('');
  const [skuCodeSuffix, setSkuCodeSuffix] = useState('101');
  const [skuError, setSkuError] = useState<string | null>(null);
  const [isEditingSku, setIsEditingSku] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [fabric, setFabric] = useState<SareeFabric>('Kanjivaram Silk');
  const [customFabric, setCustomFabric] = useState('');
  const [selectedColorOption, setSelectedColorOption] = useState<string>('Crimson Red');
  const [customColor, setCustomColor] = useState('');
  // Category state & category management modal
  const [category, setCategory] = useState<string>('Heirloom Sarees');
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatImg, setNewCatImg] = useState('');
  const [isCatImgUploading, setIsCatImgUploading] = useState(false);
  const [isProductImgUploading, setIsProductImgUploading] = useState(false);

  // Requirement 4: Category & Product Image Persistence Bug Fix
  // Uses client-side canvas compression so high-res phone camera uploads fit strictly within Firestore document limits
  const handleCatImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCatImgUploading(true);
    setCatActionError(null);
    try {
      const compressed = await compressImage(file, 900, 900, 0.78);
      setNewCatImg(compressed);
    } catch (err) {
      console.error('Failed to compress category image:', err);
      setCatActionError('Failed to process image file. Please try another image.');
    } finally {
      setIsCatImgUploading(false);
    }
  };

  const handleEditCatImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsEditCatImgUploading(true);
    setCatActionError(null);
    try {
      const compressed = await compressImage(file, 900, 900, 0.78);
      setEditCatImg(compressed);
    } catch (err) {
      console.error('Failed to compress category image:', err);
      setCatActionError('Failed to process image file. Please try another image.');
    } finally {
      setIsEditCatImgUploading(false);
    }
  };

  const openEditCategoryModal = (cat: SareeCategory) => {
    setCategoryToEdit(cat);
    setEditCatName(cat.name);
    setEditCatDesc(cat.description || '');
    setEditCatImg(cat.imageUrl || '');
    setCatActionError(null);
  };

  const handleSaveEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryToEdit || !editCatName.trim()) {
      setCatActionError('Please enter a category name');
      return;
    }
    setCatActionError(null);
    try {
      await updateCategory(categoryToEdit.id, {
        name: editCatName.trim(),
        description: editCatDesc.trim() || undefined,
        imageUrl: editCatImg.trim() || categoryToEdit.imageUrl,
      });
      if (activeCategoryView?.id === categoryToEdit.id) {
        setActiveCategoryView({
          ...categoryToEdit,
          name: editCatName.trim(),
          description: editCatDesc.trim() || undefined,
          imageUrl: editCatImg.trim() || categoryToEdit.imageUrl,
        });
      }
      setCategoryToEdit(null);
    } catch (err: any) {
      setCatActionError(err?.message || 'Failed to update category');
    }
  };

  // Requirement 6: Standardized SKU Generation Formula: "Store name - Category - ProductName - Colour"
  const formatSkuKeyword = (text: string, defaultCode = 'GEN'): string => {
    if (!text || !text.trim()) return defaultCode;
    const clean = text.trim().replace(/[^a-zA-Z0-9\s]/g, '');
    const lower = clean.toLowerCase();

    // Specific apparel keyword mapping from standardized formula requirements
    if (lower.startsWith('blouse')) return 'BLU';
    if (lower.startsWith('silk')) return 'SIL';
    if (lower.startsWith('pink')) return 'PIN';

    const firstWord = clean.split(/\s+/)[0] || clean;
    const letters = firstWord.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return letters.length >= 3 ? letters.slice(0, 3) : letters.padEnd(3, 'X');
  };

  const effectiveColor = useMemo(() => {
    return selectedColorOption === 'Other'
      ? (customColor.trim() || 'Custom')
      : (selectedColorOption || 'Colour');
  }, [selectedColorOption, customColor]);

  const autoSkuPrefix = useMemo(() => {
    const storeKeyword = getBoutiqueOrderPrefix(settings.boutiqueName);
    const catCode = formatSkuKeyword(category || categories[0]?.name || 'Category', 'CAT');
    const prodCode = formatSkuKeyword(title || 'Product', 'PRO');
    const colCode = formatSkuKeyword(effectiveColor || 'Colour', 'COL');
    return `${storeKeyword}-${catCode}-${prodCode}-${colCode}`;
  }, [settings.boutiqueName, category, categories, title, effectiveColor]);

  const [price, setPrice] = useState<number>(25000);
  const [originalPrice, setOriginalPrice] = useState<number>(30000);
  const [stockStatus, setStockStatus] = useState<'in_stock' | 'out_of_stock' | 'limited'>('in_stock');
  const [stockCount, setStockCount] = useState<number>(5);
  const [isVisible, setIsVisible] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [instagramShortsUrl, setInstagramShortsUrl] = useState('');
  const [weaveDetails, setWeaveDetails] = useState('');
  const [borderType, setBorderType] = useState('');
  const [blousePieceIncluded, setBlousePieceIncluded] = useState(true);
  const [lengthMeters, setLengthMeters] = useState(6.3);
  const [occasion, setOccasion] = useState('Bridal & Wedding');

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

  const fabrics: (SareeFabric | 'Other')[] = [
    'Kanjivaram Silk',
    'Banarasi Brocade',
    'Chanderi Tissue',
    'Organza Silk',
    'Pure Georgette',
    'Tussar Handloom',
    'Cotton Silk',
    'Other',
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

  // Strict Database Duplicate SKU Prevention across all products and centralized SKU database registry
  const checkSkuInDatabase = (code: string, currentEditingId?: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return null;
    const res = checkSkuUniqueInRegistry(clean, currentEditingId);
    if (!res.isUnique) {
      return (
        res.error ||
        `Duplicate SKU Error: "${clean}" is already assigned to saree "${res.conflictingProduct || 'another product'}". Duplicate SKUs are prevented across the database. Please enter a different, unique SKU code. (Your one-time edit option is preserved until you submit a unique code).`
      );
    }
    return null;
  };

  const handleProductCodeChange = (typed: string) => {
    setProductCode(typed);
    const err = checkSkuInDatabase(typed, editingProduct?.id);
    setSkuError(err);
  };

  const handleSkuSuffixChange = (typedSuffix: string) => {
    setSkuCodeSuffix(typedSuffix);
    const candidate = `${autoSkuPrefix}-${typedSuffix.trim()}`.toUpperCase();
    setProductCode(candidate);
    const err = checkSkuInDatabase(candidate, editingProduct?.id);
    setSkuError(err);
  };

  const openAddModal = (presetCategory?: string) => {
    setEditingProduct(null);
    setIsEditingSku(true);
    setAutoGenerateEnabled(false);
    setIsColorConfirmed(false);
    setSkuError(null);
    const initialFabric: SareeFabric = 'Kanjivaram Silk';
    const initialColor = 'Crimson Red';
    const initialSuffix = String(Math.floor(100 + Math.random() * 900));
    setSkuCodeSuffix(initialSuffix);
    setProductCode('');
    const targetCat =
      presetCategory ||
      (activeCategoryView ? activeCategoryView.name : categories[0]?.name || 'Heirloom Sarees');
    setCategory(targetCat);
    setFabric(initialFabric);
    setCustomFabric('');
    setSelectedColorOption(initialColor);
    setCustomColor('');
    autoFillSareeDetails(initialFabric, initialColor);
    setStockStatus('in_stock');
    setStockCount(3);
    setIsVisible(true);
    setImages([]);
    setImageUrlInput('');
    setVideoUrl('https://www.youtube.com/watch?v=0hW73jL76bY');
    setInstagramShortsUrl('');
    setBlousePieceIncluded(true);
    setLengthMeters(6.3);
    setOccasion('Wedding & Reception');

    // Initialize product-specific specification fields
    const initialFields: ProductAttributeDefinition[] = [
      { id: 'attr-weave', name: 'Weave Technique', placeholder: 'e.g. Traditional Korvai Handloom', isOptional: true },
      { id: 'attr-border', name: 'Border & Pallu Detail', placeholder: 'e.g. Heavy Zari Contrast Border', isOptional: true },
      { id: 'attr-blouse', name: 'Blouse Piece', placeholder: 'e.g. Included (0.8m Running Silk)', isOptional: true },
      { id: 'attr-length', name: 'Total Length', placeholder: 'e.g. 6.3 Meters', isOptional: true },
      { id: 'attr-occasion', name: 'Recommended Occasion', placeholder: 'e.g. Bridal & Festive', isOptional: true },
    ];
    setProductSpecificAttributes(initialFields);
    const initialAttrs: Record<string, string> = {
      'attr-weave': 'Traditional Korvai Handloom Weave',
      'attr-border': 'Pure Gold Zari Contrast Pallu',
      'attr-blouse': 'Included (0.8m Running Silk)',
      'attr-length': '6.3 Meters',
      'attr-occasion': 'Wedding & Reception',
    };
    setCustomAttributesValues(initialAttrs);
    setIsEditingModalOpen(true);
  };

  // Product-Specific Dynamic Specification Field Handlers (Unique to each product)
  const handleAddProductSpecificAttribute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttrName.trim()) return;
    const newId = `attr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newAttr: ProductAttributeDefinition = {
      id: newId,
      name: newAttrName.trim(),
      placeholder: newAttrPlaceholder.trim() || undefined,
      isOptional: newAttrIsOptional,
    };
    setProductSpecificAttributes((prev) => [...prev, newAttr]);
    setCustomAttributesValues((prev) => ({ ...prev, [newId]: '' }));
    setNewAttrName('');
    setNewAttrPlaceholder('');
    setNewAttrIsOptional(true);
  };

  const handleStartEditAttribute = (attr: { id: string; name: string; placeholder?: string; isOptional?: boolean }) => {
    setEditingAttrId(attr.id);
    setEditingAttrName(attr.name);
    setEditingAttrPlaceholder(attr.placeholder || '');
    setEditingAttrIsOptional(attr.isOptional !== false);
  };

  const handleSaveEditProductSpecificAttribute = (id: string) => {
    if (!editingAttrName.trim()) return;
    setProductSpecificAttributes((prev) =>
      prev.map((attr) =>
        attr.id === id
          ? {
              ...attr,
              name: editingAttrName.trim(),
              placeholder: editingAttrPlaceholder.trim() || undefined,
              isOptional: editingAttrIsOptional,
            }
          : attr
      )
    );
    setEditingAttrId(null);
  };

  const handleDeleteProductSpecificAttribute = (id: string) => {
    setProductSpecificAttributes((prev) => prev.filter((attr) => attr.id !== id));
    setCustomAttributesValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Dynamic Category Creation and Real-Time Deletion
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      setCatActionError('Please enter a category name');
      return;
    }
    setCatActionError(null);
    try {
      const created = await addCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim() || undefined,
        imageUrl: newCatImg.trim() || '/assets/images/hero_saree_atelier_1791651761357.jpg',
      });
      setNewCatName('');
      setNewCatDesc('');
      setNewCatImg('');
      setIsAddCategoryOpen(false);
      // Automatically enter the newly created category so admin can directly add sarees inside!
      setActiveCategoryView(created);
    } catch (err: any) {
      setCatActionError(err?.message || 'Failed to create category');
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      await deleteCategory(categoryToDelete.id);
      if (activeCategoryView?.id === categoryToDelete.id) {
        setActiveCategoryView(null);
      }
      setCategoryToDelete(null);
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setIsEditingSku(false);
    setAutoGenerateEnabled(false);
    setIsColorConfirmed(true);
    setSkuError(null);
    setCategory(prod.category || categories[0]?.name || 'Heirloom Sarees');

    const isStandardColor = standardColors.includes(prod.color as any);
    if (isStandardColor) {
      setSelectedColorOption(prod.color);
      setCustomColor('');
    } else {
      setSelectedColorOption('Other');
      setCustomColor(prod.color);
    }

    const standardFabricsList = [
      'Kanjivaram Silk',
      'Banarasi Brocade',
      'Chanderi Tissue',
      'Organza Silk',
      'Pure Georgette',
      'Tussar Handloom',
      'Cotton Silk',
    ];

    if (prod.fabric && standardFabricsList.includes(prod.fabric)) {
      setFabric(prod.fabric);
      setCustomFabric('');
    } else if (prod.fabric) {
      setFabric('Other');
      setCustomFabric(prod.fabric);
    } else {
      setFabric(standardFabricsList[0] as SareeFabric);
      setCustomFabric('');
    }

    setProductCode(prod.productCode);
    const skuParts = (prod.productCode || '').split(' - ');
    if (skuParts.length > 1) {
      setSkuCodeSuffix(skuParts[skuParts.length - 1]);
    } else {
      setSkuCodeSuffix((prod.productCode || '').slice(-4) || '101');
    }
    setTitle(prod.title);
    setSubtitle(prod.subtitle || '');
    setDescription(prod.description);
    setPrice(prod.price);
    setOriginalPrice(prod.originalPrice || prod.price);
    setStockStatus(prod.stockStatus);
    setStockCount(prod.stockCount);
    setIsVisible(prod.isVisible);
    setImages(prod.images || []);
    setImageUrlInput('');
    setVideoUrl(prod.videoUrl || '');
    setInstagramShortsUrl(prod.instagramShortsUrl || '');
    setWeaveDetails(prod.weaveDetails || '');
    setBorderType(prod.borderType || '');
    setBlousePieceIncluded(Boolean(prod.blousePieceIncluded));
    setLengthMeters(prod.lengthMeters || 6.3);
    setOccasion(prod.occasion || 'Festive');

    // Populate product-specific specification fields
    let initialFields: ProductAttributeDefinition[] = [];
    if (prod.specificationFields && prod.specificationFields.length > 0) {
      initialFields = prod.specificationFields.map((f) => ({ ...f }));
    } else if (prod.customAttributes && Object.keys(prod.customAttributes).length > 0) {
      initialFields = Object.keys(prod.customAttributes).map((key) => {
        const cleanName = key.startsWith('attr-')
          ? key.replace('attr-', '').replace(/([A-Z])/g, ' $1').trim()
          : key;
        return {
          id: key,
          name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
          isOptional: true,
        };
      });
    } else {
      initialFields = [
        { id: 'attr-weave', name: 'Weave Technique', placeholder: 'e.g. Traditional Korvai Handloom', isOptional: true },
        { id: 'attr-border', name: 'Border & Pallu Detail', placeholder: 'e.g. Heavy Zari Contrast Border', isOptional: true },
        { id: 'attr-blouse', name: 'Blouse Piece', placeholder: 'e.g. Included (0.8m Running Silk)', isOptional: true },
        { id: 'attr-length', name: 'Total Length', placeholder: 'e.g. 6.3 Meters', isOptional: true },
        { id: 'attr-occasion', name: 'Recommended Occasion', placeholder: 'e.g. Bridal & Festive', isOptional: true },
      ];
    }
    setProductSpecificAttributes(initialFields);

    // Populate dynamic specifications values from customAttributes & legacy fields
    const initialAttrs: Record<string, string> = { ...(prod.customAttributes || {}) };
    if (prod.weaveDetails && !initialAttrs['attr-weave']) initialAttrs['attr-weave'] = prod.weaveDetails;
    if (prod.borderType && !initialAttrs['attr-border']) initialAttrs['attr-border'] = prod.borderType;
    if (prod.occasion && !initialAttrs['attr-occasion']) initialAttrs['attr-occasion'] = prod.occasion;
    if (prod.lengthMeters && !initialAttrs['attr-length']) initialAttrs['attr-length'] = String(prod.lengthMeters);
    if (prod.blousePieceIncluded !== undefined && !initialAttrs['attr-blouse']) {
      initialAttrs['attr-blouse'] = prod.blousePieceIncluded ? 'Included (0.8m Running Silk)' : 'Not Included';
    }
    setCustomAttributesValues(initialAttrs);
    setIsEditingModalOpen(true);
  };

  const handleConfirmColor = () => {
    setIsColorConfirmed(true);
    setAutoGenerateEnabled(false);
  };

  const handleColorDropdownChange = (val: string) => {
    setSelectedColorOption(val);
  };

  const handleCustomColorChange = (typed: string) => {
    setCustomColor(typed);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProductImgUploading(true);
      try {
        const compressed = await compressImage(file, 1200, 1200, 0.75);
        setImages((prev) => [...prev, compressed]);
      } catch (err) {
        console.error('Failed to compress product image:', err);
      } finally {
        setIsProductImgUploading(false);
      }
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Requirement 6: Standardized SKU Formula "Category - ProductName - Colour - Code"
    const isSkuPermanentlyLocked = Boolean(
      editingProduct && (editingProduct.isSkuLocked || (editingProduct.skuEditCount || 0) >= 1)
    );

    const generatedSku = `${autoSkuPrefix}-${(skuCodeSuffix || '101').trim()}`.toUpperCase();
    const finalSku = editingProduct
      ? (isSkuPermanentlyLocked ? editingProduct.productCode : (productCode.trim().toUpperCase() || generatedSku))
      : generatedSku;

    if (!finalSku) {
      setSkuError('Please enter a unique product code (SKU) for this saree.');
      return;
    }

    // Duplicate SKU Prevention check across database
    const existingError = checkSkuInDatabase(finalSku, editingProduct?.id);
    if (existingError) {
      setSkuError(existingError);
      return;
    }

    // Check one-time edit lock
    const isSkuChanged = Boolean(
      editingProduct && editingProduct.productCode.trim().toUpperCase() !== finalSku
    );

    if (editingProduct && isSkuChanged && isSkuPermanentlyLocked) {
      setSkuError('This SKU is permanently locked and cannot be edited again.');
      return;
    }

    let finalFabric: string | undefined = undefined;
    if (fabric === 'Other') {
      finalFabric = customFabric.trim() || undefined;
    } else if (fabric && fabric !== 'None') {
      finalFabric = fabric;
    }

    if (!settings.isFabricOptional && !finalFabric) {
      setSkuError('Please select or specify a Fabric Type for this product.');
      return;
    }

    // Check required dynamic product-specific attributes
    for (const attr of productSpecificAttributes) {
      if (!attr.isOptional) {
        const val = customAttributesValues[attr.id] || customAttributesValues[attr.name];
        if (!val || !val.trim()) {
          setSkuError(`Please enter required specification field: "${attr.name}"`);
          return;
        }
      }
    }

    const finalColor = selectedColorOption === 'Other'
      ? (customColor.trim() || 'Custom Colour')
      : (selectedColorOption || (editingProduct ? editingProduct.color : 'Crimson Red'));

    const finalCount = Number(stockCount);
    const finalStatus: 'in_stock' | 'limited' | 'out_of_stock' =
      finalCount <= 0
        ? 'out_of_stock'
        : finalCount <= 5
        ? 'limited'
        : 'in_stock';

    const finalWeave = customAttributesValues['attr-weave'] || customAttributesValues['Weave Technique'] || weaveDetails;
    const finalBorder = customAttributesValues['attr-border'] || customAttributesValues['Border & Pallu Detail'] || borderType;
    const finalOccasion = customAttributesValues['attr-occasion'] || customAttributesValues['Recommended Occasion'] || customAttributesValues['Occasion'] || occasion;
    const rawLength = customAttributesValues['attr-length'] || customAttributesValues['Total Length'] || customAttributesValues['Length (Meters)'] || lengthMeters;
    const finalLength = Number(rawLength);

    const payload: any = {
      productCode: finalSku,
      category: category.trim() || categories[0]?.name || 'Heirloom Sarees',
      title: title.trim(),
      subtitle: subtitle.trim(),
      description: description.trim(),
      fabric: finalFabric as SareeFabric | undefined,
      color: finalColor as SareeColor,
      price: Number(price),
      originalPrice: Number(originalPrice) || undefined,
      stockStatus: finalStatus,
      stockCount: finalCount,
      isVisible,
      images: images.length > 0 ? images : ['/assets/images/hero_saree_atelier_1791651761357.jpg'],
      videoUrl: videoUrl.trim() || undefined,
      instagramShortsUrl: instagramShortsUrl.trim() || undefined,
      weaveDetails: finalWeave ? finalWeave.trim() : undefined,
      borderType: finalBorder ? finalBorder.trim() : undefined,
      blousePieceIncluded,
      lengthMeters: !isNaN(finalLength) ? finalLength : undefined,
      occasion: finalOccasion ? finalOccasion.trim() : undefined,
      specificationFields: productSpecificAttributes,
      customAttributes: customAttributesValues,
    };

    if (editingProduct) {
      // If SKU was edited this one time, permanently lock it
      if (isSkuChanged && !isSkuPermanentlyLocked) {
        payload.skuEditCount = (editingProduct.skuEditCount || 0) + 1;
        payload.isSkuLocked = true;
      }
      updateProduct(editingProduct.id, payload);
    } else {
      payload.initialSku = finalSku;
      payload.skuEditCount = 0;
      payload.isSkuLocked = false;
      addProduct(payload);
    }

    setIsEditingModalOpen(false);
  };

  const canEditProducts = currentPermissions?.products?.canEdit !== false;

  const LOW_STOCK_THRESHOLD = 5;

  // Identify low stock and out-of-stock items to notify admins and staff
  // When stock is added above threshold (> 5 pieces), alerts correctly clear and disappear for ALL products (including the 6th product and beyond)
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.isVisible === false) return false;
      const rawCount = p.stockCount !== undefined && p.stockCount !== null ? Number(p.stockCount) : 0;
      const count = isNaN(rawCount) ? 0 : Math.max(0, Math.floor(rawCount));
      // If stock is above threshold (e.g. above 5 pieces), it is NEVER low stock
      if (count > LOW_STOCK_THRESHOLD) return false;
      return count > 0 && count <= LOW_STOCK_THRESHOLD;
    });
  }, [products]);

  const outOfStockProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.isVisible === false) return false;
      const rawCount = p.stockCount !== undefined && p.stockCount !== null ? Number(p.stockCount) : 0;
      const count = isNaN(rawCount) ? 0 : Math.max(0, Math.floor(rawCount));
      return count <= 0;
    });
  }, [products]);

  const currentCategoryProducts = useMemo(() => {
    if (!activeCategoryView) return products;
    return products.filter(
      (p) =>
        p.category?.toLowerCase() === activeCategoryView.name.toLowerCase() ||
        p.fabric?.toLowerCase() === activeCategoryView.name.toLowerCase()
    );
  }, [products, activeCategoryView]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [products]);

  const displayedProducts = showAllSareesFlat ? products : currentCategoryProducts;

  const filteredProducts = useMemo(() => {
    if (!tableSearchQuery.trim()) return displayedProducts;
    const q = tableSearchQuery.toLowerCase().trim();
    return displayedProducts.filter(
      (p) =>
        p.productCode.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        (p.fabric && p.fabric.toLowerCase().includes(q)) ||
        p.color.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [displayedProducts, tableSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Low Stock & Out of Stock Alert Banner for Staff & Admin */}
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50/80 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-900">
                <AlertCircle className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 font-serif">
                  Stock Replenishment Alert ({lowStockProducts.length + outOfStockProducts.length} Sarees Need Attention)
                </h3>
                <p className="text-[11px] text-neutral-600">
                  Notify staff and admins: replenish inventory so patrons can place orders. Restocking will automatically announce availability on the public store front.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
            {outOfStockProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/90 border border-rose-200 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0"></span>
                  <div className="truncate">
                    <p className="font-bold text-neutral-900 truncate">{p.title}</p>
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-rose-700">
                      <span className="font-semibold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-300">
                        Category: {p.category || 'General'}
                      </span>
                      <span className="font-mono">{p.productCode}</span>
                      <span>·</span>
                      <span className="font-bold">OUT OF STOCK (0 units)</span>
                    </div>
                  </div>
                </div>
                {canEditProducts && (
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateProduct(p.id, {
                          stockCount: 10,
                          stockStatus: 'in_stock',
                        });
                      }}
                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition shadow-2xs"
                      title="Instantly set stock to 10 units (above threshold) and clear alert"
                    >
                      +10 In Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] transition"
                    >
                      Restock Now
                    </button>
                  </div>
                )}
              </div>
            ))}

            {lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/90 border border-amber-200 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                  <div className="truncate">
                    <p className="font-bold text-neutral-900 truncate">{p.title}</p>
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-amber-800">
                      <span className="font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                        Category: {p.category || 'General'}
                      </span>
                      <span className="font-mono">{p.productCode}</span>
                      <span>·</span>
                      <span className="font-semibold">Low Stock: {p.stockCount} left</span>
                    </div>
                  </div>
                </div>
                {canEditProducts && (
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateProduct(p.id, {
                          stockCount: (p.stockCount || 0) + 10,
                          stockStatus: 'in_stock',
                        });
                      }}
                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition shadow-2xs"
                      title="Instantly add +10 units (bumping above threshold) to clear alert"
                    >
                      +10 Units
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] transition"
                    >
                      Restock
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Hierarchical Workflow Top Bar: Step 1 (Categories) vs Step 2 (Inside Category) vs Flat View */}
      {!showAllSareesFlat && !activeCategoryView ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-amber-700 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Hierarchical Category-First Workflow</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Step 1: Choose or Create Category
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900">
                Saree Categories & Collections
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                First select or create a category, then click to enter inside that specific category and add products directly.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowAllSareesFlat(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold shadow-2xs transition cursor-pointer"
                title="Browse all sarees across all categories in a flat list"
              >
                <Package className="w-4 h-4 text-neutral-600" />
                <span>Flat Inventory ({products.length})</span>
              </button>


              {canEditProducts && (
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4 text-amber-300" />
                  <span>+ Create Category</span>
                </button>
              )}
            </div>
          </div>

          {/* Categories Grid */}
          {categories.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-neutral-300 p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
                <Layers className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="font-serif font-bold text-lg text-neutral-900">
                  No Categories Created Yet
                </h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  To follow the hierarchical workflow, create a category first (e.g. Poontamil Sarees, Foil Print Sarees, Banarasi Brocades), then click to enter inside it and add products directly.
                </p>
              </div>
              {canEditProducts && (
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4 text-amber-300" />
                  <span>Create First Category</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {categories.map((cat) => {
                const count = categoryCounts[cat.name] || 0;
                return (
                  <div
                    key={cat.id}
                    onClick={() => setActiveCategoryView(cat)}
                    className="group bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-2xs hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between border-t-4 border-t-amber-500 hover:border-t-rose-800"
                  >
                    <div className="relative aspect-16/9 sm:aspect-4/3 w-full overflow-hidden bg-neutral-100">
                      <img
                        src={cat.imageUrl || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                        alt={cat.name}
                        className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        <span className="bg-white/95 backdrop-blur-xs text-neutral-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                          {count} {count === 1 ? 'Saree' : 'Sarees'}
                        </span>
                        {canEditProducts && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditCategoryModal(cat);
                              }}
                              className="p-1 rounded-full bg-black/60 hover:bg-amber-600 text-white transition cursor-pointer"
                              title="Edit category details & photo"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCategoryToDelete(cat);
                              }}
                              className="p-1 rounded-full bg-black/60 hover:bg-rose-600 text-white transition cursor-pointer"
                              title="Remove category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300">
                          Category Collection
                        </span>
                        <h3 className="font-serif font-bold text-lg sm:text-xl text-white group-hover:text-amber-200 transition">
                          {cat.name}
                        </h3>
                      </div>
                    </div>

                    <div className="p-3.5 bg-white flex items-center justify-between text-xs border-t border-neutral-100 gap-2">
                      <p className="text-neutral-500 line-clamp-1 text-[11px] flex-1">
                        {cat.description || 'Curated pure handloom collection.'}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {canEditProducts && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCategoryView(cat);
                              openAddModal(cat.name);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-semibold transition cursor-pointer"
                            title={`Add product directly inside ${cat.name}`}
                          >
                            <Plus className="w-3 h-3 text-amber-600" />
                            <span>Add Product</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveCategoryView(cat)}
                          className="px-3 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <span>Enter</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeCategoryView ? (
        /* Active Category Header with Breadcrumb & Direct Add Button */
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCategoryView(null)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-rose-900 hover:text-rose-700 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>All Categories</span>
                </button>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-semibold text-neutral-600 truncate">
                  {activeCategoryView.name}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 flex items-center gap-2 flex-wrap">
                <span>{activeCategoryView.name}</span>
                <span className="text-xs font-sans font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  {currentCategoryProducts.length} {currentCategoryProducts.length === 1 ? 'Saree' : 'Sarees'} inside
                </span>
              </h2>
              <p className="text-xs text-neutral-500">
                {activeCategoryView.description || 'Products added below are filed directly inside this category.'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveCategoryView(null)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold transition cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-amber-600" />
                <span>Back to Categories</span>
              </button>

              {canEditProducts && (
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(activeCategoryView)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Category</span>
                </button>
              )}

              {canEditProducts && (
                <button
                  type="button"
                  onClick={() => openAddModal(activeCategoryView.name)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                  title={`Add Product inside ${activeCategoryView.name}`}
                >
                  <Plus className="w-4 h-4 text-amber-300" />
                  <span>Add Product</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Flat Saree Inventory Header */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => setShowAllSareesFlat(false)}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-900 mb-1 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Switch to Category-First Workflow</span>
            </button>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900">
              Saree Catalog & Inventory (Flat View)
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Total {products.length} sarees · {products.filter((p) => p.isVisible).length} visible on storefront
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsAddCategoryOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold shadow-2xs transition cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-amber-600" />
              <span>+ Create Category</span>
            </button>

            {canEditProducts && (
              <button
                onClick={() => openAddModal()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search & Saree Inventory Table - only shown inside a category or when viewing flat inventory */}
      {(activeCategoryView || showAllSareesFlat) && (
        <>
          {/* Search & Filter Bar */}
          <div className="bg-white p-3 rounded-2xl border border-neutral-200 shadow-xs flex items-center gap-2.5">
            <Search className="w-4 h-4 text-neutral-400 shrink-0 ml-1" />
            <input
              type="text"
              value={tableSearchQuery}
              onChange={(e) => setTableSearchQuery(e.target.value)}
              placeholder={
                activeCategoryView
                  ? `Search sarees within ${activeCategoryView.name}...`
                  : 'Search by Unique SKU Code (e.g. AARA-KAN-CRIM-101) or Name...'
              }
              className="flex-1 bg-transparent text-xs text-neutral-900 focus:outline-hidden"
            />
            {tableSearchQuery && (
              <button
                onClick={() => setTableSearchQuery('')}
                className="text-[11px] text-neutral-400 hover:text-neutral-700 px-2 py-0.5 rounded cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Saree Inventory Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
            {filteredProducts.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center">
                  <Package className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-base text-neutral-900">
                  {activeCategoryView
                    ? `No sarees inside "${activeCategoryView.name}" yet`
                    : 'No sarees matching your search'}
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {activeCategoryView
                    ? `Click below to add your first handcrafted saree directly into ${activeCategoryView.name}.`
                    : 'Try searching with a different SKU code, fabric, or saree title.'}
                </p>
                {activeCategoryView && canEditProducts && (
                  <button
                    type="button"
                    onClick={() => openAddModal(activeCategoryView.name)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition cursor-pointer"
                    title={`Add Product inside ${activeCategoryView.name}`}
                  >
                    <Plus className="w-4 h-4 text-amber-300" />
                    <span>Add Product</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Responsive Mobile & Tablet Card Grid (User Request 3) */}
                <div className="md:hidden divide-y divide-neutral-100 p-2 sm:p-3 space-y-3">
                  {filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => openEditModal(product)}
              className="bg-neutral-50/70 hover:bg-neutral-100/80 rounded-2xl p-3 border border-neutral-200/80 transition cursor-pointer flex flex-col justify-between space-y-2.5 active:scale-99"
              title="Tap anywhere to edit this saree"
            >
              <div className="flex gap-3">
                <img
                  src={product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                  alt={product.title}
                  className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded-xl bg-neutral-100 border border-neutral-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-mono text-[10px] sm:text-xs font-bold text-rose-950 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 truncate">
                      {product.productCode}
                    </span>
                    <span className="text-[10px] text-amber-700 font-bold flex items-center gap-0.5 shrink-0">
                      <span>Edit</span>
                      <Edit2 className="w-3 h-3" />
                    </span>
                  </div>
                  <h4 className="font-serif font-bold text-xs sm:text-sm text-neutral-900 truncate">
                    {product.title}
                  </h4>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    {product.fabric} · {product.color}
                  </p>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-bold text-sm text-neutral-900 tabular-nums">
                      {formatPrice(product.price)}
                    </span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="text-[10px] text-neutral-400 line-through tabular-nums">
                        MRP {formatPrice(product.originalPrice)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer Controls */}
              <div
                className="pt-2 border-t border-neutral-200/80 flex items-center justify-between text-xs flex-wrap gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Stock count button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedInventoryProduct(product);
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer ${
                    product.stockStatus === 'in_stock'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : product.stockStatus === 'limited'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}
                  title="Click to see orders for this saree"
                >
                  Stock: {product.stockCount}
                </button>

                {/* Visibility Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canEditProducts) toggleProductVisibility(product.id);
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 cursor-pointer ${
                    product.isVisible
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-neutral-100 text-neutral-500 border-neutral-300'
                  }`}
                >
                  {product.isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>{product.isVisible ? 'Visible' : 'Hidden'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop & Tablet Table View - Full Screen Responsive & Horizontal Scroll Eliminated */}
        <div className="hidden md:block w-full max-w-full overflow-hidden">
          <table className="w-full text-left text-xs table-fixed">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[27%]" />
              <col className="w-[17%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
            </colgroup>
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-3">Unique Code / SKU</th>
                <th className="py-3 px-3">Saree</th>
                <th className="py-3 px-3">Category & Fabric</th>
                <th className="py-3 px-3">Price</th>
                <th className="py-3 px-3">Stock</th>
                <th className="py-3 px-2 text-center">Storefront</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  onClick={() => openEditModal(product)}
                  className="hover:bg-neutral-50/80 transition cursor-pointer group"
                  title="Click anywhere on this saree row to edit details"
                >
                  {/* SKU Unique Code */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <span className="font-mono text-xs font-bold text-rose-950 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200 truncate">
                        {product.productCode}
                      </span>
                      {product.isSkuLocked && (
                        <span title="SKU permanently locked after one edit" className="text-amber-700 shrink-0">
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copySkuToClipboard(product.productCode);
                        }}
                        className="p-1 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition shrink-0"
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
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                        alt={product.title}
                        className="w-10 h-12 object-cover rounded-lg bg-neutral-100 border border-neutral-200 shrink-0 group-hover:scale-102 transition"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-serif font-bold text-xs sm:text-sm text-neutral-900 group-hover:text-amber-800 transition truncate">
                          {product.title}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 mt-0.5">
                          {product.videoUrl && (
                            <span className="flex items-center gap-0.5 text-rose-800 font-semibold shrink-0">
                              <Video className="w-2.5 h-2.5" />
                              <span>Video</span>
                            </span>
                          )}
                          <span className="truncate">{product.images.length} photos</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Category, Fabric & Color */}
                  <td className="py-3 px-3">
                    <div className="min-w-0">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200 truncate max-w-full">
                        {product.category || 'General Collection'}
                      </span>
                      <p className="font-semibold text-neutral-800 text-xs truncate mt-0.5">{product.fabric}</p>
                      <p className="text-neutral-500 text-[10px] truncate">{product.color}</p>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="py-3 px-3">
                    <p className="font-bold text-neutral-900 tabular-nums">{formatPrice(product.price)}</p>
                    {product.originalPrice && product.originalPrice > product.price ? (
                      <div className="mt-0.5 flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-neutral-400 line-through tabular-nums">
                          {formatPrice(product.originalPrice)}
                        </span>
                        <span className="inline-block text-[9px] font-bold px-1 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-200">
                          {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                        </span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-neutral-400">At MRP</p>
                    )}
                  </td>

                  {/* Stock - Clickable to see orders (User Request 6) */}
                  <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedInventoryProduct(product);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition hover:opacity-85 shadow-2xs border ${
                        product.stockStatus === 'in_stock'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                          : product.stockStatus === 'limited'
                          ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                          : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                      }`}
                      title="Click inventory count to see all orders for this saree"
                    >
                      <span>
                        {product.stockStatus === 'in_stock'
                          ? `In Stock (${product.stockCount})`
                          : product.stockStatus === 'limited'
                          ? `Limited (${product.stockCount})`
                          : 'Out of Stock (0)'}
                      </span>
                      <ChevronRight className="w-3 h-3 opacity-60" />
                    </button>
                  </td>

                  {/* Visibility Toggle Button */}
                  <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        canEditProducts && toggleProductVisibility(product.id);
                      }}
                      disabled={!canEditProducts}
                      className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                        product.isVisible
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                          : 'bg-neutral-100 text-neutral-500 border border-neutral-300 hover:bg-neutral-200'
                      } ${!canEditProducts ? 'cursor-not-allowed opacity-80' : ''}`}
                      title="Click to toggle public storefront display"
                    >
                      {product.isVisible ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="hidden xl:inline">Visible</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="hidden xl:inline">Hidden</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {canEditProducts ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(product);
                            }}
                            className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition"
                            title="Edit Saree Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductToDelete(product);
                            }}
                            className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition"
                            title="Delete Saree"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(product);
                          }}
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
              </>
            )}
          </div>
        </>
      )}

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
                {/* Unique Product Code Card - Manual Input with duplicate prevention */}
                <div className="sm:col-span-2 p-3.5 rounded-2xl bg-neutral-900 text-white border border-neutral-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-300 font-serif font-bold text-xs uppercase tracking-wider">
                        Unique Product Tracking Code (SKU) *
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        editingProduct && (editingProduct.isSkuLocked || (editingProduct.skuEditCount || 0) >= 1)
                          ? 'bg-rose-950 text-rose-300 border-rose-800'
                          : editingProduct
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}>
                        {editingProduct && (editingProduct.isSkuLocked || (editingProduct.skuEditCount || 0) >= 1)
                          ? 'Permanently Locked'
                          : editingProduct
                          ? 'One-Time Edit Allowed'
                          : 'Initial Creation (Unique)'}
                      </span>
                    </div>

                    {productCode && (
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
                    )}
                  </div>

                  {/* Staff & Admin Warning Disclaimer */}
                  {editingProduct ? (
                    editingProduct.isSkuLocked || (editingProduct.skuEditCount || 0) >= 1 ? (
                      <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-start gap-2.5">
                        <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-rose-300">SKU Permanently Locked</p>
                          <p className="text-[11px] text-rose-200/90 mt-0.5 leading-relaxed">
                            This product's SKU has already been edited once and is now permanently locked in the database. Further edits to this SKU are restricted.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-300">Staff/Admin Disclaimer: One-Time Edit Only</p>
                          <p className="text-[11px] text-amber-200/90 mt-0.5 leading-relaxed">
                            Warning: You can edit this SKU code only one time. Once saved after this edit, the SKU will be permanently locked and cannot be changed again.
                          </p>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-blue-300">Database Schema Notice</p>
                        <p className="text-[11px] text-blue-200/90 mt-0.5 leading-relaxed">
                          This SKU will be saved in the database schema upon creation to prevent duplicates. Staff and admins will be permitted to edit this SKU only once in the future before it is permanently locked.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* SKU Input Field or Permanently Locked Display */}
                  {editingProduct && (editingProduct.isSkuLocked || (editingProduct.skuEditCount || 0) >= 1) ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-700">
                      <span className="font-mono text-base font-bold text-amber-200 select-all">
                        {productCode}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Locked</span>
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row items-stretch gap-2">
                        {/* Auto-Generated Prefix (Store name - Category - ProductName - Colour) Locked */}
                        <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-300 font-mono text-xs select-all overflow-x-auto shadow-inner">
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-amber-300 font-bold whitespace-nowrap">
                            {autoSkuPrefix}-
                          </span>
                        </div>

                        {/* Editable Code Suffix */}
                        <div className="w-full sm:w-44 relative">
                          <input
                            type="text"
                            required
                            value={skuCodeSuffix}
                            onChange={(e) => handleSkuSuffixChange(e.target.value)}
                            placeholder="Code (e.g. 101)"
                            className={`w-full pl-3 pr-14 py-2.5 rounded-xl font-mono text-xs uppercase font-bold tracking-wider bg-neutral-800 text-amber-200 placeholder-neutral-500 border focus:outline-hidden transition ${
                              skuError
                                ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/50'
                                : 'border-neutral-700 focus:ring-2 focus:ring-amber-500/50'
                            }`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-400/80 uppercase pointer-events-none">
                            Code
                          </span>
                        </div>
                      </div>

                      {/* Complete SKU Preview */}
                      <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between text-[11px] flex-wrap gap-2">
                        <span className="text-neutral-400">Standardized Full SKU:</span>
                        <span className="font-mono font-bold text-amber-300">
                          {autoSkuPrefix}-{skuCodeSuffix.trim()}
                        </span>
                      </div>

                      {/* Real-time duplicate SKU warning */}
                      {skuError && (
                        <div className="mt-2 p-2.5 rounded-xl bg-rose-950/90 border border-rose-600 text-rose-200 text-xs flex items-start gap-2 animate-in fade-in">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <span>{skuError}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-neutral-800 mb-1">Name *</label>
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-neutral-700">
                      Fabric Type {settings.isFabricOptional ? <span className="text-neutral-400 font-normal text-xs">(Optional)</span> : <span className="text-rose-600 font-bold text-xs">*</span>}
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleFabricOptional()}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer border ${
                        settings.isFabricOptional
                          ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                          : 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:bg-neutral-200'
                      }`}
                      title="Toggle whether Fabric Type is optional or mandatory"
                    >
                      {settings.isFabricOptional ? 'Optional: ON' : 'Make Optional'}
                    </button>
                  </div>
                  <select
                    value={fabric || ''}
                    onChange={(e) => {
                      const newFab = e.target.value as SareeFabric;
                      setFabric(newFab);
                    }}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 font-medium"
                  >
                    {settings.isFabricOptional && (
                      <option value="">-- No Fabric Specified (Optional) --</option>
                    )}
                    {fabrics.map((f) => (
                      <option key={f} value={f}>
                        {f === 'Other' ? '+ Other (Custom Fabric)' : f}
                      </option>
                    ))}
                  </select>

                  {fabric === 'Other' && (
                    <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                      <input
                        type="text"
                        required={!settings.isFabricOptional}
                        value={customFabric}
                        onChange={(e) => setCustomFabric(e.target.value)}
                        placeholder="Type custom fabric name (e.g. Jamdani Cotton, Baluchari Silk, Linen)"
                        className="w-full p-2 rounded-xl border border-amber-400 bg-amber-50/50 text-neutral-900 font-medium text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-neutral-700">Color Palette *</label>
                  </div>

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
                  </div>
                </div>

                {/* MRP (Maximum Retail Price) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-neutral-800">
                      MRP (Maximum Retail Price ₹) *
                    </label>
                    <span className="text-[10px] text-neutral-400 font-semibold uppercase">Printed MRP</span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={originalPrice || ''}
                    onChange={(e) => setOriginalPrice(Number(e.target.value))}
                    required
                    placeholder="e.g. 30000"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 font-bold placeholder-neutral-400"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    The regular catalog / tag price of this handloom saree.
                  </p>
                </div>

                {/* Selling Price */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-neutral-800">
                      Selling Price (Offer / Pay Price ₹) *
                    </label>
                    <span className="text-[10px] text-emerald-700 font-bold uppercase">Customer Pays</span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={price || ''}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    required
                    placeholder="e.g. 25000"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 font-bold text-sm text-emerald-950 bg-emerald-50/30 placeholder-neutral-400"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Final discounted price customer pays at checkout.
                  </p>
                </div>

                {/* Live Offer & Difference Preview Card (Prompt requirement: displayed as offer in public front in % tag and amount) */}
                <div className="sm:col-span-2 p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/70 via-rose-50/40 to-neutral-50 border border-amber-200/80">
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1.5">
                    Live Public Storefront Offer Preview
                  </span>
                  {originalPrice && originalPrice > price ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-neutral-900 tabular-nums">
                          {formatPrice(price)}
                        </span>
                        <span className="text-xs text-neutral-400 line-through tabular-nums">
                          MRP {formatPrice(originalPrice)}
                        </span>
                        {/* Offer Percentage Tag */}
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs">
                          {Math.round(((originalPrice - price) / originalPrice) * 100)}% OFF
                        </span>
                      </div>

                      {/* Offer Amount Difference */}
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/80 text-emerald-800 font-semibold text-xs border border-emerald-300">
                        <span>🏷️ Customer Saves:</span>
                        <span className="font-bold">{formatPrice(originalPrice - price)}</span>
                      </div>
                    </div>
                  ) : originalPrice && price > originalPrice ? (
                    <div className="text-rose-700 font-medium text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>
                        Notice: Selling Price ({formatPrice(price)}) is greater than MRP ({formatPrice(originalPrice)}). Please check the values.
                      </span>
                    </div>
                  ) : (
                    <div className="text-neutral-500 text-xs">
                      Selling at full MRP ({formatPrice(price || 0)}). No discount offer badge will be displayed.
                    </div>
                  )}
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

                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Primary Video Drape URL (YouTube or MP4)
                    </label>
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... or .mp4"
                      className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1 flex items-center justify-between">
                      <span>Instagram Shorts / Reel URL</span>
                      <span className="text-[10px] text-pink-700 font-bold px-1.5 py-0.5 rounded-md bg-pink-50 border border-pink-200">Reels / Shorts</span>
                    </label>
                    <input
                      type="url"
                      value={instagramShortsUrl}
                      onChange={(e) => setInstagramShortsUrl(e.target.value)}
                      placeholder="https://www.instagram.com/reel/... or /shorts/..."
                      className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 bg-white"
                    />
                  </div>
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
                      <Upload className={`w-3.5 h-3.5 ${isProductImgUploading ? 'animate-bounce text-amber-600' : ''}`} />
                      <span>{isProductImgUploading ? 'Compressing...' : 'Upload Photo'}</span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} disabled={isProductImgUploading} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Product-Specific Specifications & Custom Attributes */}
                <div className="sm:col-span-2 pt-3 border-t border-neutral-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="font-bold text-neutral-800 text-xs uppercase tracking-wider block">
                          Product Specifications & Attributes
                        </label>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          {productSpecificAttributes.length} Fields (Product-Specific)
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        These specification fields are unique to this individual product and not shared globally across other categories.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAttributesManagerOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold shadow-2xs transition cursor-pointer self-start sm:self-auto"
                      title="Manage and customize specification fields for this product"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                      <span>Manage Specification Fields</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {productSpecificAttributes.map((attr) => {
                      const val = customAttributesValues[attr.id] ?? '';
                      return (
                        <div key={attr.id} className="space-y-1 relative group">
                          <div className="flex items-center justify-between">
                            <label className="block font-semibold text-neutral-700 text-xs truncate">
                              {attr.name}{' '}
                              {attr.isOptional ? (
                                <span className="text-neutral-400 font-normal">(Optional)</span>
                              ) : (
                                <span className="text-rose-600 font-bold">*</span>
                              )}
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDeleteProductSpecificAttribute(attr.id)}
                              className="text-neutral-400 hover:text-rose-600 transition p-0.5 cursor-pointer"
                              title={`Remove "${attr.name}" from this product`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <input
                            type="text"
                            required={!attr.isOptional}
                            value={val}
                            onChange={(e) =>
                              setCustomAttributesValues((prev) => ({
                                ...prev,
                                [attr.id]: e.target.value,
                              }))
                            }
                            placeholder={attr.placeholder || `e.g. Enter ${attr.name}`}
                            className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 bg-white"
                          />
                        </div>
                      );
                    })}
                    {productSpecificAttributes.length === 0 && (
                      <div className="sm:col-span-2 p-4 text-center border border-dashed border-neutral-300 rounded-xl text-neutral-500 text-xs">
                        No specification fields added for this product yet. Click "Manage Specification Fields" to add custom columns.
                      </div>
                    )}
                  </div>
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
                  src={productToDelete.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
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

      {/* Saree Inventory Orders Inspection Modal (User Request 6: clickable inventory to see orders) */}
      {selectedInventoryProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                      {selectedInventoryProduct.productCode}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedInventoryProduct.stockStatus === 'in_stock'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : selectedInventoryProduct.stockStatus === 'limited'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {selectedInventoryProduct.stockStatus === 'in_stock'
                        ? `Available Stock: ${selectedInventoryProduct.stockCount}`
                        : selectedInventoryProduct.stockStatus === 'limited'
                        ? `Limited Stock: ${selectedInventoryProduct.stockCount}`
                        : 'Out of Stock (0)'}
                    </span>
                  </div>
                  <h3 className="font-serif font-bold text-lg text-white mt-1">
                    {selectedInventoryProduct.title}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {selectedInventoryProduct.fabric} · {selectedInventoryProduct.color} · {formatPrice(selectedInventoryProduct.price)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInventoryProduct(null)}
                className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="bg-neutral-50 border-b border-neutral-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-neutral-200">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">Available in Hand</span>
                <p className="font-serif text-xl font-bold text-neutral-900 mt-0.5">
                  {selectedInventoryProduct.stockCount} units
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-neutral-200">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">Orders Containing Saree</span>
                <p className="font-serif text-xl font-bold text-amber-700 mt-0.5">
                  {matchingInventoryOrders.length} {matchingInventoryOrders.length === 1 ? 'order' : 'orders'}
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-neutral-200">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">Total Units Ordered</span>
                <p className="font-serif text-xl font-bold text-neutral-900 mt-0.5">
                  {matchingInventoryOrders.reduce((sum, ord) => {
                    const item = ord.items.find(
                      (it) =>
                        it.product.id === selectedInventoryProduct.id ||
                        it.product.productCode.toUpperCase() === selectedInventoryProduct.productCode.toUpperCase()
                    );
                    return sum + (item?.quantity || 0);
                  }, 0)} units
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-neutral-200">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">Active vs Fulfilled</span>
                <p className="font-bold text-xs text-neutral-900 mt-1">
                  <span className="text-amber-700 font-bold">
                    {matchingInventoryOrders.filter((o) => o.status !== 'Delivered' && o.status !== 'Cancelled').length} Active
                  </span>
                  {' · '}
                  <span className="text-emerald-700 font-bold">
                    {matchingInventoryOrders.filter((o) => o.status === 'Delivered').length} Delivered
                  </span>
                </p>
              </div>
            </div>

            {/* Orders Table / List */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {matchingInventoryOrders.length === 0 ? (
                <div className="p-12 text-center bg-neutral-50 rounded-2xl border border-neutral-200">
                  <ShoppingBag className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                  <p className="font-serif font-bold text-base text-neutral-800">
                    No orders placed for this saree yet
                  </p>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                    When customers purchase this saree code ({selectedInventoryProduct.productCode}), all orders and fulfillment statuses will appear right here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-neutral-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100 text-neutral-700 border-b border-neutral-200 font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Order #</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3 text-center">Ordered Qty</th>
                        <th className="py-2.5 px-3">Stage / Status</th>
                        <th className="py-2.5 px-3">Assigned Handler</th>
                        <th className="py-2.5 px-3 text-right">Order Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {matchingInventoryOrders.map((ord) => {
                        const matchedItem = ord.items.find(
                          (it) =>
                            it.product.id === selectedInventoryProduct.id ||
                            it.product.productCode.toUpperCase() === selectedInventoryProduct.productCode.toUpperCase()
                        );
                        return (
                          <tr key={ord.id} className="hover:bg-neutral-50/70 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-rose-950">
                              #{ord.orderNumber}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-neutral-600">
                              {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-neutral-900">{ord.customer.name}</p>
                              <p className="text-[10px] text-neutral-500 font-mono">{ord.customer.phone}</p>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-neutral-900 font-mono">
                              {matchedItem?.quantity || 1}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  ord.status === 'Delivered'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : ord.status === 'Shipped'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : ord.status === 'Confirmed'
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : ord.status === 'Cancelled'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {ord.status}
                                {ord.isClosed ? ' (Closed)' : ''}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-neutral-700">
                              {ord.assignedStaffName || (
                                <span className="text-neutral-400 italic">Unassigned</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-neutral-900 tabular-nums">
                              {formatPrice(ord.totalAmount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
              <span className="text-xs text-neutral-500 font-medium">
                Showing all {matchingInventoryOrders.length} customer records for this saree SKU
              </span>
              <button
                type="button"
                onClick={() => setSelectedInventoryProduct(null)}
                className="px-5 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Category Modal (Dynamic Real-Time Category Management) */}
      {isAddCategoryOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <FolderPlus className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Create Saree Category
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Step 1 of Hierarchical Category-First Workflow
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddCategoryOpen(false);
                  setCatActionError(null);
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="p-5 space-y-4 text-xs">
              {catActionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{catActionError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Poontamil Sarees, Foil Print Sarees, Banarasi Brocades"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 font-medium focus:ring-2 focus:ring-amber-500/40"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="e.g. Traditional pure silk handlooms with authentic tested zari motifs..."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Category Preview Image (Upload or URL)
                </label>

                {newCatImg ? (
                  <div className="relative rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-100 aspect-16/9 max-h-44 mb-2 group">
                    <img
                      src={newCatImg}
                      alt="Category preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNewCatImg('')}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs flex items-center gap-1 shadow-md hover:bg-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Preview</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2">
                    <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-50 transition cursor-pointer text-center">
                      <Upload className="w-6 h-6 text-amber-700 mb-1" />
                      <span className="font-bold text-neutral-800 text-xs">
                        {isCatImgUploading ? 'Reading image...' : 'Upload Category Image'}
                      </span>
                      <span className="text-[10px] text-neutral-500 mt-0.5">
                        PNG, JPG, WebP from your device to attach preview to this category card
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCatImageFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={newCatImg}
                    onChange={(e) => setNewCatImg(e.target.value)}
                    placeholder="Or paste image URL (https://...)"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs"
                  />
                  {newCatImg && (
                    <button
                      type="button"
                      onClick={() => setNewCatImg('')}
                      className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 border border-neutral-300 shrink-0 cursor-pointer"
                      title="Clear image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddCategoryOpen(false);
                    setCatActionError(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4 text-amber-400" />
                  <span>Create & Enter Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Real-Time Delete Category Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Delete Category
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Real-time category removal from database
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center gap-3">
                <img
                  src={categoryToDelete.imageUrl || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                  alt={categoryToDelete.name}
                  className="w-12 h-12 rounded-lg object-cover bg-neutral-200"
                />
                <div>
                  <p className="font-serif font-bold text-sm text-neutral-900">
                    {categoryToDelete.name}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {categoryCounts[categoryToDelete.name] || 0} sarees currently filed under this category
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>Confirm Real-Time Category Deletion</span>
                </p>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  Are you sure you want to delete &quot;{categoryToDelete.name}&quot;? The category will be removed instantly from the database and customer storefront without requiring a page reload. Existing sarees will remain safely in the inventory.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(null)}
                  className="py-2.5 px-4 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-700 font-semibold transition text-center cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCategory}
                  className="py-2.5 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Yes, Delete Category</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {categoryToEdit && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto">
            <div className="p-4 sm:p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Edit Category: {categoryToEdit.name}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Update category title, description & permanent cover image
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCategoryToEdit(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCategory} className="p-5 space-y-4 text-xs">
              {catActionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{catActionError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  placeholder="e.g. Kanjivaram Bridal Silks"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Short Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={editCatDesc}
                  onChange={(e) => setEditCatDesc(e.target.value)}
                  placeholder="e.g. Pure mulberry silk handwoven drapes with tested zari"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Category Preview Image (Upload or URL)
                </label>

                {editCatImg ? (
                  <div className="relative rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-100 aspect-16/9 max-h-44 mb-2 group">
                    <img
                      src={editCatImg}
                      alt="Category preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditCatImg('')}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs flex items-center gap-1 shadow-md hover:bg-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Change Photo</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2">
                    <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-50 transition cursor-pointer text-center">
                      <Upload className="w-6 h-6 text-amber-700 mb-1" />
                      <span className="font-bold text-neutral-800 text-xs">
                        {isEditCatImgUploading ? 'Optimizing photo...' : 'Upload New Category Cover'}
                      </span>
                      <span className="text-[10px] text-neutral-500 mt-0.5">
                        High-res photo compressed permanently into database
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleEditCatImageFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={editCatImg}
                    onChange={(e) => setEditCatImg(e.target.value)}
                    placeholder="Or paste image URL (https://...)"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs"
                  />
                  {editCatImg && (
                    <button
                      type="button"
                      onClick={() => setEditCatImg('')}
                      className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 border border-neutral-300 shrink-0 cursor-pointer"
                      title="Clear image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryToEdit(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold transition shadow-xs cursor-pointer"
                >
                  Save Category Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product-Specific Specifications & Custom Attributes Manager Modal */}
      {isAttributesManagerOpen && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-base font-bold text-white">
                      Manage Specification Fields
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-neutral-950">
                      Product-Specific
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Custom specifications for {title.trim() ? `"${title.trim()}"` : 'this product'}. Uniquely editable and not shared globally.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAttributesManagerOpen(false);
                  setEditingAttrId(null);
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6 text-xs">
              {/* Product Specification Columns List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-neutral-900 text-sm">
                      Current Specification Fields ({productSpecificAttributes.length})
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      These fields appear in the product form and on the storefront specification table for this individual product only.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {productSpecificAttributes.map((attr) => {
                    const isEditing = editingAttrId === attr.id;
                    return (
                      <div
                        key={attr.id}
                        className={`p-3.5 rounded-2xl border transition ${
                          isEditing
                            ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-400/30'
                            : 'bg-neutral-50 border-neutral-200/90'
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                                  Field / Column Name
                                </label>
                                <input
                                  type="text"
                                  value={editingAttrName}
                                  onChange={(e) => setEditingAttrName(e.target.value)}
                                  className="w-full p-2 bg-white rounded-xl border border-neutral-300 text-xs text-neutral-900"
                                  placeholder="e.g. Sleeve Cut"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                                  Input Placeholder
                                </label>
                                <input
                                  type="text"
                                  value={editingAttrPlaceholder}
                                  onChange={(e) => setEditingAttrPlaceholder(e.target.value)}
                                  className="w-full p-2 bg-white rounded-xl border border-neutral-300 text-xs text-neutral-900"
                                  placeholder="e.g. Half sleeve with lace"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700">
                                <input
                                  type="checkbox"
                                  checked={editingAttrIsOptional}
                                  onChange={(e) => setEditingAttrIsOptional(e.target.checked)}
                                  className="w-4 h-4 rounded text-amber-600 cursor-pointer"
                                />
                                <span>Optional Field (not mandatory)</span>
                              </label>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingAttrId(null)}
                                  className="px-3 py-1.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditProductSpecificAttribute(attr.id)}
                                  className="px-3.5 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold shadow-xs cursor-pointer"
                                >
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-neutral-900 text-sm">{attr.name}</span>
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    attr.isOptional
                                      ? 'bg-neutral-200/80 text-neutral-700'
                                      : 'bg-rose-100 text-rose-800 font-bold'
                                  }`}
                                >
                                  {attr.isOptional ? 'Optional' : 'Required *'}
                                </span>
                              </div>
                              <p className="text-[11px] text-neutral-500 font-mono truncate">
                                Placeholder: "{attr.placeholder || `Enter ${attr.name}`}"
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditAttribute(attr)}
                                className="p-2 rounded-xl border border-neutral-200 hover:bg-white text-neutral-700 hover:text-neutral-950 transition cursor-pointer"
                                title="Rename or modify field"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProductSpecificAttribute(attr.id)}
                                className="p-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 hover:text-rose-800 transition cursor-pointer"
                                title="Remove this specification field from this product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {productSpecificAttributes.length === 0 && (
                    <div className="p-6 text-center border border-dashed border-neutral-300 rounded-2xl text-neutral-500">
                      No custom specification fields configured for this product yet. Add one below!
                    </div>
                  )}
                </div>
              </div>

              {/* Add New Specification Field to This Product */}
              <form onSubmit={handleAddProductSpecificAttribute} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-600" />
                  <h4 className="font-bold text-neutral-900 text-xs uppercase tracking-wider">
                    Add Specification Field to This Product
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      Field Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAttrName}
                      onChange={(e) => setNewAttrName(e.target.value)}
                      placeholder="e.g. Dhoti Border, Sleeve Cut, Lining Material"
                      className="w-full p-2.5 bg-white rounded-xl border border-neutral-300 text-xs text-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      Helper / Placeholder
                    </label>
                    <input
                      type="text"
                      value={newAttrPlaceholder}
                      onChange={(e) => setNewAttrPlaceholder(e.target.value)}
                      placeholder="e.g. Pure Zari 2-inch Temple Border"
                      className="w-full p-2.5 bg-white rounded-xl border border-neutral-300 text-xs text-neutral-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700">
                    <input
                      type="checkbox"
                      checked={newAttrIsOptional}
                      onChange={(e) => setNewAttrIsOptional(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 cursor-pointer"
                    />
                    <span>Set as Optional (not mandatory during entry)</span>
                  </label>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to This Product</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsAttributesManagerOpen(false);
                  setEditingAttrId(null);
                }}
                className="px-5 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
