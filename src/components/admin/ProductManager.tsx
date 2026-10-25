import React, { useState, useMemo } from 'react';
import { useStore, getBoutiqueOrderPrefix } from '../../context/StoreContext';
import { Product, ProductType, SareeFabric, SareeColor, SareeCategory, ProductAttributeDefinition } from '../../types/store';
import { formatPrice } from '../../utils/upi';
import {
  isProductInActiveCategories,
  getCategorySingularName,
  getCategoryPluralName,
} from '../../utils/productValidation';
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
  Shirt,
  Gem,
  Scissors,
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

  // Cross-Selling Product-Category Suggestion Mapping State
  const [crossSellProductIds, setCrossSellProductIds] = useState<string[]>([]);
  const [crossSellCategoryNames, setCrossSellCategoryNames] = useState<string[]>([]);
  const [crossSellSearchQuery, setCrossSellSearchQuery] = useState('');

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

  const currentSingularCategory = useMemo(() => getCategorySingularName(category), [category]);
  const currentPluralCategory = useMemo(() => getCategoryPluralName(category), [category]);

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
  const [isWholesaleAvailable, setIsWholesaleAvailable] = useState<boolean>(true);
  const [customWholesalePrice, setCustomWholesalePrice] = useState<number | undefined>(undefined);
  const [resellerOnly, setResellerOnly] = useState<boolean>(false);
  const [channelFilter, setChannelFilter] = useState<'all' | 'wholesale' | 'retail_only'>('all');

  // Product Type Selector State ('saree' | 'blouse' | 'jewelry' | 'kurti')
  const [productType, setProductType] = useState<ProductType>('saree');

  // Saree Template Specific States
  const [sareeLength, setSareeLength] = useState<number>(6.3);
  const [sareeBlouseIncluded, setSareeBlouseIncluded] = useState<'yes' | 'no' | 'unstitched'>('yes');
  const [palluDetails, setPalluDetails] = useState('');
  const [sareeBorderDetails, setSareeBorderDetails] = useState('');
  const [sareeFabricComp, setSareeFabricComp] = useState('Pure Mulberry Kanchipuram Silk');

  // Blouse Template Specific States
  const [bustSize, setBustSize] = useState('36 (With 2-inch margin)');
  const [blouseSleeveLength, setBlouseSleeveLength] = useState('Elbow Length (11 inches)');
  const [blouseFabricType, setBlouseFabricType] = useState('Pure Raw Silk with Maggam Work');
  const [neckStyle, setNeckStyle] = useState('Sweetheart Neck with Back Dori');
  const [liningDetails, setLiningDetails] = useState('Double Padded with 100% Breathable Cotton');

  // Jewelry Template Specific States
  const [baseMetal, setBaseMetal] = useState('22K Gold Plated Brass & Copper');
  const [gemstoneDetails, setGemstoneDetails] = useState('South Sea Pearls & Kemp Stones');
  const [setComponents, setSetComponents] = useState('Necklace + Pair of Jhumka Earrings');
  const [closureType, setClosureType] = useState('Adjustable Traditional Zari Thread Dori (Free Size)');

  // Kurti Template Specific States
  const [kurtiLength, setKurtiLength] = useState('Calf Length (46 inches)');
  const [cutStyle, setCutStyle] = useState('A-Line Flared Silhouette');
  const [sleeveStyle, setSleeveStyle] = useState('3/4th Sleeves with Zari Piping');
  const [kurtiFabricType, setKurtiFabricType] = useState('Pure Mulmul Cotton');
  const [embroideryDetails, setEmbroideryDetails] = useState('Handcrafted Lucknowi Chikankari with Mukaish Work');

  const PRODUCT_TYPES: {
    id: ProductType;
    label: string;
    icon: string;
    badge: string;
    subtitle: string;
    defaultCat: string;
    suggestedCrossSells: string[];
  }[] = [
    {
      id: 'saree',
      label: 'Saree',
      icon: '🥻',
      badge: 'Heritage Drape',
      subtitle: 'Kanjivaram, Banarasi, Organza',
      defaultCat: 'Heirloom Sarees',
      suggestedCrossSells: ['Designer Blouses', 'Temple Jewelry'],
    },
    {
      id: 'blouse',
      label: 'Blouse',
      icon: '✂️',
      badge: 'Designer Tailored',
      subtitle: 'Bust size, neck & lining specs',
      defaultCat: 'Designer Blouses',
      suggestedCrossSells: ['Heirloom Sarees', 'Temple Jewelry'],
    },
    {
      id: 'jewelry',
      label: 'Jewelry',
      icon: '💎',
      badge: 'Temple Heritage',
      subtitle: 'Metal, gemstones & sets',
      defaultCat: 'Temple Jewelry',
      suggestedCrossSells: ['Heirloom Sarees', 'Designer Blouses'],
    },
    {
      id: 'kurti',
      label: 'Kurti',
      icon: '👗',
      badge: 'Ethnic Tunic',
      subtitle: 'Cut, length & chikankari',
      defaultCat: 'Ethnic Kurtis',
      suggestedCrossSells: ['Bottoms & Palazzos', 'Dupattas', 'Temple Jewelry'],
    },
  ];

  const applyProductTemplate = (type: ProductType, currentFab?: string, currentCol?: string) => {
    const colorDesc = currentCol || selectedColorOption || 'Crimson Red';

    if (type === 'saree') {
      const fabName = currentFab || 'Kanjivaram Silk';
      setFabric(fabName as SareeFabric);
      setSareeFabricComp(fabName === 'Kanjivaram Silk' ? 'Pure Mulberry Kanchipuram Silk' : fabName);
      setSareeLength(6.3);
      setSareeBlouseIncluded('yes');
      setPalluDetails('Tested Pure Gold Zari Temple Gopuram Pallu with Peacock Motifs');
      setSareeBorderDetails('Traditional 8-inch Contrast Korvai Border');
      setWeaveDetails('Authentic 3-ply mulberry double-korvai handloom');
      setTitle(`Royal ${colorDesc} Shrimant Kanjivaram Bridal Silk`);
      setSubtitle('Pure Mulberry Silk with Tested Gold Zari Temple Pallu');
      setDescription(`Individually hand-woven over 24 artisan days in Kanchipuram, this heirloom drape features classic interlocking temple gopuram borders and delicate peacock motifs. Certified pure silk mark.`);
      setPrice(28500);
      setOriginalPrice(34000);
      setCategory(categories.find((c) => c.name.toLowerCase().includes('saree'))?.name || 'Heirloom Sarees');
      setCrossSellCategoryNames(['Designer Blouses', 'Temple Jewelry']);

      const fields: ProductAttributeDefinition[] = [
        { id: 'attr-fabric-comp', name: 'Fabric Composition', placeholder: 'e.g. Pure Mulberry Kanchipuram Silk', isOptional: false },
        { id: 'attr-length', name: 'Saree Length', placeholder: 'e.g. 6.3 Meters (With Blouse)', isOptional: false },
        { id: 'attr-blouse-inc', name: 'Blouse Piece', placeholder: 'e.g. Included (0.8m Running Silk)', isOptional: false },
        { id: 'attr-pallu', name: 'Pallu Design', placeholder: 'e.g. Tested Pure Gold Zari Temple Gopuram', isOptional: true },
        { id: 'attr-border', name: 'Border & Zari Detail', placeholder: 'e.g. Traditional 8-inch Contrast Korvai', isOptional: true },
        { id: 'attr-weave', name: 'Weave Technique', placeholder: 'e.g. Authentic 3-ply Mulberry Korvai', isOptional: true },
      ];
      setProductSpecificAttributes(fields);
      setCustomAttributesValues({
        'attr-fabric-comp': 'Pure Mulberry Kanchipuram Silk',
        'attr-length': '6.3 Meters (With Blouse)',
        'attr-blouse-inc': 'Included (0.8m Running Silk)',
        'attr-pallu': 'Tested Pure Gold Zari Temple Gopuram Pallu with Peacock Motifs',
        'attr-border': 'Traditional 8-inch Contrast Korvai Border',
        'attr-weave': 'Authentic 3-ply mulberry double-korvai handloom',
      });
    } else if (type === 'blouse') {
      setBustSize('36 (With 2-inch margin)');
      setBlouseSleeveLength('Elbow Length (11 inches)');
      setBlouseFabricType('Pure Raw Silk with Maggam Work');
      setNeckStyle('Sweetheart Neck with Back Dori');
      setLiningDetails('Double Padded with 100% Breathable Cotton');
      setTitle(`Aarohi ${colorDesc} Zardozi Hand-Embroidered Raw Silk Blouse`);
      setSubtitle('Sweetheart Neckline with Heavy Zari Maggam Sleeves');
      setDescription(`Masterpiece designer blouse tailored in rich pure raw silk. Features handcrafted zardozi embroidery, padded cups for a flawless fit, and pure breathable cotton lining.`);
      setPrice(8500);
      setOriginalPrice(11000);
      setCategory(categories.find((c) => c.name.toLowerCase().includes('blouse'))?.name || 'Designer Blouses');
      setCrossSellCategoryNames(['Heirloom Sarees', 'Temple Jewelry']);

      const fields: ProductAttributeDefinition[] = [
        { id: 'attr-bust-size', name: 'Bust Size', placeholder: 'e.g. 36 (With 2-inch inner margin)', isOptional: false },
        { id: 'attr-sleeve-length', name: 'Sleeve Length', placeholder: 'e.g. Elbow Length (11 inches)', isOptional: false },
        { id: 'attr-blouse-fabric', name: 'Fabric Type', placeholder: 'e.g. Pure Raw Silk with Maggam Work', isOptional: false },
        { id: 'attr-neck-style', name: 'Neck Style', placeholder: 'e.g. Sweetheart Neck with Back Dori', isOptional: false },
        { id: 'attr-lining', name: 'Lining Details', placeholder: 'e.g. Double Padded with 100% Breathable Cotton', isOptional: false },
      ];
      setProductSpecificAttributes(fields);
      setCustomAttributesValues({
        'attr-bust-size': '36 (With 2-inch margin)',
        'attr-sleeve-length': 'Elbow Length (11 inches)',
        'attr-blouse-fabric': 'Pure Raw Silk with Maggam Work',
        'attr-neck-style': 'Sweetheart Neck with Back Dori',
        'attr-lining': 'Double Padded with 100% Breathable Cotton',
      });
    } else if (type === 'jewelry') {
      setBaseMetal('22K Gold Plated Brass & Copper');
      setGemstoneDetails('South Sea Pearls & Kemp Stones');
      setSetComponents('Necklace + Pair of Jhumka Earrings');
      setClosureType('Adjustable Traditional Zari Thread Dori (Free Size)');
      setTitle(`Devasthanam Antique Temple Gold ${colorDesc} Choker & Jhumka Set`);
      setSubtitle('22K Matte Gold Finish with Kemp Rubies & Pearls');
      setDescription(`Handcrafted heritage temple jewelry set plated in 22K antique matte gold. Adorned with luminous South Sea pearls, emerald accents, and radiant kemp stones.`);
      setPrice(12500);
      setOriginalPrice(15500);
      setCategory(categories.find((c) => c.name.toLowerCase().includes('jewel'))?.name || 'Temple Jewelry');
      setCrossSellCategoryNames(['Heirloom Sarees', 'Designer Blouses']);

      const fields: ProductAttributeDefinition[] = [
        { id: 'attr-base-metal', name: 'Material / Base Metal', placeholder: 'e.g. 22K Gold Plated Brass & Copper', isOptional: false },
        { id: 'attr-gemstones', name: 'Gemstone Details', placeholder: 'e.g. South Sea Pearls & Kemp Stones', isOptional: false },
        { id: 'attr-components', name: 'Set Components', placeholder: 'e.g. Necklace + Pair of Jhumka Earrings', isOptional: false },
        { id: 'attr-closure', name: 'Sizing & Closure Type', placeholder: 'e.g. Adjustable Traditional Zari Dori (Free Size)', isOptional: false },
      ];
      setProductSpecificAttributes(fields);
      setCustomAttributesValues({
        'attr-base-metal': '22K Gold Plated Brass & Copper',
        'attr-gemstones': 'South Sea Pearls & Kemp Stones',
        'attr-components': 'Necklace + Pair of Jhumka Earrings',
        'attr-closure': 'Adjustable Traditional Zari Thread Dori (Free Size)',
      });
    } else if (type === 'kurti') {
      setKurtiLength('Calf Length (46 inches)');
      setCutStyle('A-Line Flared Silhouette');
      setSleeveStyle('3/4th Sleeves with Zari Piping');
      setKurtiFabricType('Pure Mulmul Cotton');
      setEmbroideryDetails('Handcrafted Lucknowi Chikankari with Mukaish Work');
      setTitle(`Nazakat Hand-Embroidered ${colorDesc} Chikankari Cotton Kurti`);
      setSubtitle('A-Line Flared Pure Mulmul with Mukaish Accents');
      setDescription(`Bespoke handcrafted ethnic kurti spun from breathable mulmul cotton. Adorned with intricate shadow work chikankari motifs, delicate mukaish rings, and mother-of-pearl buttons.`);
      setPrice(4200);
      setOriginalPrice(5500);
      setCategory(categories.find((c) => c.name.toLowerCase().includes('kurti'))?.name || 'Ethnic Kurtis');
      setCrossSellCategoryNames(['Bottoms & Palazzos', 'Dupattas', 'Temple Jewelry']);

      const fields: ProductAttributeDefinition[] = [
        { id: 'attr-kurti-length', name: 'Kurti Length', placeholder: 'e.g. Calf Length (46 inches)', isOptional: false },
        { id: 'attr-cut-style', name: 'Silhouette / Cut Style', placeholder: 'e.g. A-Line Flared Silhouette', isOptional: false },
        { id: 'attr-sleeve-style', name: 'Sleeve Length & Style', placeholder: 'e.g. 3/4th Sleeves with Zari Piping', isOptional: false },
        { id: 'attr-kurti-fabric', name: 'Fabric Type', placeholder: 'e.g. Pure Mulmul Cotton', isOptional: false },
        { id: 'attr-embroidery', name: 'Embroidery / Print Details', placeholder: 'e.g. Handcrafted Lucknowi Chikankari with Mukaish Work', isOptional: false },
      ];
      setProductSpecificAttributes(fields);
      setCustomAttributesValues({
        'attr-kurti-length': 'Calf Length (46 inches)',
        'attr-cut-style': 'A-Line Flared Silhouette',
        'attr-sleeve-style': '3/4th Sleeves with Zari Piping',
        'attr-kurti-fabric': 'Pure Mulmul Cotton',
        'attr-embroidery': 'Handcrafted Lucknowi Chikankari with Mukaish Work',
      });
    }
  };

  const handleSelectProductType = (newType: ProductType) => {
    setProductType(newType);
    const matchingCat = categories.find((c) => c.name.toLowerCase().includes(newType));
    if (matchingCat) {
      setCategory(matchingCat.name);
    }
    applyProductTemplate(newType, fabric, selectedColorOption);
  };

  const autoFillSareeDetails = (fab: SareeFabric, col: string) => {
    applyProductTemplate('saree', fab, col);
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

  const openAddModal = (presetCategory?: string, initialType?: ProductType) => {
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

    // Determine initial type from parameter or category context
    const catNameLower = (presetCategory || activeCategoryView?.name || '').toLowerCase();
    const resolvedType: ProductType =
      initialType ||
      (catNameLower.includes('blouse')
        ? 'blouse'
        : catNameLower.includes('jewel')
        ? 'jewelry'
        : catNameLower.includes('kurti')
        ? 'kurti'
        : 'saree');
    setProductType(resolvedType);

    const targetCat =
      presetCategory ||
      (activeCategoryView ? activeCategoryView.name : categories.find(c => c.name.toLowerCase().includes(resolvedType))?.name || categories[0]?.name || 'Heirloom Sarees');
    setCategory(targetCat);
    setFabric(initialFabric);
    setCustomFabric('');
    setSelectedColorOption(initialColor);
    setCustomColor('');
    setStockStatus('in_stock');
    setStockCount(3);
    setIsVisible(true);
    setImages([]);
    setImageUrlInput('');
    setVideoUrl('https://www.youtube.com/watch?v=0hW73jL76bY');
    setInstagramShortsUrl('');
    setOccasion('Wedding & Reception');

    // Apply the dynamic product type template
    applyProductTemplate(resolvedType, initialFabric, initialColor);

    setCrossSellProductIds([]);
    setCrossSellSearchQuery('');
    setIsWholesaleAvailable(true);
    setCustomWholesalePrice(undefined);
    setResellerOnly(false);

    setIsEditingModalOpen(true);
  };

  const handleCategoryDropdownChange = (newCatName: string) => {
    setCategory(newCatName);
    const catLower = newCatName.toLowerCase();
    const matchedType: ProductType =
      catLower.includes('blouse')
        ? 'blouse'
        : catLower.includes('jewel') || catLower.includes('necklace') || catLower.includes('jhumka')
        ? 'jewelry'
        : catLower.includes('kurti') || catLower.includes('anarkali') || catLower.includes('tunic')
        ? 'kurti'
        : 'saree';
    setProductType(matchedType);

    const singular = getCategorySingularName(newCatName);
    const colorDesc = selectedColorOption === 'Other' ? (customColor.trim() || 'Handloom') : (selectedColorOption || 'Crimson Red');

    // Only auto-populate or update title & subtitle template if creating new product
    if (!editingProduct) {
      if (matchedType === 'saree') {
        setTitle(`Royal ${colorDesc} Shrimant Kanjivaram Bridal Silk`);
        setSubtitle('Pure Mulberry Silk with Tested Gold Zari Temple Pallu');
        setDescription('Individually hand-woven in Kanchipuram, this heirloom drape features classic interlocking temple gopuram borders and delicate peacock motifs. Certified pure silk mark.');
        setFabric('Kanjivaram Silk');
      } else if (matchedType === 'blouse') {
        setTitle(`Aarohi ${colorDesc} Zardozi Hand-Embroidered Raw Silk Blouse`);
        setSubtitle('Sweetheart Neckline with Heavy Zari Maggam Sleeves');
        setDescription('Masterpiece designer blouse tailored in rich pure raw silk. Features handcrafted zardozi embroidery, padded cups for a flawless fit, and pure breathable cotton lining.');
        setFabric('Raw Silk');
      } else if (matchedType === 'jewelry') {
        setTitle(`Devasthanam Antique Temple Gold ${colorDesc} Choker & Jhumka Set`);
        setSubtitle('22K Matte Gold Finish with Kemp Rubies & Pearls');
        setDescription('Handcrafted heritage temple jewelry set plated in 22K antique matte gold. Adorned with luminous South Sea pearls, emerald accents, and radiant kemp stones.');
      } else if (matchedType === 'kurti') {
        setTitle(`Nazakat Hand-Embroidered ${colorDesc} Chikankari Cotton Kurti`);
        setSubtitle('A-Line Flared Pure Mulmul with Mukaish Accents');
        setDescription('Bespoke handcrafted ethnic kurti spun from breathable mulmul cotton. Adorned with intricate shadow work chikankari motifs, delicate mukaish rings, and mother-of-pearl buttons.');
        setFabric('Pure Cotton');
      } else {
        setTitle(`Artisan Handcrafted ${colorDesc} ${singular}`);
        setSubtitle(`Premium handcrafted ${singular.toLowerCase()} with bespoke craftsmanship detailing`);
        setDescription(`Individually curated ${singular.toLowerCase()} crafted with authentic materials and exceptional attention to artisan detail.`);
      }
    }
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

    const inferredType: ProductType =
      prod.productType ||
      (prod.category?.toLowerCase().includes('blouse') || prod.title.toLowerCase().includes('blouse')
        ? 'blouse'
        : prod.category?.toLowerCase().includes('jewel') || prod.title.toLowerCase().includes('jewel') || prod.title.toLowerCase().includes('necklace')
        ? 'jewelry'
        : prod.category?.toLowerCase().includes('kurti') || prod.title.toLowerCase().includes('kurti') || prod.title.toLowerCase().includes('anarkali')
        ? 'kurti'
        : 'saree');
    setProductType(inferredType);

    // Populate Saree template attributes
    setSareeLength(prod.lengthMeters || (prod.customAttributes?.['attr-length'] ? parseFloat(prod.customAttributes['attr-length']) : 6.3));
    setSareeBlouseIncluded(prod.blousePieceIncluded === false ? 'no' : 'yes');
    setPalluDetails(prod.palluDetails || prod.customAttributes?.['attr-pallu'] || '');
    setSareeBorderDetails(prod.borderType || prod.customAttributes?.['attr-border'] || '');
    setSareeFabricComp(prod.fabric || prod.customAttributes?.['attr-fabric-comp'] || 'Pure Mulberry Kanchipuram Silk');

    // Populate Blouse template attributes
    setBustSize(prod.bustSize || prod.customAttributes?.['attr-bust-size'] || '36 (With 2-inch margin)');
    setBlouseSleeveLength(prod.sleeveLength || prod.customAttributes?.['attr-sleeve-length'] || 'Elbow Length (11 inches)');
    setBlouseFabricType(prod.fabric || prod.customAttributes?.['attr-blouse-fabric'] || 'Pure Raw Silk with Maggam Work');
    setNeckStyle(prod.neckStyle || prod.customAttributes?.['attr-neck-style'] || 'Sweetheart Neck with Back Dori');
    setLiningDetails(prod.liningDetails || prod.customAttributes?.['attr-lining'] || 'Double Padded with 100% Breathable Cotton');

    // Populate Jewelry template attributes
    setBaseMetal(prod.baseMetal || prod.customAttributes?.['attr-base-metal'] || '22K Gold Plated Brass & Copper');
    setGemstoneDetails(prod.gemstoneDetails || prod.customAttributes?.['attr-gemstones'] || 'South Sea Pearls & Kemp Stones');
    setSetComponents(prod.setComponents || prod.customAttributes?.['attr-components'] || 'Necklace + Pair of Jhumka Earrings');
    setClosureType(prod.closureType || prod.customAttributes?.['attr-closure'] || 'Adjustable Traditional Zari Thread Dori (Free Size)');

    // Populate Kurti template attributes
    setKurtiLength(prod.kurtiLength || prod.customAttributes?.['attr-kurti-length'] || 'Calf Length (46 inches)');
    setCutStyle(prod.cutStyle || prod.customAttributes?.['attr-cut-style'] || 'A-Line Flared Silhouette');
    setSleeveStyle(prod.sleeveStyle || prod.customAttributes?.['attr-sleeve-style'] || '3/4th Sleeves with Zari Piping');
    setKurtiFabricType(prod.fabric || prod.customAttributes?.['attr-kurti-fabric'] || 'Pure Mulmul Cotton');
    setEmbroideryDetails(prod.embroideryDetails || prod.customAttributes?.['attr-embroidery'] || 'Handcrafted Lucknowi Chikankari with Mukaish Work');

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

    setCrossSellProductIds(prod.crossSellProductIds || []);
    setCrossSellCategoryNames(prod.crossSellCategoryNames || []);
    setCrossSellSearchQuery('');
    setIsWholesaleAvailable(prod.isWholesaleAvailable !== false);
    setCustomWholesalePrice(prod.wholesalePrice);
    setResellerOnly(Boolean(prod.resellerOnly));

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

    // Sync active template attributes into customAttributes dictionary
    const updatedCustomAttrs = { ...customAttributesValues };
    if (productType === 'saree') {
      if (sareeFabricComp) updatedCustomAttrs['attr-fabric-comp'] = sareeFabricComp;
      if (sareeLength) updatedCustomAttrs['attr-length'] = `${sareeLength} Meters`;
      updatedCustomAttrs['attr-blouse-inc'] = sareeBlouseIncluded === 'yes' ? 'Included (0.8m Running Silk)' : sareeBlouseIncluded === 'no' ? 'Not Included' : 'Unstitched Fabric Attached';
      if (palluDetails) updatedCustomAttrs['attr-pallu'] = palluDetails;
      if (sareeBorderDetails) updatedCustomAttrs['attr-border'] = sareeBorderDetails;
      if (weaveDetails) updatedCustomAttrs['attr-weave'] = weaveDetails;
    } else if (productType === 'blouse') {
      if (bustSize) updatedCustomAttrs['attr-bust-size'] = bustSize;
      if (blouseSleeveLength) updatedCustomAttrs['attr-sleeve-length'] = blouseSleeveLength;
      if (blouseFabricType) updatedCustomAttrs['attr-blouse-fabric'] = blouseFabricType;
      if (neckStyle) updatedCustomAttrs['attr-neck-style'] = neckStyle;
      if (liningDetails) updatedCustomAttrs['attr-lining'] = liningDetails;
    } else if (productType === 'jewelry') {
      if (baseMetal) updatedCustomAttrs['attr-base-metal'] = baseMetal;
      if (gemstoneDetails) updatedCustomAttrs['attr-gemstones'] = gemstoneDetails;
      if (setComponents) updatedCustomAttrs['attr-components'] = setComponents;
      if (closureType) updatedCustomAttrs['attr-closure'] = closureType;
    } else if (productType === 'kurti') {
      if (kurtiLength) updatedCustomAttrs['attr-kurti-length'] = kurtiLength;
      if (cutStyle) updatedCustomAttrs['attr-cut-style'] = cutStyle;
      if (sleeveStyle) updatedCustomAttrs['attr-sleeve-style'] = sleeveStyle;
      if (kurtiFabricType) updatedCustomAttrs['attr-kurti-fabric'] = kurtiFabricType;
      if (embroideryDetails) updatedCustomAttrs['attr-embroidery'] = embroideryDetails;
    }

    const payload: any = {
      productCode: finalSku,
      productType,
      category: category.trim() || categories[0]?.name || 'Heirloom Sarees',
      title: title.trim(),
      subtitle: subtitle.trim(),
      description: description.trim(),
      fabric: (productType === 'blouse' ? blouseFabricType : productType === 'kurti' ? kurtiFabricType : finalFabric) as SareeFabric | undefined,
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
      borderType: productType === 'saree' ? (sareeBorderDetails.trim() || finalBorder?.trim()) : undefined,
      blousePieceIncluded: productType === 'saree' ? (sareeBlouseIncluded !== 'no') : undefined,
      lengthMeters: productType === 'saree' ? (!isNaN(finalLength) ? finalLength : sareeLength) : undefined,
      occasion: finalOccasion ? finalOccasion.trim() : undefined,
      // Saree template attributes
      palluDetails: productType === 'saree' ? palluDetails.trim() || undefined : undefined,
      // Blouse template attributes
      bustSize: productType === 'blouse' ? bustSize.trim() || undefined : undefined,
      sleeveLength: productType === 'blouse' ? blouseSleeveLength.trim() || undefined : undefined,
      neckStyle: productType === 'blouse' ? neckStyle.trim() || undefined : undefined,
      liningDetails: productType === 'blouse' ? liningDetails.trim() || undefined : undefined,
      // Jewelry template attributes
      baseMetal: productType === 'jewelry' ? baseMetal.trim() || undefined : undefined,
      gemstoneDetails: productType === 'jewelry' ? gemstoneDetails.trim() || undefined : undefined,
      setComponents: productType === 'jewelry' ? setComponents.trim() || undefined : undefined,
      closureType: productType === 'jewelry' ? closureType.trim() || undefined : undefined,
      // Kurti template attributes
      kurtiLength: productType === 'kurti' ? kurtiLength.trim() || undefined : undefined,
      cutStyle: productType === 'kurti' ? cutStyle.trim() || undefined : undefined,
      sleeveStyle: productType === 'kurti' ? sleeveStyle.trim() || undefined : undefined,
      embroideryDetails: productType === 'kurti' ? embroideryDetails.trim() || undefined : undefined,
      specificationFields: productSpecificAttributes,
      customAttributes: updatedCustomAttrs,
      crossSellProductIds,
      crossSellCategoryNames,
      isWholesaleAvailable,
      wholesalePrice: undefined,
      resellerOnly,
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
    const validProds = products.filter((p) => isProductInActiveCategories(p, categories));
    if (!activeCategoryView) return validProds;
    return validProds.filter(
      (p) =>
        p.category?.toLowerCase() === activeCategoryView.name.toLowerCase() ||
        p.fabric?.toLowerCase() === activeCategoryView.name.toLowerCase()
    );
  }, [products, categories, activeCategoryView]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    products
      .filter((p) => isProductInActiveCategories(p, categories))
      .forEach((p) => {
        const cat = p.category || 'Uncategorized';
        map[cat] = (map[cat] || 0) + 1;
      });
    return map;
  }, [products, categories]);

  const displayedProducts = useMemo(() => {
    const base = showAllSareesFlat
      ? products.filter((p) => isProductInActiveCategories(p, categories))
      : currentCategoryProducts;

    if (channelFilter === 'wholesale') {
      return base.filter((p) => p.isWholesaleAvailable !== false);
    }
    if (channelFilter === 'retail_only') {
      return base.filter((p) => p.isWholesaleAvailable === false);
    }
    return base;
  }, [showAllSareesFlat, products, categories, currentCategoryProducts, channelFilter]);

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
                Product Categories & Collections
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
                title="Browse all products across all categories in a flat list"
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
                  To follow the hierarchical workflow, create a category first (e.g. Pure Silk Sarees, Designer Blouses, Temple Jewelry), then click to enter inside it and add products directly.
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
                    <div className="relative aspect-16/9 sm:aspect-4/3 w-full overflow-hidden bg-neutral-900 flex items-center justify-center">
                      <img
                        src={cat.imageUrl || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                        alt={cat.name}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none" />

                      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 max-w-[calc(100%-1.5rem)]">
                        <span className="bg-white/95 backdrop-blur-xs text-neutral-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs truncate">
                          {count} {count === 1 ? getCategorySingularName(cat.name) : getCategoryPluralName(cat.name)}
                        </span>
                        {canEditProducts && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditCategoryModal(cat);
                              }}
                              className="p-1 rounded-full bg-black/75 hover:bg-amber-600 text-white transition cursor-pointer shadow-sm"
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
                              className="p-1 rounded-full bg-black/75 hover:bg-rose-600 text-white transition cursor-pointer shadow-sm"
                              title="Remove category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Category Title & Labels Overlay */}
                      <div className="absolute inset-x-0 bottom-0 z-20 p-3.5 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent text-white pointer-events-none">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300 drop-shadow block">
                          Category Collection
                        </span>
                        <h3 className="font-serif font-bold text-lg sm:text-xl text-white group-hover:text-amber-200 transition drop-shadow-md">
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
                  {currentCategoryProducts.length} {currentCategoryProducts.length === 1 ? getCategorySingularName(activeCategoryView.name) : getCategoryPluralName(activeCategoryView.name)} inside
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
        /* Flat Products Inventory Header */
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
              Products Catalog & Inventory (Flat View)
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Total {products.length} products · {products.filter((p) => p.isVisible).length} visible on storefront
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
                  ? `Search ${getCategoryPluralName(activeCategoryView.name).toLowerCase()} within ${activeCategoryView.name}...`
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

            {/* Wholesale & Reseller Channel Categorization Filter */}
            <div className="flex items-center gap-1 shrink-0 border-l border-neutral-200 pl-2">
              <button
                type="button"
                onClick={() => setChannelFilter('all')}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                  channelFilter === 'all'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('wholesale')}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                  channelFilter === 'wholesale'
                    ? 'bg-purple-950 text-white shadow-2xs font-bold'
                    : 'bg-purple-50 text-purple-900 hover:bg-purple-100'
                }`}
                title="View products categorized for B2B Resellers"
              >
                <span>🤝 Reseller Catalog</span>
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('retail_only')}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                  channelFilter === 'retail_only'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
                title="View retail storefront exclusive products"
              >
                Retail Only
              </button>
            </div>
          </div>

          {/* Product Inventory Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
            {filteredProducts.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center">
                  <Package className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-base text-neutral-900">
                  {activeCategoryView
                    ? `No ${getCategoryPluralName(activeCategoryView.name).toLowerCase()} inside "${activeCategoryView.name}" yet`
                    : 'No products matching your search'}
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {activeCategoryView
                    ? `Click below to add your first handcrafted ${getCategorySingularName(activeCategoryView.name).toLowerCase()} directly into ${activeCategoryView.name}.`
                    : 'Try searching with a different SKU code, fabric, or title.'}
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
              title="Tap anywhere to edit this product"
            >
              <div className="flex gap-3">
                <img
                  src={product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                  alt={product.title}
                  className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded-xl bg-neutral-100 border border-neutral-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-[10px] sm:text-xs font-bold text-rose-950 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 truncate">
                        {product.productCode}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 shrink-0 flex items-center gap-1">
                        <span>{PRODUCT_TYPES.find((t) => t.id === (product.productType || 'saree'))?.icon}</span>
                        <span>{PRODUCT_TYPES.find((t) => t.id === (product.productType || 'saree'))?.label}</span>
                      </span>
                    </div>
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
                      <div className="flex items-center gap-1 mb-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-900 border border-amber-200 shrink-0">
                          <span>{PRODUCT_TYPES.find((t) => t.id === (product.productType || 'saree'))?.icon}</span>
                          <span>{PRODUCT_TYPES.find((t) => t.id === (product.productType || 'saree'))?.label}</span>
                        </span>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200 truncate max-w-[120px]">
                          {product.category || 'General Collection'}
                        </span>
                      </div>
                      <p className="font-semibold text-neutral-800 text-xs truncate mt-0.5">{product.fabric || product.title}</p>
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
                            title={`Edit ${getCategorySingularName(product.category)} Details`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductToDelete(product);
                            }}
                            className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition"
                            title={`Delete ${getCategorySingularName(product.category)}`}
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
                          title={`View ${getCategorySingularName(product.category)} Details`}
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
              <div>
                <h3 className="font-serif text-lg sm:text-xl font-bold flex items-center gap-2">
                  <span>{PRODUCT_TYPES.find((t) => t.id === productType)?.icon || '🥻'}</span>
                  <span>
                    {editingProduct
                      ? `Edit ${currentSingularCategory} Details`
                      : `Add New ${currentSingularCategory}`}
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Category: <span className="text-amber-300 font-semibold">{category}</span> ({currentSingularCategory}) · Template: <span className="text-white font-medium">{PRODUCT_TYPES.find((t) => t.id === productType)?.label}</span>
                </p>
              </div>
              <button
                onClick={() => setIsEditingModalOpen(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveProduct} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Product Type Selector - 4 distinct categories: Saree, Blouse, Jewelry, Kurti */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 text-white border border-neutral-800 shadow-md space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-300 font-serif font-bold text-xs uppercase tracking-wider">
                      Product Type Template Selector *
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400 hidden sm:inline">
                    Adapts attributes & cross-sells dynamically
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRODUCT_TYPES.map((type) => {
                    const isSelected = productType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => handleSelectProductType(type.id)}
                        className={`p-3 rounded-xl border text-left transition relative cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 text-white ring-2 ring-amber-400/40 shadow-sm'
                            : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-600'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xl sm:text-2xl">{type.icon}</span>
                            {isSelected ? (
                              <span className="w-4 h-4 rounded-full bg-amber-400 text-neutral-950 flex items-center justify-center text-[10px] font-bold">
                                ✓
                              </span>
                            ) : (
                              <span className="w-3.5 h-3.5 rounded-full border border-neutral-600" />
                            )}
                          </div>
                          <p className={`font-serif font-bold text-xs ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                            {type.label}
                          </p>
                          <span className="text-[9px] text-amber-200/80 font-semibold block uppercase tracking-wider mt-0.5">
                            {type.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-1.5 line-clamp-1">
                          {type.subtitle}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

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

                {/* Dynamic Category Selector Dropdown */}
                <div className="sm:col-span-2 p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-neutral-50 border border-amber-300 shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-bold text-amber-950 text-xs flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-700" />
                      <span>Product Category *</span>
                    </label>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-200/90 text-amber-950 border border-amber-300">
                      Entity: {currentSingularCategory}
                    </span>
                  </div>
                  <select
                    value={category}
                    onChange={(e) => handleCategoryDropdownChange(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl border border-amber-300 bg-white text-neutral-900 font-bold text-xs focus:ring-2 focus:ring-amber-500/40 shadow-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({getCategorySingularName(c.name)})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-amber-900/80 mt-1">
                    Titles, subtitles, template fields, and SKU prefixes dynamically adapt to this category.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-neutral-800 mb-1">
                    {currentSingularCategory} Name *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder={
                      currentSingularCategory.toLowerCase().includes('saree')
                        ? 'e.g. Maharani Pure Kanjivaram Bridal Silk'
                        : currentSingularCategory.toLowerCase().includes('blouse')
                        ? 'e.g. Aarohi Zardozi Hand-Embroidered Raw Silk Blouse'
                        : currentSingularCategory.toLowerCase().includes('jewel')
                        ? 'e.g. Devasthanam Antique Temple Gold Choker & Jhumka Set'
                        : currentSingularCategory.toLowerCase().includes('kurti')
                        ? 'e.g. Nazakat Hand-Embroidered Chikankari Cotton Kurti'
                        : `e.g. Handcrafted ${currentSingularCategory}`
                    }
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-neutral-700 mb-1">
                    {currentSingularCategory.toLowerCase().includes('saree')
                      ? 'Saree Subtitle / Weave Highlight'
                      : currentSingularCategory.toLowerCase().includes('blouse')
                      ? 'Blouse Subtitle / Neckline Highlight'
                      : currentSingularCategory.toLowerCase().includes('jewel')
                      ? 'Jewelry Subtitle / Gemstone Highlight'
                      : currentSingularCategory.toLowerCase().includes('kurti')
                      ? 'Kurti Subtitle / Silhouette Highlight'
                      : `${currentSingularCategory} Subtitle / Craftsmanship Highlight`}
                  </label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder={
                      currentSingularCategory.toLowerCase().includes('saree')
                        ? 'e.g. Pure Mulberry Silk with 3G Pure Gold Zari'
                        : currentSingularCategory.toLowerCase().includes('blouse')
                        ? 'e.g. Sweetheart Neckline with Heavy Zari Maggam Sleeves'
                        : currentSingularCategory.toLowerCase().includes('jewel')
                        ? 'e.g. 22K Matte Gold Finish with Kemp Rubies & Pearls'
                        : currentSingularCategory.toLowerCase().includes('kurti')
                        ? 'e.g. A-Line Flared Pure Mulmul with Mukaish Accents'
                        : `e.g. Premium handcrafted ${currentSingularCategory.toLowerCase()} details`
                    }
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

                {/* Reseller B2B Wholesale Availability & Channel Categorization Card */}
                <div className="sm:col-span-2 p-3.5 rounded-2xl bg-purple-50/90 border border-purple-200 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 text-purple-950 font-bold text-xs">
                      <span>🤝 B2B Reseller Portal Availability</span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-purple-900">
                      <input
                        type="checkbox"
                        checked={isWholesaleAvailable}
                        onChange={(e) => setIsWholesaleAvailable(e.target.checked)}
                        className="rounded text-purple-700"
                      />
                      <span>Available for Resellers</span>
                    </label>
                  </div>

                  {isWholesaleAvailable && (
                    <div className="mt-1 text-xs">
                      <div className="flex flex-col justify-center bg-white/70 p-2.5 rounded-xl border border-purple-200">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-purple-950">
                          <input
                            type="checkbox"
                            checked={resellerOnly}
                            onChange={(e) => setResellerOnly(e.target.checked)}
                            className="rounded text-purple-700"
                          />
                          <span>Reseller Exclusive (Hide from public store)</span>
                        </label>
                        <p className="text-[10px] text-purple-700 mt-1">
                          When checked, this piece is categorized exclusively for registered Resellers. Wholesale margin discounts apply automatically based on each reseller's approved margin.
                        </p>
                      </div>
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
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Artisan Story / {currentSingularCategory} Description
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={`Describe the artisan craftsmanship, materials, styling origin, and details of this ${currentSingularCategory.toLowerCase()}...`}
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

                {/* Dynamic Category Product Images Management */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="block font-bold text-neutral-800">
                    {currentSingularCategory} Photos (URLs or Upload)
                  </label>
                  
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

                {/* Dynamic Product Type Template Fields Section */}
                <div className="sm:col-span-2 p-4 bg-gradient-to-br from-amber-50/70 via-orange-50/30 to-amber-50/40 rounded-2xl border border-amber-200/90 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/70">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {PRODUCT_TYPES.find((t) => t.id === productType)?.icon || '🥻'}
                      </span>
                      <div>
                        <h4 className="font-serif text-sm font-bold text-neutral-900">
                          {productType === 'saree' && 'Saree Handloom & Weaving Attributes'}
                          {productType === 'blouse' && 'Designer Blouse Tailoring Attributes'}
                          {productType === 'jewelry' && 'Temple Jewelry Craftsmanship Attributes'}
                          {productType === 'kurti' && 'Ethnic Kurti Tailoring & Silhouette Attributes'}
                        </h4>
                        <p className="text-[11px] text-neutral-600">
                          {productType === 'saree' && 'Fabric composition, length, blouse inclusion, pallu design, and border details.'}
                          {productType === 'blouse' && 'Bust sizing, sleeve length, fabric type, neck style, and padding/lining details.'}
                          {productType === 'jewelry' && 'Base metal composition, gemstones, set components, and closure/sizing type.'}
                          {productType === 'kurti' && 'Kurti length, cut silhouette, sleeve style, fabric type, and embroidery/print details.'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-200/80 text-amber-950 border border-amber-300 uppercase tracking-wider shrink-0">
                      {productType} Template
                    </span>
                  </div>

                  {/* 1. Saree Template Fields */}
                  {productType === 'saree' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Fabric Composition *
                        </label>
                        <input
                          type="text"
                          required
                          value={sareeFabricComp}
                          onChange={(e) => {
                            setSareeFabricComp(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-fabric-comp': e.target.value }));
                          }}
                          placeholder="e.g. Pure Mulberry Kanchipuram Silk"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Saree Length (Meters) *
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min="4"
                            max="10"
                            required
                            value={sareeLength}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 6.3;
                              setSareeLength(val);
                              setLengthMeters(val);
                              setCustomAttributesValues((prev) => ({ ...prev, 'attr-length': `${val} Meters` }));
                            }}
                            className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-bold focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                          />
                          <div className="flex gap-1 shrink-0">
                            {[6.3, 5.5].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  setSareeLength(preset);
                                  setLengthMeters(preset);
                                  setCustomAttributesValues((prev) => ({ ...prev, 'attr-length': `${preset} Meters` }));
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                                  sareeLength === preset
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                                }`}
                              >
                                {preset}m
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Blouse Piece Inclusion *
                        </label>
                        <select
                          value={sareeBlouseIncluded}
                          onChange={(e) => {
                            const val = e.target.value as 'yes' | 'no' | 'unstitched';
                            setSareeBlouseIncluded(val);
                            setBlousePieceIncluded(val !== 'no');
                            setCustomAttributesValues((prev) => ({
                              ...prev,
                              'attr-blouse-inc': val === 'yes' ? 'Included (0.8m Running Silk)' : val === 'no' ? 'Not Included' : 'Unstitched Contrast Fabric Attached',
                            }));
                          }}
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        >
                          <option value="yes">Yes - Included (0.8m Running Pure Silk)</option>
                          <option value="unstitched">Yes - Unstitched Contrast Fabric Piece</option>
                          <option value="no">No - Saree Only (Blouse Piece Not Included)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Zari & Border Details
                        </label>
                        <input
                          type="text"
                          value={sareeBorderDetails}
                          onChange={(e) => {
                            setSareeBorderDetails(e.target.value);
                            setBorderType(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-border': e.target.value }));
                          }}
                          placeholder="e.g. Traditional 8-inch Contrast Korvai Border with Zari Mayil Chakram"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Pallu Design Description
                        </label>
                        <input
                          type="text"
                          value={palluDetails}
                          onChange={(e) => {
                            setPalluDetails(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-pallu': e.target.value }));
                          }}
                          placeholder="e.g. Tested Pure Gold Zari Temple Gopuram Pallu with Peacock & Floral Motifs"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  )}

                  {/* 2. Blouse Template Fields */}
                  {productType === 'blouse' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Bust Size (Inches / Margins) *
                        </label>
                        <input
                          type="text"
                          required
                          value={bustSize}
                          onChange={(e) => {
                            setBustSize(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-bust-size': e.target.value }));
                          }}
                          placeholder="e.g. 36 (With 2-inch inner margin)"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {['32', '34', '36', '38', '40', '42'].map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => {
                                const fullVal = `${sz} (With 2-inch inner margin)`;
                                setBustSize(fullVal);
                                setCustomAttributesValues((prev) => ({ ...prev, 'attr-bust-size': fullVal }));
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 cursor-pointer"
                            >
                              Size {sz}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Sleeve Length & Cut *
                        </label>
                        <input
                          type="text"
                          required
                          value={blouseSleeveLength}
                          onChange={(e) => {
                            setBlouseSleeveLength(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-sleeve-length': e.target.value }));
                          }}
                          placeholder="e.g. Elbow Length (11 inches), Cap Sleeves, Sleeveless"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Blouse Fabric Type *
                        </label>
                        <input
                          type="text"
                          required
                          value={blouseFabricType}
                          onChange={(e) => {
                            setBlouseFabricType(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-blouse-fabric': e.target.value }));
                          }}
                          placeholder="e.g. Pure Raw Silk with Maggam Work, Brocade Silk, Velvet"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Neck Style *
                        </label>
                        <input
                          type="text"
                          required
                          value={neckStyle}
                          onChange={(e) => {
                            setNeckStyle(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-neck-style': e.target.value }));
                          }}
                          placeholder="e.g. Sweetheart Neck with Back Dori, Boat Neck, Deep U"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Lining & Padding Details *
                        </label>
                        <input
                          type="text"
                          required
                          value={liningDetails}
                          onChange={(e) => {
                            setLiningDetails(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-lining': e.target.value }));
                          }}
                          placeholder="e.g. Double Padded with 100% Breathable Cotton Voile Lining"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  )}

                  {/* 3. Jewelry Template Fields */}
                  {productType === 'jewelry' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Material / Base Metal *
                        </label>
                        <input
                          type="text"
                          required
                          value={baseMetal}
                          onChange={(e) => {
                            setBaseMetal(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-base-metal': e.target.value }));
                          }}
                          placeholder="e.g. 22K Gold Plated Brass & Copper, Kundan Alloy, 92.5 Silver"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Gemstone Details *
                        </label>
                        <input
                          type="text"
                          required
                          value={gemstoneDetails}
                          onChange={(e) => {
                            setGemstoneDetails(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-gemstones': e.target.value }));
                          }}
                          placeholder="e.g. South Sea Pearls & Kemp Stones, Emerald Accents, Polki"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Set Components *
                        </label>
                        <input
                          type="text"
                          required
                          value={setComponents}
                          onChange={(e) => {
                            setSetComponents(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-components': e.target.value }));
                          }}
                          placeholder="e.g. Necklace + Pair of Jhumka Earrings, Choker + Maang Tikka"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Sizing & Closure Type *
                        </label>
                        <input
                          type="text"
                          required
                          value={closureType}
                          onChange={(e) => {
                            setClosureType(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-closure': e.target.value }));
                          }}
                          placeholder="e.g. Adjustable Traditional Zari Thread Dori (Free Size), Push Back"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  )}

                  {/* 4. Kurti Template Fields */}
                  {productType === 'kurti' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Kurti Length *
                        </label>
                        <input
                          type="text"
                          required
                          value={kurtiLength}
                          onChange={(e) => {
                            setKurtiLength(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-kurti-length': e.target.value }));
                          }}
                          placeholder="e.g. Calf Length (46 inches), Knee Length (42 inches), Ankle Length"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {['Knee Length (42")', 'Calf Length (46")', 'Ankle Length (52")'].map((len) => (
                            <button
                              key={len}
                              type="button"
                              onClick={() => {
                                setKurtiLength(len);
                                setCustomAttributesValues((prev) => ({ ...prev, 'attr-kurti-length': len }));
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 cursor-pointer"
                            >
                              {len}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Silhouette / Cut Style *
                        </label>
                        <input
                          type="text"
                          required
                          value={cutStyle}
                          onChange={(e) => {
                            setCutStyle(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-cut-style': e.target.value }));
                          }}
                          placeholder="e.g. A-Line Flared Silhouette, Straight Fit with Side Slits, Anarkali"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {['A-Line Flared', 'Straight Fit', 'Anarkali Flared', 'Nyra Cut'].map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => {
                                const full = `${st} Silhouette`;
                                setCutStyle(full);
                                setCustomAttributesValues((prev) => ({ ...prev, 'attr-cut-style': full }));
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 cursor-pointer"
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Sleeve Length & Style *
                        </label>
                        <input
                          type="text"
                          required
                          value={sleeveStyle}
                          onChange={(e) => {
                            setSleeveStyle(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-sleeve-style': e.target.value }));
                          }}
                          placeholder="e.g. 3/4th Sleeves with Zari Piping, Full Sleeves, Bell Sleeves"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Kurti Fabric Type *
                        </label>
                        <input
                          type="text"
                          required
                          value={kurtiFabricType}
                          onChange={(e) => {
                            setKurtiFabricType(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-kurti-fabric': e.target.value }));
                          }}
                          placeholder="e.g. Pure Mulmul Cotton, Rayon Slub, Pure Georgette with Lining"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-bold text-neutral-800 text-xs mb-1">
                          Embroidery / Print Details *
                        </label>
                        <input
                          type="text"
                          required
                          value={embroideryDetails}
                          onChange={(e) => {
                            setEmbroideryDetails(e.target.value);
                            setCustomAttributesValues((prev) => ({ ...prev, 'attr-embroidery': e.target.value }));
                          }}
                          placeholder="e.g. Handcrafted Lucknowi Chikankari with Mukaish Work, Bagru Block Print"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  )}
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

                {/* Cross-Selling Product-Category Suggestion Mapping Section */}
                <div className="sm:col-span-2 p-4 bg-amber-50/50 rounded-2xl border border-amber-200/90 space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <h4 className="font-serif text-sm font-bold text-neutral-900">
                        {productType === 'saree' && 'Cross-Selling Product Suggestions (Matching Blouses & Temple Jewelry)'}
                        {productType === 'blouse' && 'Cross-Selling Product Suggestions (Matching Heirloom Sarees & Jewelry)'}
                        {productType === 'jewelry' && 'Cross-Selling Product Suggestions (Matching Sarees & Designer Blouses)'}
                        {productType === 'kurti' && 'Cross-Selling Product Suggestions (Matching Bottoms, Dupattas & Jewelry)'}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        {crossSellProductIds.length} Linked Items
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {productType === 'saree' && 'Select matching blouses and temple jewelry items to display dynamically on the customer product details and cart drawer.'}
                      {productType === 'blouse' && 'Select matching sarees and jewelry sets to display dynamically on the customer product details and cart drawer.'}
                      {productType === 'jewelry' && 'Select matching sarees and designer blouses to display dynamically on the customer product details and cart drawer.'}
                      {productType === 'kurti' && 'Select matching bottoms, palazzos, dupattas, and jewelry items to display dynamically on the customer product details and cart drawer.'}
                    </p>
                  </div>

                  {/* 1. Handpicked Product Links */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-neutral-800">
                      1. Handpicked Specific Products to Cross-Sell:
                    </label>

                    {/* Filter and selector */}
                    <div className="relative">
                      <input
                        type="text"
                        value={crossSellSearchQuery}
                        onChange={(e) => setCrossSellSearchQuery(e.target.value)}
                        placeholder={
                          productType === 'saree'
                            ? 'Search catalog to link matching blouses & jewelry...'
                            : productType === 'blouse'
                            ? 'Search catalog to link matching sarees & jewelry...'
                            : productType === 'jewelry'
                            ? 'Search catalog to link matching sarees & blouses...'
                            : 'Search catalog to link matching bottoms, dupattas & jewelry...'
                        }
                        className="w-full p-2.5 pl-8 rounded-xl border border-neutral-300 text-xs bg-white text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                      />
                      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-3" />
                      {crossSellSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setCrossSellSearchQuery('')}
                          className="text-[10px] text-neutral-400 hover:text-neutral-700 absolute right-2.5 top-3"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Search results & quick toggle list */}
                    <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-white rounded-xl border border-neutral-200">
                      {products
                        .filter(
                          (p) =>
                            p.id !== editingProduct?.id &&
                            isProductInActiveCategories(p, categories) &&
                            (!crossSellSearchQuery.trim() ||
                              p.title.toLowerCase().includes(crossSellSearchQuery.toLowerCase()) ||
                              p.productCode.toLowerCase().includes(crossSellSearchQuery.toLowerCase()) ||
                              (p.category && p.category.toLowerCase().includes(crossSellSearchQuery.toLowerCase())))
                        )
                        .slice(0, 10)
                        .map((candidate) => {
                          const isLinked = crossSellProductIds.includes(candidate.id);
                          return (
                            <div
                              key={candidate.id}
                              onClick={() => {
                                setCrossSellProductIds((prev) =>
                                  isLinked ? prev.filter((id) => id !== candidate.id) : [...prev, candidate.id]
                                );
                              }}
                              className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                                isLinked
                                  ? 'bg-amber-50 border-amber-300 text-amber-950 font-semibold'
                                  : 'bg-neutral-50/50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={candidate.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                                  alt={candidate.title}
                                  className="w-7 h-7 rounded-md object-cover bg-neutral-200 shrink-0"
                                />
                                <div className="min-w-0">
                                  <span className="text-[10px] text-neutral-500 font-mono">
                                    [{candidate.productCode}]
                                  </span>{' '}
                                  <span className="truncate">{candidate.title}</span>
                                  {candidate.category && (
                                    <span className="ml-1 text-[9px] px-1.5 py-0.2 rounded bg-neutral-200 text-neutral-700">
                                      {candidate.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="tabular-nums font-bold">{formatPrice(candidate.price)}</span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                    isLinked
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-neutral-200 text-neutral-700'
                                  }`}
                                >
                                  {isLinked ? '✓ Linked' : '+ Link'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* 2. Category Fallback Configuration */}
                  <div className="pt-2 border-t border-amber-200/60 space-y-2">
                    <label className="block text-xs font-bold text-neutral-800">
                      2. Fallback Cross-Sell Categories:
                    </label>
                    <p className="text-[10px] text-neutral-500">
                      When handpicked items are out of stock, recommend items from these categories:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {categories.map((cat) => {
                        const isCatSelected = crossSellCategoryNames.includes(cat.name);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setCrossSellCategoryNames((prev) =>
                                isCatSelected
                                  ? prev.filter((c) => c !== cat.name)
                                  : [...prev, cat.name]
                              );
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                              isCatSelected
                                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                            }`}
                          >
                            <span>{cat.name}</span>
                            {isCatSelected && <Check className="w-3 h-3" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div>
                    <p className="font-bold text-neutral-900">Show on Public Storefront</p>
                    <p className="text-neutral-500 text-[11px]">Toggle whether customers can view & purchase this {currentSingularCategory.toLowerCase()}</p>
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
                    <span>Remove {currentSingularCategory}</span>
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
                    {editingProduct ? `Save ${currentSingularCategory}` : `Publish ${currentSingularCategory}`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Removal Confirmation Modal */}
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
                    Remove {getCategorySingularName(productToDelete.category)} from Catalog
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
                  Are you sure you want to remove this {getCategorySingularName(productToDelete.category).toLowerCase()}? It will be deleted from the boutique catalog, shopping bags, and inventory records. This action cannot be undone.
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
                  <span>Yes, Delete {getCategorySingularName(productToDelete.category)}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Inventory Orders Inspection Modal */}
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
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">Orders Containing {getCategorySingularName(selectedInventoryProduct.category)}</span>
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
                  <div className="relative rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-900/5 p-2 min-h-36 max-h-72 mb-2 flex items-center justify-center group">
                    <img
                      src={newCatImg}
                      alt="Category preview"
                      className="max-h-68 w-auto max-w-full object-contain mx-auto rounded-xl shadow-xs"
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
                  <div className="relative rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-900/5 p-2 min-h-36 max-h-72 mb-2 flex items-center justify-center group">
                    <img
                      src={editCatImg}
                      alt="Category preview"
                      className="max-h-68 w-auto max-w-full object-contain mx-auto rounded-xl shadow-xs"
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
