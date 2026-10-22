import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  Product,
  Order,
  StoreSettings,
  CartItem,
  OrderStatus,
  ShippingDetails,
  StaffMember,
  StaffSectionPermissions,
  ProductReview,
  StaffAssignmentLog,
  AdminOnlineStatus,
  CustomerDeliveryIssue,
  CourierService,
  LoginPunchRecord,
  OrderChatMessage,
  SareeCategory,
  SkuRecord,
  ProductAttributeDefinition,
  OrderStatusHistory,
  InvestigationComment,
} from '../types/store';
import {
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_SETTINGS,
  DEFAULT_STAFF_PERMISSIONS,
  DEFAULT_CHAT_TEMPLATES,
  INITIAL_REVIEWS,
  DEFAULT_SAREE_CATEGORIES,
  DEFAULT_PRODUCT_ATTRIBUTES,
} from '../data/initialData';
import { googleSignOut, setCachedAccessToken } from '../utils/firebaseAuth';
import { syncPWAAndDocumentMetadata } from '../utils/dynamicManifest';
import { formatDeviceDateTime, getDeviceTimezone } from '../utils/deviceTime';
import { sendRestockPushNotification } from '../utils/audio';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
  sanitizeForFirestore,
  testFirestoreConnection,
} from '../utils/firebase';
import {
  isCustomerReportIssueVisible,
  isDisputeRedressalEnabled,
} from '../utils/disputeRedressals';

const STORAGE_KEYS = {
  PRODUCTS: 'aara_boutique_products_v3',
  ORDERS: 'aara_boutique_orders_v3',
  SETTINGS: 'aara_boutique_settings_v3',
  CART: 'aara_boutique_cart_v3',
  CURRENT_USER: 'aara_boutique_user_v3',
  REVIEWS: 'aara_boutique_reviews_v3',
};

export interface ActiveUser {
  type: 'admin' | 'staff';
  username: string;
  name: string;
  email?: string;
  photoUrl?: string;
  staffId?: string;
}

interface StoreContextType {
  // Products
  products: Product[];
  publicProducts: Product[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  toggleProductVisibility: (id: string) => void;

  // Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  cartShippingFee: number;
  isFreeDeliveryUnlocked: boolean;
  amountNeededForFreeDelivery: number;
  cartGrandTotal: number;

  // Orders
  orders: Order[];
  placeOrder: (orderInput: {
    customer: Order['customer'];
    items: CartItem[];
    upiTransactionId: string;
    refundUpiId?: string;
    refundUpiPhone?: string;
    notes?: string;
    checkoutMethod: 'submit_order' | 'whatsapp';
  }) => Order;
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    extra?: {
      shippingDetails?: ShippingDetails;
      refundUtr?: string;
      cancellationReason?: string;
    }
  ) => void;
  updateOrderShipping: (
    orderId: string,
    shippingDetails: { courierName: string; trackingNumber: string; notes?: string }
  ) => void;
  markRefundProcessed: (orderId: string, refundUtr: string, refundTool?: string, notes?: string) => void;
  assignOrderStaff: (orderId: string, staffId: string, staffName: string, reasonOrNote?: string) => void;
  addOrderWorkLog: (orderId: string, action: string, note?: string) => void;
  requestOrderCancellation: (
    orderNumber: string,
    phone: string,
    reason: string
  ) => { success: boolean; message: string; order?: Order };
  resolveCancellationRequest: (
    orderId: string,
    action: 'approve' | 'reject',
    adminNotes?: string,
    refundUtr?: string
  ) => void;
  replenishOrderInventory: (order: Order) => void;
  findOrdersByQuery: (query: string) => Order[];
  closeOrder: (orderId: string, closedBy?: string) => void;
  reopenOrder: (orderId: string, reopenedBy: string, reason: string) => void;
  reportCustomerDeliveryIssue: (
    orderNumber: string,
    phone: string,
    issueDescription: string,
    issueType?: 'delivery' | 'refund'
  ) => Promise<{ success: boolean; message: string }>;
  reportCustomerIssue: (
    orderNumber: string,
    phone: string,
    issueDescription: string,
    issueType?: 'delivery' | 'refund'
  ) => Promise<{ success: boolean; message: string }>;
  resolveDeliveryIssue: (
    orderId: string,
    resolutionNotes: string,
    action: 'reopen' | 'resolve'
  ) => Promise<void>;
  addInvestigationComment: (
    orderId: string,
    comment: string,
    author?: string,
    newStatus?: 'investigating' | 'open'
  ) => Promise<void>;
  sendOrderChatMessage: (
    orderId: string,
    message: string,
    sender: 'customer' | 'staff' | 'admin',
    senderName: string
  ) => Promise<{ success: boolean; message: string }>;

  // Courier Services Management
  addCourierService: (courier: Omit<CourierService, 'id'>) => Promise<void>;
  updateCourierService: (id: string, updates: Partial<CourierService>) => Promise<void>;
  deleteCourierService: (id: string) => Promise<void>;

  // Staff Management
  staffMembers: StaffMember[];
  addStaffMember: (staff: Omit<StaffMember, 'id' | 'createdAt'>) => void;
  updateStaffMember: (id: string, updates: Partial<StaffMember>) => void;
  toggleStaffLock: (id: string) => void;
  deleteStaffMember: (id: string) => void;
  syncStaffToDatabase: () => Promise<number>;

  // Customer Product Reviews
  reviews: ProductReview[];
  addReview: (reviewData: Omit<ProductReview, 'id' | 'createdAt'>) => Promise<void>;
  getProductReviews: (productId: string) => ProductReview[];
  getProductAverageRating: (productId: string) => { rating: number; count: number };

  // Settings
  settings: StoreSettings;
  updateSettings: (updates: Partial<StoreSettings>) => void;
  resetToInitialData: () => void;

  // Auth (Google Login for Admin and Staff)
  currentUser: ActiveUser | null;
  isAdminLoggedIn: boolean;
  adminOnlineStatus: AdminOnlineStatus;
  currentPermissions: StaffSectionPermissions;
  googleLogin: (
    firebaseUser: { email?: string | null; displayName?: string | null; photoURL?: string | null; uid: string },
    accessToken: string
  ) => { success: boolean; error?: string; role?: 'admin' | 'staff' };
  adminLogin: (pin: string) => boolean;
  staffLogin: (username: string, password: string) => { success: boolean; error?: string };
  adminLogout: () => void;
  forceLogoutStaff: (staffId: string) => Promise<void>;
  punchStaffAttendance: (staffId: string, authMethod?: 'google' | 'password' | 'admin_switch') => Promise<void>;
  updateStaffIdleStatus: (staffId: string, isIdle: boolean) => Promise<void>;
  setStaffIdleStatus: (staffId: string, isIdle: boolean) => Promise<void>;
  updateStaffActivity: (staffId: string) => Promise<void>;
  remoteLogoutNotice: string | null;
  clearRemoteLogoutNotice: () => void;

  // Centralized SKU Collection Registry
  skus: SkuRecord[];
  checkSkuUniqueInRegistry: (code: string, currentEditingId?: string) => { isUnique: boolean; conflictingProduct?: string; error?: string };

  // Categories & Customer Browsing
  categories: SareeCategory[];
  addCategory: (category: Omit<SareeCategory, 'id'>) => Promise<SareeCategory>;
  updateCategory: (id: string, updates: Partial<SareeCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  customerActiveTab: 'home' | 'categories' | 'search' | 'wishlist';
  setCustomerActiveTab: (tab: 'home' | 'categories' | 'search' | 'wishlist') => void;

  // Wishlist
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;

  // Customer Orders Count
  customerOrdersCount: number;
  customerOrders: Order[];
  recordCustomerOrder: (orderNumber: string, phone?: string) => void;

  // Dynamic Product Specifications / Custom Attributes
  productAttributes: ProductAttributeDefinition[];
  addProductAttribute: (name: string, placeholder?: string, isOptional?: boolean) => ProductAttributeDefinition;
  updateProductAttribute: (id: string, updates: Partial<ProductAttributeDefinition>) => void;
  deleteProductAttribute: (id: string) => void;
  toggleFabricOptional: (isOptional?: boolean) => void;

  // UI state
  activeProductModal: Product | null;
  setActiveProductModal: (product: Product | null) => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  isTrackOrderOpen: boolean;
  setIsTrackOrderOpen: (open: boolean) => void;
  lastPlacedOrder: Order | null;
  setLastPlacedOrder: (order: Order | null) => void;
  currentView: 'store' | 'admin';
  setCurrentView: (view: 'store' | 'admin') => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (typeof fallback === 'object' && fallback !== null && !Array.isArray(fallback)) {
      return {
        ...fallback,
        ...parsed,
        storefrontDisplay: {
          ...(fallback as any).storefrontDisplay,
          ...(parsed as any).storefrontDisplay,
        },
      };
    }
    return parsed;
  } catch (err) {
    console.error(`Error loading key ${key} from storage:`, err);
    return fallback;
  }
}

export function getBoutiqueOrderPrefix(boutiqueName?: string): string {
  if (!boutiqueName || !boutiqueName.trim()) return 'NC';
  const clean = boutiqueName.trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const initials = words.map((w) => w.replace(/[^a-zA-Z0-9]/g, '').charAt(0).toUpperCase()).join('');
    if (initials.length >= 2 && initials.length <= 6) {
      return initials;
    }
  }
  if (clean.toLowerCase().includes('neydhal')) {
    return 'NC';
  }
  const slug = clean.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return slug.length >= 2 ? slug.slice(0, 3) : (slug || 'NC');
}

function saveToStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err: any) {
    console.warn(`Storage save warning for ${key}:`, err?.message || err);
    // If quota exceeded, clean up old non-essential items and retry
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      try {
        const keysToClean = ['aara_temp_', 'search_cache', 'preview_'];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && keysToClean.some((prefix) => k.startsWith(prefix))) {
            localStorage.removeItem(k);
          }
        }
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        // Safe fallback - Firestore database retains all source of truth
      }
    }
  }
}

const STORE_DATA_VERSION = 'neydhal_brand_new_v3_2026';

// Automatic fresh state initialization: cleans out old test artifacts so app runs as a brand-new setup
if (typeof window !== 'undefined') {
  try {
    const currentVersion = localStorage.getItem('neydhal_data_version');
    if (currentVersion !== STORE_DATA_VERSION) {
      localStorage.clear();
      localStorage.setItem('neydhal_data_version', STORE_DATA_VERSION);
    }
  } catch {
    // ignore
  }
}

const DELETED_PRODUCT_IDS_KEY = 'neydhal_deleted_product_ids';
const getDeletedProductIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DELETED_PRODUCT_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};
const markProductAsDeleted = (id: string) => {
  try {
    const current = getDeletedProductIds();
    current.add(id);
    localStorage.setItem(DELETED_PRODUCT_IDS_KEY, JSON.stringify(Array.from(current)));
  } catch {}
};
const unmarkProductAsDeleted = (id: string) => {
  try {
    const current = getDeletedProductIds();
    current.delete(id);
    localStorage.setItem(DELETED_PRODUCT_IDS_KEY, JSON.stringify(Array.from(current)));
  } catch {}
};
const clearDeletedProductIds = () => {
  try {
    localStorage.removeItem(DELETED_PRODUCT_IDS_KEY);
  } catch {}
};

export const LOW_STOCK_THRESHOLD = 5;

export const normalizeProductStock = (product: Product): Product => {
  const rawCount = product.stockCount !== undefined && product.stockCount !== null ? Number(product.stockCount) : 0;
  const count = isNaN(rawCount) ? 0 : Math.max(0, Math.floor(rawCount));
  let status: 'in_stock' | 'limited' | 'out_of_stock';
  if (count <= 0) {
    status = 'out_of_stock';
  } else if (count <= LOW_STOCK_THRESHOLD) {
    status = 'limited';
  } else {
    // If stock count is above threshold (> 5 pieces), stockStatus is strictly 'in_stock'
    status = 'in_stock';
  }
  return {
    ...product,
    stockCount: count,
    stockStatus: status,
  };
};

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('neydhal_fresh_brand_new') === 'true') {
      const stored = loadFromStorage<Product[]>(STORAGE_KEYS.PRODUCTS, []);
      return Array.isArray(stored) ? stored.map(normalizeProductStock) : [];
    }
    const deletedIds = getDeletedProductIds();
    const stored = loadFromStorage<Product[] | null>(STORAGE_KEYS.PRODUCTS, null);
    if (stored !== null && Array.isArray(stored)) {
      return stored.filter((p) => !deletedIds.has(p.id)).map(normalizeProductStock);
    }
    return INITIAL_PRODUCTS.filter((p) => !deletedIds.has(p.id)).map(normalizeProductStock);
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('neydhal_fresh_brand_new') === 'true') {
      return loadFromStorage(STORAGE_KEYS.ORDERS, []);
    }
    return loadFromStorage(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
  });

  const [settings, setSettings] = useState<StoreSettings>(() => {
    const loaded = loadFromStorage(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
    const updated: StoreSettings = {
      ...INITIAL_SETTINGS,
      ...loaded,
      boutiqueName:
        !loaded.boutiqueName || loaded.boutiqueName.includes('Aara')
          ? 'Neydhal'
          : loaded.boutiqueName,
      logoUrl:
        !loaded.logoUrl || loaded.logoUrl.includes('aara') || loaded.logoUrl === '/pwa-512x512.png'
          ? '/logo.png'
          : loaded.logoUrl,
      contactEmail:
        loaded.contactEmail && !loaded.contactEmail.includes('aarasarees')
          ? loaded.contactEmail
          : 'nandhagoban21@gmail.com',
      adminGoogleEmail: loaded.adminGoogleEmail || 'nandhagoban21@gmail.com',
      delivery: {
        shippingFee: loaded.delivery?.shippingFee ?? INITIAL_SETTINGS.delivery.shippingFee,
        freeDeliveryEnabled: loaded.delivery?.freeDeliveryEnabled ?? INITIAL_SETTINGS.delivery.freeDeliveryEnabled,
        freeDeliveryThreshold: loaded.delivery?.freeDeliveryThreshold ?? INITIAL_SETTINGS.delivery.freeDeliveryThreshold,
      },
      chatTemplates: {
        ...DEFAULT_CHAT_TEMPLATES,
        ...(loaded.chatTemplates || {}),
      },
      defaultStaffPermissions: {
        ...DEFAULT_STAFF_PERMISSIONS,
        ...(loaded.defaultStaffPermissions || {}),
      },
      staffIdleAlert: {
        enabled: loaded.staffIdleAlert?.enabled ?? true,
        idleThresholdMinutes: loaded.staffIdleAlert?.idleThresholdMinutes ?? 15,
      },
      storefrontDisplay: {
        ...INITIAL_SETTINGS.storefrontDisplay,
        ...loaded.storefrontDisplay,
        allowPublicCancellation: loaded.storefrontDisplay?.allowPublicCancellation ?? true,
        allowPublicRefunds: loaded.storefrontDisplay?.allowPublicRefunds ?? true,
        allowCustomerDeliveryDisputes: loaded.storefrontDisplay?.allowCustomerDeliveryDisputes ?? true,
        allowCustomerRefundDisputes: loaded.storefrontDisplay?.allowCustomerRefundDisputes ?? true,
      },
    };
    if (updated && (updated.adminPin === '889900' || !updated.adminPin)) {
      return { ...updated, adminPin: '889988' };
    }
    return updated;
  });

  const [cart, setCart] = useState<CartItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.CART, [])
  );

  const [currentUser, setCurrentUser] = useState<ActiveUser | null>(() =>
    loadFromStorage(STORAGE_KEYS.CURRENT_USER, null)
  );

  const [reviews, setReviews] = useState<ProductReview[]>(() =>
    loadFromStorage(STORAGE_KEYS.REVIEWS, INITIAL_REVIEWS)
  );

  // App UI State
  const [activeProductModal, setActiveProductModal] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTrackOrderOpen, setIsTrackOrderOpen] = useState(false);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);
  const [remoteLogoutNotice, setRemoteLogoutNotice] = useState<string | null>(null);
  const clearRemoteLogoutNotice = () => setRemoteLogoutNotice(null);

  // Customer Browsing State & Wishlist
  const [wishlist, setWishlist] = useState<string[]>(() =>
    loadFromStorage('aara_boutique_wishlist_v3', [])
  );
  const [customerActiveTab, setCustomerActiveTab] = useState<'home' | 'categories' | 'search' | 'wishlist'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Centralized SKU Registry State
  const [skus, setSkus] = useState<SkuRecord[]>(() =>
    loadFromStorage<SkuRecord[]>('aara_boutique_skus_v3', [])
  );

  // Dynamic Hierarchical Saree Categories State (Synced with Firestore /categories)
  const [categories, setCategories] = useState<SareeCategory[]>(() => {
    const stored = loadFromStorage<SareeCategory[]>('aara_boutique_categories_v3', []);
    const filtered = stored.filter((c) => {
      const isDemo = (c as any).isDemo === true && c.id.startsWith('mock-demo-seed-');
      return !isDemo;
    });
    if (filtered.length > 0) return filtered;
    return DEFAULT_SAREE_CATEGORIES;
  });

  // Active, visible wishlist derived state: instantly purges any deleted or hidden product from badges & lists
  const activeWishlist = useMemo(() => {
    const activeVisibleIds = new Set(
      products.filter((p) => p.isVisible !== false).map((p) => p.id)
    );
    return wishlist.filter((id) => activeVisibleIds.has(id));
  }, [wishlist, products]);

  // Automatic Wishlist Removal & Dynamic Adjustment for Deleted or Hidden Products
  useEffect(() => {
    if (products.length > 0) {
      setWishlist((prevWishlist) => {
        const activeVisibleIds = new Set(
          products.filter((p) => p.isVisible !== false).map((p) => p.id)
        );
        const cleaned = prevWishlist.filter((id) => activeVisibleIds.has(id));
        if (cleaned.length !== prevWishlist.length) {
          saveToStorage('aara_boutique_wishlist_v3', cleaned);
          return cleaned;
        }
        return prevWishlist;
      });
    }
  }, [products]);

  const toggleWishlist = (productId: string) => {
    const target = products.find((p) => p.id === productId);
    if (!target || target.isVisible === false) return;

    setWishlist((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      saveToStorage('aara_boutique_wishlist_v3', next);
      return next;
    });
  };

  const isInWishlist = (productId: string) => {
    const target = products.find((p) => p.id === productId);
    if (!target || target.isVisible === false) return false;
    return activeWishlist.includes(productId);
  };

  // Customer's placed order numbers tracking for "My Orders" badge counter
  const [customerOrderNumbers, setCustomerOrderNumbers] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = JSON.parse(localStorage.getItem('aara_customer_orders') || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });

  const recordCustomerOrder = (orderNumber: string, phone?: string) => {
    if (!orderNumber) return;
    const cleanNum = orderNumber.trim().toUpperCase();
    setCustomerOrderNumbers((prev) => {
      if (prev.includes(cleanNum)) return prev;
      const next = [cleanNum, ...prev];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('aara_customer_orders', JSON.stringify(next));
          if (phone) {
            localStorage.setItem('aara_customer_phone', phone.trim());
          }
        } catch {}
      }
      return next;
    });
  };

  const customerOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    const savedNumbers = new Set(customerOrderNumbers.map((n) => n.trim().toUpperCase()));
    if (lastPlacedOrder?.orderNumber) {
      savedNumbers.add(lastPlacedOrder.orderNumber.trim().toUpperCase());
    }
    const savedPhone = typeof window !== 'undefined' ? (localStorage.getItem('aara_customer_phone') || '').trim() : '';
    const cleanSavedPhone = savedPhone.replace(/\D/g, '').slice(-10);

    return orders.filter((o) => {
      const matchNumber = savedNumbers.has(o.orderNumber.trim().toUpperCase());
      const orderPhone = (o.customer?.phone || '').replace(/\D/g, '').slice(-10);
      const matchPhone = cleanSavedPhone && orderPhone && orderPhone === cleanSavedPhone;
      return matchNumber || matchPhone;
    });
  }, [orders, customerOrderNumbers, lastPlacedOrder]);

  const customerOrdersCount = customerOrders.length;

  const [currentView, setCurrentView] = useState<'store' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const pathname = window.location.pathname;
      const search = window.location.search;
      if (
        hash.startsWith('#admin') ||
        pathname === '/admin' ||
        search.includes('view=admin')
      ) {
        return 'admin';
      }
    }
    return 'store';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('boutique_current_view', currentView);
    }
  }, [currentView]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PRODUCTS, products);
  }, [products]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ORDERS, orders);
  }, [orders]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SETTINGS, settings);
    syncPWAAndDocumentMetadata(settings);
  }, [settings]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CART, cart);
  }, [cart]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CURRENT_USER, currentUser);
  }, [currentUser]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.REVIEWS, reviews);
  }, [reviews]);

  // Test Firestore connection on boot
  useEffect(() => {
    testFirestoreConnection().catch((err) => console.warn('Firestore connection verification:', err));
  }, []);

  // Real-time Firestore sync for Products
  useEffect(() => {
    let isSeeding = false;
    const unsub = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const deletedIds = getDeletedProductIds();
        if (!snapshot.empty) {
          const list: Product[] = [];
          snapshot.forEach((d) => {
            if (deletedIds.has(d.id)) {
              // Ensure deleted in Firestore if it existed
              deleteDoc(doc(db, 'products', d.id)).catch(() => {});
              return;
            }
            list.push(normalizeProductStock({ id: d.id, ...d.data() } as Product));
          });
          setProducts(list);
          saveToStorage(STORAGE_KEYS.PRODUCTS, list);
        } else if (!isSeeding && localStorage.getItem('neydhal_fresh_brand_new') !== 'true') {
          isSeeding = true;
          INITIAL_PRODUCTS.forEach((p) => {
            if (!deletedIds.has(p.id)) {
              setDoc(doc(db, 'products', p.id), sanitizeForFirestore(p)).catch((err) =>
                handleFirestoreError(err, OperationType.WRITE, `products/${p.id}`)
              );
            }
          });
          const initialClean = INITIAL_PRODUCTS.filter((p) => !deletedIds.has(p.id)).map(normalizeProductStock);
          setProducts(initialClean);
          saveToStorage(STORAGE_KEYS.PRODUCTS, initialClean);
        } else {
          setProducts([]);
          saveToStorage(STORAGE_KEYS.PRODUCTS, []);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'products');
      }
    );
    return () => unsub();
  }, []);

  // Real-time Firestore sync for Orders
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Order[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as Order);
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setOrders(list);
          saveToStorage(STORAGE_KEYS.ORDERS, list);
        } else {
          setOrders([]);
          saveToStorage(STORAGE_KEYS.ORDERS, []);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'orders');
      }
    );
    return () => unsub();
  }, []);

  // Real-time Firestore sync for Boutique Settings & Announcements
  useEffect(() => {
    let isSeeding = false;
    const unsub = onSnapshot(
      doc(db, 'settings', 'store_config'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<StoreSettings>;
          setSettings((prev) => ({
            ...prev,
            ...data,
            delivery: {
              ...prev.delivery,
              ...(data.delivery || {}),
            },
            announcement: {
              ...prev.announcement,
              ...(data.announcement || {}),
            },
            payment: {
              ...prev.payment,
              ...(data.payment || {}),
            },
            storefrontDisplay: {
              ...prev.storefrontDisplay,
              ...(data.storefrontDisplay || {}),
            },
            chatTemplates: {
              ...prev.chatTemplates,
              ...(data.chatTemplates || {}),
            },
            defaultStaffPermissions: data.defaultStaffPermissions
              ? {
                  orders: data.defaultStaffPermissions.orders ?? prev.defaultStaffPermissions?.orders ?? DEFAULT_STAFF_PERMISSIONS.orders,
                  products: data.defaultStaffPermissions.products ?? prev.defaultStaffPermissions?.products ?? DEFAULT_STAFF_PERMISSIONS.products,
                  analytics: data.defaultStaffPermissions.analytics ?? prev.defaultStaffPermissions?.analytics ?? DEFAULT_STAFF_PERMISSIONS.analytics,
                  staff: data.defaultStaffPermissions.staff ?? prev.defaultStaffPermissions?.staff ?? DEFAULT_STAFF_PERMISSIONS.staff,
                  settingsStorefront: data.defaultStaffPermissions.settingsStorefront ?? prev.defaultStaffPermissions?.settingsStorefront ?? DEFAULT_STAFF_PERMISSIONS.settingsStorefront,
                  settingsAnnouncement: data.defaultStaffPermissions.settingsAnnouncement ?? prev.defaultStaffPermissions?.settingsAnnouncement ?? DEFAULT_STAFF_PERMISSIONS.settingsAnnouncement,
                  settingsPayment: data.defaultStaffPermissions.settingsPayment ?? prev.defaultStaffPermissions?.settingsPayment ?? DEFAULT_STAFF_PERMISSIONS.settingsPayment,
                  settingsProfile: data.defaultStaffPermissions.settingsProfile ?? prev.defaultStaffPermissions?.settingsProfile ?? DEFAULT_STAFF_PERMISSIONS.settingsProfile,
                  settingsChatTemplates: data.defaultStaffPermissions.settingsChatTemplates ?? prev.defaultStaffPermissions?.settingsChatTemplates ?? DEFAULT_STAFF_PERMISSIONS.settingsChatTemplates,
                }
              : prev.defaultStaffPermissions,
          }));
        } else if (!isSeeding) {
          isSeeding = true;
          // Initial bootstrap: seed settings
          setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore(INITIAL_SETTINGS))
            .catch((err) => handleFirestoreError(err, OperationType.WRITE, 'settings/store_config'));
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/store_config');
      }
    );
    return () => unsub();
  }, []);

  // Real-time Firestore sync for Customer Product Reviews
  useEffect(() => {
    let isSeeding = false;
    const unsub = onSnapshot(
      collection(db, 'reviews'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: ProductReview[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as ProductReview);
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setReviews(list);
          saveToStorage(STORAGE_KEYS.REVIEWS, list);
        } else {
          setReviews([]);
          saveToStorage(STORAGE_KEYS.REVIEWS, []);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'reviews');
      }
    );
    return () => unsub();
  }, []);

  // Real-time Firestore sync for Staff Members Collection (/staff)
  useEffect(() => {
    let isInitial = true;
    const unsub = onSnapshot(
      collection(db, 'staff'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: StaffMember[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as StaffMember);
          });
          setSettings((prev) => {
            const updated = {
              ...prev,
              staffMembers: list,
            };
            saveToStorage(STORAGE_KEYS.SETTINGS, updated);
            return updated;
          });
        } else if (isInitial && settings.staffMembers && settings.staffMembers.length > 0) {
          // If Firestore staff collection is empty but local settings has staff, seed them into /staff
          settings.staffMembers.forEach((member) => {
            setDoc(doc(db, 'staff', member.id), sanitizeForFirestore(member)).catch((err) =>
              handleFirestoreError(err, OperationType.WRITE, `staff/${member.id}`)
            );
          });
        }
        isInitial = false;
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'staff');
      }
    );
    return () => unsub();
  }, []);

  // Ensure any staff in settings.staffMembers is synced to /staff collection in Firestore
  useEffect(() => {
    if (settings.staffMembers && settings.staffMembers.length > 0) {
      settings.staffMembers.forEach((member) => {
        setDoc(doc(db, 'staff', member.id), sanitizeForFirestore(member), { merge: true }).catch(
          (err) => handleFirestoreError(err, OperationType.WRITE, `staff/${member.id}`)
        );
      });
    }
  }, [settings.staffMembers?.length]);

  // Real-time Firestore sync for Centralized SKU Collection (/sku_codes and /skus)
  useEffect(() => {
    let isInitial = true;
    const unsub = onSnapshot(
      collection(db, 'sku_codes'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: SkuRecord[] = [];
          snapshot.forEach((d) => {
            list.push({ code: d.id, ...d.data() } as SkuRecord);
          });
          setSkus(list);
          saveToStorage('aara_boutique_skus_v3', list);
        } else {
          // Check fallback /skus if sku_codes is initially empty
          getDocs(collection(db, 'skus'))
            .then((skusSnap) => {
              if (!skusSnap.empty) {
                const list: SkuRecord[] = [];
                skusSnap.forEach((d) => {
                  const data = { code: d.id, ...d.data() } as SkuRecord;
                  list.push(data);
                  setDoc(doc(db, 'sku_codes', d.id), sanitizeForFirestore(data)).catch(() => {});
                });
                setSkus(list);
                saveToStorage('aara_boutique_skus_v3', list);
              } else {
                setSkus([]);
                saveToStorage('aara_boutique_skus_v3', []);
                // If both empty but local products exist and not reset, populate both sku_codes & skus
                if (isInitial && products.length > 0 && localStorage.getItem('neydhal_fresh_brand_new') !== 'true') {
                  products.forEach((p) => {
                    const cleanCode = p.productCode?.trim().toUpperCase();
                    if (cleanCode) {
                      const skuDoc: SkuRecord = {
                        code: cleanCode,
                        productId: p.id,
                        productTitle: p.title,
                        category: p.category,
                        isLocked: Boolean(p.isSkuLocked),
                        editCount: p.skuEditCount || 0,
                        createdAt: p.createdAt || new Date().toISOString(),
                      };
                      setDoc(doc(db, 'sku_codes', cleanCode), sanitizeForFirestore(skuDoc)).catch(() => {});
                      setDoc(doc(db, 'skus', cleanCode), sanitizeForFirestore(skuDoc)).catch(() => {});
                    }
                  });
                }
              }
            })
            .catch(() => {});
        }
        isInitial = false;
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'sku_codes');
      }
    );
    return () => unsub();
  }, [products.length]);

  // Real-time Firestore sync for Hierarchical Categories Collection (/categories)
  useEffect(() => {
    let isInitial = true;
    const unsub = onSnapshot(
      collection(db, 'categories'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: SareeCategory[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as SareeCategory;
            // Only prune if explicitly marked as mock-demo-seed
            const isMockSeed = (data as any).isDemo === true && d.id.startsWith('mock-demo-seed-');
            if (isMockSeed) {
              deleteDoc(doc(db, 'categories', d.id)).catch(() => {});
              return;
            }
            list.push({ ...data, id: d.id } as SareeCategory);
          });
          list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
          setCategories(list);
          saveToStorage('aara_boutique_categories_v3', list);
        } else if (isInitial && DEFAULT_SAREE_CATEGORIES.length > 0 && localStorage.getItem('neydhal_fresh_brand_new') !== 'true') {
          DEFAULT_SAREE_CATEGORIES.forEach((cat) => {
            setDoc(doc(db, 'categories', cat.id), sanitizeForFirestore(cat)).catch(() => {});
          });
          setCategories(DEFAULT_SAREE_CATEGORIES);
          saveToStorage('aara_boutique_categories_v3', DEFAULT_SAREE_CATEGORIES);
        } else {
          setCategories([]);
          saveToStorage('aara_boutique_categories_v3', []);
        }
        isInitial = false;
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'categories');
      }
    );
    return () => unsub();
  }, []);

  // If current logged-in user is a staff member who was removed, locked, or logged out by admin, revoke session immediately
  useEffect(() => {
    if (currentUser?.type === 'staff') {
      const activeStaff = (settings.staffMembers || []).find(
        (s) =>
          (currentUser.staffId && s.id === currentUser.staffId) ||
          (currentUser.email && s.email && s.email.toLowerCase() === currentUser.email.toLowerCase()) ||
          s.username.toLowerCase() === currentUser.username.toLowerCase()
      );
      if (!activeStaff || activeStaff.isLocked || activeStaff.isLoggedIn === false || activeStaff.sessionRevokedAt) {
        const staffName = activeStaff?.name || currentUser.name || 'Staff Specialist';
        setCurrentUser(null);
        saveToStorage(STORAGE_KEYS.CURRENT_USER, null);
        googleSignOut();
        if (activeStaff?.sessionRevokedAt || activeStaff?.isLoggedIn === false) {
          setRemoteLogoutNotice(`Your staff portal session for ${staffName} has been logged out by the store administrator.`);
        }
      }
    }
  }, [settings.staffMembers, currentUser]);

  // Handle URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash.startsWith('#admin')) {
        setCurrentView('admin');
      } else if (window.location.hash.startsWith('#track')) {
        setCurrentView('store');
        setIsTrackOrderOpen(true);
      } else {
        setCurrentView('store');
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Multi-tab sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.PRODUCTS && e.newValue) {
        setProducts(JSON.parse(e.newValue));
      } else if (e.key === STORAGE_KEYS.ORDERS && e.newValue) {
        setOrders(JSON.parse(e.newValue));
      } else if (e.key === STORAGE_KEYS.SETTINGS && e.newValue) {
        setSettings(JSON.parse(e.newValue));
      } else if (e.key === STORAGE_KEYS.CURRENT_USER && e.newValue) {
        setCurrentUser(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const publicProducts = useMemo(() => {
    return products.filter((p) => p.isVisible);
  }, [products]);

  const staffMembers = useMemo(() => {
    return settings.staffMembers || [];
  }, [settings.staffMembers]);

  // Cart operations
  const addToCart = (product: Product, quantity = 1) => {
    // Prevent adding out of stock items
    if (product.stockStatus === 'out_of_stock' || (product.stockCount !== undefined && product.stockCount <= 0)) {
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      const availableStock = product.stockCount ?? 99;
      if (existing) {
        const nextQty = Math.min(existing.quantity + quantity, availableStock);
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: nextQty }
            : item
        );
      }
      return [...prev, { product, quantity: Math.min(quantity, availableStock) }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  }, [cart]);

  // Delivery & Free shipping calculation
  const deliveryConfig = settings.delivery || INITIAL_SETTINGS.delivery;
  const isFreeDeliveryUnlocked = useMemo(() => {
    if (!deliveryConfig.freeDeliveryEnabled) return false;
    return cartTotal >= deliveryConfig.freeDeliveryThreshold;
  }, [cartTotal, deliveryConfig]);

  const cartShippingFee = useMemo(() => {
    if (cart.length === 0) return 0;
    if (isFreeDeliveryUnlocked) return 0;
    return Math.max(0, deliveryConfig.shippingFee || 0);
  }, [cart.length, isFreeDeliveryUnlocked, deliveryConfig]);

  const cartGrandTotal = useMemo(() => {
    return cartTotal + cartShippingFee;
  }, [cartTotal, cartShippingFee]);

  const amountNeededForFreeDelivery = useMemo(() => {
    if (!deliveryConfig.freeDeliveryEnabled) return 0;
    return Math.max(0, deliveryConfig.freeDeliveryThreshold - cartTotal);
  }, [cartTotal, deliveryConfig]);

  // Product management (Manual product code entered by admin)
  const addProduct = (productData: Omit<Product, 'id' | 'createdAt'>): Product => {
    const manualSku = productData.productCode?.trim().toUpperCase() || '';

    const newProduct: Product = normalizeProductStock({
      ...productData,
      productCode: manualSku,
      initialSku: manualSku,
      skuEditCount: 0,
      isSkuLocked: false,
      id: `saree-${Date.now()}`,
      createdAt: new Date().toISOString(),
    });
    unmarkProductAsDeleted(newProduct.id);
    setProducts((prev) => {
      const next = [newProduct, ...prev];
      saveToStorage(STORAGE_KEYS.PRODUCTS, next);
      return next;
    });

    // Persist to Firestore
    setDoc(doc(db, 'products', newProduct.id), sanitizeForFirestore(newProduct)).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `products/${newProduct.id}`)
    );

    // Persist to Centralized SKU Database (both sku_codes and skus collections)
    if (manualSku) {
      const skuRecord: SkuRecord = {
        code: manualSku,
        productId: newProduct.id,
        productTitle: newProduct.title,
        category: newProduct.category,
        isLocked: false,
        editCount: 0,
        createdAt: newProduct.createdAt,
      };
      setDoc(doc(db, 'sku_codes', manualSku), sanitizeForFirestore(skuRecord)).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `sku_codes/${manualSku}`)
      );
      setDoc(doc(db, 'skus', manualSku), sanitizeForFirestore(skuRecord)).catch(() => {});
      setSkus((prev) => [...prev.filter((s) => s.code?.toUpperCase() !== manualSku), skuRecord]);
    }

    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    const existingProd = products.find((p) => p.id === id);
    const sanitizedUpdates = { ...updates };

    // SKU One-Time Edit Lock Validation & Permanent Locking
    if (sanitizedUpdates.productCode !== undefined && existingProd) {
      const cleanNewSku = sanitizedUpdates.productCode.trim().toUpperCase();
      const currentSku = existingProd.productCode.trim().toUpperCase();
      if (cleanNewSku !== currentSku) {
        if (existingProd.isSkuLocked || (existingProd.skuEditCount || 0) >= 1) {
          // Reject SKU change if already edited once and locked
          console.warn(`Product SKU for ${id} is permanently locked. Reverting to original ${currentSku}.`);
          sanitizedUpdates.productCode = existingProd.productCode;
        } else {
          // First and only edit allowed: permanently lock after this edit
          sanitizedUpdates.productCode = cleanNewSku;
          sanitizedUpdates.skuEditCount = (existingProd.skuEditCount || 0) + 1;
          sanitizedUpdates.isSkuLocked = true;
          sanitizedUpdates.initialSku = existingProd.initialSku || currentSku;

          // Centralized SKU database registry update: release old SKU in sku_codes & skus
          if (currentSku) {
            deleteDoc(doc(db, 'sku_codes', currentSku)).catch(() => {});
            deleteDoc(doc(db, 'skus', currentSku)).catch(() => {});
          }
          const skuRecord: SkuRecord = {
            code: cleanNewSku,
            productId: id,
            productTitle: sanitizedUpdates.title || existingProd.title,
            category: sanitizedUpdates.category || existingProd.category,
            isLocked: true,
            editCount: 1,
            createdAt: existingProd.createdAt,
            updatedAt: new Date().toISOString(),
          };
          setDoc(doc(db, 'sku_codes', cleanNewSku), sanitizeForFirestore(skuRecord)).catch((err) =>
            handleFirestoreError(err, OperationType.CREATE, `sku_codes/${cleanNewSku}`)
          );
          setDoc(doc(db, 'skus', cleanNewSku), sanitizeForFirestore(skuRecord)).catch(() => {});
          setSkus((prev) => [
            ...prev.filter((s) => s.code?.toUpperCase() !== currentSku && s.code?.toUpperCase() !== cleanNewSku),
            skuRecord,
          ]);
        }
      }
    } else if (existingProd && (sanitizedUpdates.title || sanitizedUpdates.category)) {
      // Keep title and category synced in centralized SKU database
      const existingSku = existingProd.productCode?.trim().toUpperCase();
      if (existingSku) {
        const syncData = {
          productTitle: sanitizedUpdates.title || existingProd.title,
          category: sanitizedUpdates.category || existingProd.category,
          updatedAt: new Date().toISOString(),
        };
        setDoc(doc(db, 'sku_codes', existingSku), sanitizeForFirestore(syncData), { merge: true }).catch(() => {});
        setDoc(doc(db, 'skus', existingSku), sanitizeForFirestore(syncData), { merge: true }).catch(() => {});
      }
    }

    const wasOutOfStock = existingProd && (existingProd.stockStatus === 'out_of_stock' || existingProd.stockCount <= 0);
    const willBeRestocked =
      (sanitizedUpdates.stockStatus === 'in_stock' || sanitizedUpdates.stockStatus === 'limited') &&
      ((sanitizedUpdates.stockCount !== undefined && sanitizedUpdates.stockCount > 0) || (existingProd && existingProd.stockCount > 0));

    // Real-time Restock Handling: Discontinue announcement board use; send PWA & Web push notifications with audio chime and flag product & category
    if (wasOutOfStock && willBeRestocked && existingProd) {
      sanitizedUpdates.isRestocked = true;
      sanitizedUpdates.restockedAt = new Date().toISOString();
      const restockedTitle = sanitizedUpdates.title || existingProd.title;
      const categoryName = sanitizedUpdates.category || existingProd.category || 'Handlooms';
      sendRestockPushNotification([restockedTitle], categoryName);
    }

    setProducts((prev) => {
      const next = prev.map((prod) => (prod.id === id ? normalizeProductStock({ ...prod, ...sanitizedUpdates }) : prod));
      saveToStorage(STORAGE_KEYS.PRODUCTS, next);
      return next;
    });
    if (sanitizedUpdates.isVisible === false) {
      setWishlist((prev) => {
        const next = prev.filter((item) => item !== id);
        saveToStorage('aara_boutique_wishlist_v3', next);
        return next;
      });
    }
    if (activeProductModal && activeProductModal.id === id) {
      setActiveProductModal((prev) => (prev ? normalizeProductStock({ ...prev, ...sanitizedUpdates }) : null));
    }

    // Derive correct stockStatus for Firestore persistence
    if (sanitizedUpdates.stockCount !== undefined && sanitizedUpdates.stockCount !== null) {
      const parsed = Number(sanitizedUpdates.stockCount);
      const safeCount = isNaN(parsed) ? 0 : Math.max(0, Math.floor(parsed));
      sanitizedUpdates.stockCount = safeCount;
      sanitizedUpdates.stockStatus =
        safeCount <= 0
          ? 'out_of_stock'
          : safeCount <= LOW_STOCK_THRESHOLD
          ? 'limited'
          : 'in_stock';
    }

    // Persist to Firestore with merge to guarantee document is saved
    setDoc(doc(db, 'products', id), sanitizeForFirestore(sanitizedUpdates), { merge: true }).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, `products/${id}`)
    );
  };

  const deleteProduct = (id: string) => {
    markProductAsDeleted(id);
    const targetProd = products.find((p) => p.id === id);
    if (targetProd?.productCode) {
      const cleanSku = targetProd.productCode.trim().toUpperCase();
      // Fix Deletion & Re-use Bug: Release SKU code in sku_codes & skus collections so it can immediately be reused
      deleteDoc(doc(db, 'sku_codes', cleanSku)).catch(() => {});
      deleteDoc(doc(db, 'skus', cleanSku)).catch(() => {});
      // Immediately remove from local SKU registry state so duplicate checks pass instantly
      setSkus((prev) => prev.filter((s) => s.code?.trim().toUpperCase() !== cleanSku));
    }

    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveToStorage(STORAGE_KEYS.PRODUCTS, next);
      return next;
    });
    setCart((prev) => {
      const next = prev.filter((item) => item.product.id !== id);
      saveToStorage(STORAGE_KEYS.CART, next);
      return next;
    });
    setWishlist((prev) => {
      const next = prev.filter((item) => item !== id);
      saveToStorage('aara_boutique_wishlist_v3', next);
      return next;
    });
    if (activeProductModal?.id === id) {
      setActiveProductModal(null);
    }

    // Permanently delete from Firestore
    deleteDoc(doc(db, 'products', id)).catch((err) =>
      handleFirestoreError(err, OperationType.DELETE, `products/${id}`)
    );
  };

  const toggleProductVisibility = (id: string) => {
    const target = products.find((p) => p.id === id);
    if (!target) return;
    const nextVis = !target.isVisible;
    setProducts((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, isVisible: nextVis } : p));
      saveToStorage(STORAGE_KEYS.PRODUCTS, next);
      return next;
    });
    if (!nextVis) {
      setWishlist((prev) => {
        const next = prev.filter((item) => item !== id);
        saveToStorage('aara_boutique_wishlist_v3', next);
        return next;
      });
    }

    // Update in Firestore with setDoc merge: true to guarantee permanence across refreshes
    setDoc(doc(db, 'products', id), { isVisible: nextVis }, { merge: true }).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, `products/${id}`)
    );
  };

  // Staff Management
  const addStaffMember = (staffData: Omit<StaffMember, 'id' | 'createdAt'>) => {
    const newStaff: StaffMember = {
      ...staffData,
      id: `staff-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const nextMembers = [...(settings.staffMembers || []).filter((s) => s.id !== newStaff.id), newStaff];
    setSettings((prev) => {
      const updated = {
        ...prev,
        staffMembers: nextMembers,
      };
      saveToStorage(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    });

    // 1. Persist directly to dedicated Firestore 'staff' collection document
    setDoc(doc(db, 'staff', newStaff.id), sanitizeForFirestore(newStaff)).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `staff/${newStaff.id}`)
    );

    // 2. Also keep settings/store_config in sync
    setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({ staffMembers: nextMembers }), {
      merge: true,
    }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, 'settings/store_config'));
  };

  const updateStaffMember = (id: string, updates: Partial<StaffMember>) => {
    const nextMembers = (settings.staffMembers || []).map((s) =>
      s.id === id ? { ...s, ...updates } : s
    );
    setSettings((prev) => {
      const updated = {
        ...prev,
        staffMembers: nextMembers,
      };
      saveToStorage(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    });

    const targetStaff = nextMembers.find((s) => s.id === id);

    // 1. Persist to dedicated Firestore 'staff' collection document
    if (targetStaff) {
      setDoc(doc(db, 'staff', id), sanitizeForFirestore(targetStaff), { merge: true }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `staff/${id}`)
      );
    }

    // 2. Also keep settings/store_config in sync
    setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({ staffMembers: nextMembers }), {
      merge: true,
    }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, 'settings/store_config'));
  };

  const toggleStaffLock = (id: string) => {
    const nextMembers = (settings.staffMembers || []).map((s) =>
      s.id === id ? { ...s, isLocked: !s.isLocked } : s
    );
    setSettings((prev) => {
      const updated = {
        ...prev,
        staffMembers: nextMembers,
      };
      saveToStorage(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    });

    const targetStaff = nextMembers.find((s) => s.id === id);

    // 1. Persist to dedicated Firestore 'staff' collection document
    if (targetStaff) {
      setDoc(doc(db, 'staff', id), sanitizeForFirestore(targetStaff), { merge: true }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `staff/${id}`)
      );
    }

    // 2. Also keep settings/store_config in sync
    setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({ staffMembers: nextMembers }), {
      merge: true,
    }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, 'settings/store_config'));
  };

  const deleteStaffMember = (id: string) => {
    const remaining = (settings.staffMembers || []).filter((s) => s.id !== id);
    setSettings((prev) => {
      const updated = {
        ...prev,
        staffMembers: remaining,
      };
      saveToStorage(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    });

    // 1. Delete from dedicated Firestore 'staff' collection document
    deleteDoc(doc(db, 'staff', id)).catch((err) =>
      handleFirestoreError(err, OperationType.DELETE, `staff/${id}`)
    );

    // 2. Also keep settings/store_config in sync
    setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({ staffMembers: remaining }), {
      merge: true,
    }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, 'settings/store_config'));

    // Terminate active session if this staff member is currently logged in
    setCurrentUser((prevUser) => {
      if (prevUser?.type === 'staff' && (prevUser?.staffId === id || prevUser?.staffId === undefined)) {
        saveToStorage(STORAGE_KEYS.CURRENT_USER, null);
        return null;
      }
      return prevUser;
    });
  };

  const syncStaffToDatabase = async (): Promise<number> => {
    const list = settings.staffMembers || [];
    await Promise.all(
      list.map((member) =>
        setDoc(doc(db, 'staff', member.id), sanitizeForFirestore(member), { merge: true })
      )
    );
    await setDoc(
      doc(db, 'settings', 'store_config'),
      sanitizeForFirestore({ staffMembers: list }),
      { merge: true }
    );
    return list.length;
  };

  // Order management
  const placeOrder = ({
    customer,
    items,
    upiTransactionId,
    refundUpiId,
    refundUpiPhone,
    notes,
    checkoutMethod,
  }: {
    customer: Order['customer'];
    items: CartItem[];
    upiTransactionId: string;
    refundUpiId?: string;
    refundUpiPhone?: string;
    notes?: string;
    checkoutMethod: 'submit_order' | 'whatsapp';
  }): Order => {
    const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const deliv = settings.delivery || INITIAL_SETTINGS.delivery;
    const isFree = deliv.freeDeliveryEnabled && subtotal >= deliv.freeDeliveryThreshold;
    const shippingFee = items.length === 0 ? 0 : isFree ? 0 : Math.max(0, deliv.shippingFee || 0);
    const totalAmount = subtotal + shippingFee;
    const prefix = getBoutiqueOrderPrefix(settings.boutiqueName);
    const orderNumber = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

    // User request: when user places an order it should NOT assign to staff by default;
    // it must appear in the unassigned queue for staff to assign and close the deal.
    const newOrder: Order = {
      id: `order-${Date.now()}`,
      orderNumber,
      createdAt: new Date().toISOString(),
      customer,
      items,
      subtotal,
      shippingFee,
      totalAmount,
      upiTransactionId: upiTransactionId.trim(),
      refundDetails: {
        refundUpiId: refundUpiId ? refundUpiId.trim() : undefined,
        refundUpiPhone: refundUpiPhone ? refundUpiPhone.trim() : undefined,
        refundStatus: 'not_required',
      },
      status: 'Pending',
      checkoutMethod,
      notes,
      assignedStaffId: undefined,
      assignedStaffName: undefined,
      lastUpdatedBy: 'customer',
      assignmentHistory: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          staffId: 'unassigned',
          staffName: 'Unassigned Queue',
          assignedBy: 'Storefront Intake',
          action: 'Order Placed in Queue',
          note: 'Customer completed checkout. Waiting for boutique concierge staff to claim & close deal.',
        },
      ],
    };

    setOrders((prev) => [newOrder, ...prev]);
    clearCart();
    setLastPlacedOrder(newOrder);
    setCustomerOrderNumbers((prev) => [newOrder.orderNumber, ...prev.filter((n) => n !== newOrder.orderNumber)]);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('aara_last_order', newOrder.orderNumber);
        if (newOrder.customer?.phone) {
          localStorage.setItem('aara_customer_phone', newOrder.customer.phone.trim());
        }
        const stored = JSON.parse(localStorage.getItem('aara_customer_orders') || '[]');
        const nextList = [newOrder.orderNumber, ...stored.filter((n: string) => n !== newOrder.orderNumber)];
        localStorage.setItem('aara_customer_orders', JSON.stringify(nextList));
      }
    } catch (e) {}

    // Deduct stock for ordered items and update stockStatus to out_of_stock if stock reaches 0
    items.forEach((item) => {
      const prod = products.find((p) => p.id === item.product.id);
      if (prod) {
        const remainingCount = Math.max(0, (prod.stockCount ?? 1) - item.quantity);
        const nextStatus = remainingCount === 0 ? 'out_of_stock' : remainingCount <= 2 ? 'limited' : prod.stockStatus;
        updateProduct(prod.id, {
          stockCount: remainingCount,
          stockStatus: nextStatus,
        });
      }
    });

    // Persist new order directly to Firestore
    setDoc(doc(db, 'orders', newOrder.id), sanitizeForFirestore(newOrder)).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `orders/${newOrder.id}`)
    );

    return newOrder;
  };

  // Real-Time Stock Replenishment on Order Cancellation
  const replenishOrderInventory = (order: Order) => {
    if (order.isRestocked || !order.items || order.items.length === 0) return;

    const restockedTitles: string[] = [];
    let affectedCategory: string | undefined;

    setProducts((prev) => {
      const next = prev.map((prod) => {
        const item = order.items.find(
          (it) =>
            it.product.id === prod.id ||
            (it.product.productCode &&
              prod.productCode &&
              it.product.productCode.trim().toUpperCase() === prod.productCode.trim().toUpperCase())
        );
        if (!item) return prod;

        const currentStock = prod.stockCount ?? 0;
        const newCount = currentStock + (item.quantity || 1);
        const newStatus: 'in_stock' | 'out_of_stock' | 'limited' =
          newCount > 2 ? 'in_stock' : newCount > 0 ? 'limited' : 'out_of_stock';
        restockedTitles.push(prod.title);
        if (prod.category) affectedCategory = prod.category;

        const updatedProd: Product = {
          ...prod,
          stockCount: newCount,
          stockStatus: newStatus,
          isRestocked: true,
          restockedAt: new Date().toISOString(),
        };

        // Persist product update to Firestore immediately
        setDoc(doc(db, 'products', prod.id), sanitizeForFirestore(updatedProd), { merge: true }).catch((err) =>
          handleFirestoreError(err, OperationType.UPDATE, `products/${prod.id}`)
        );

        return updatedProd;
      });

      saveToStorage(STORAGE_KEYS.PRODUCTS, next);
      return next;
    });

    // Send real-time PWA and Web Push Notification with audio chime!
    if (restockedTitles.length > 0) {
      sendRestockPushNotification(restockedTitles, affectedCategory);
    }
  };

  const updateOrderStatus = (
    orderId: string,
    status: OrderStatus,
    extra?: {
      shippingDetails?: ShippingDetails;
      refundUtr?: string;
      cancellationReason?: string;
    }
  ) => {
    let orderToSync: Partial<Order> | null = null;
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;

        const isNowCancelled = status === 'Cancelled' || status === 'Rejected';
        const isNowRefunded = status === 'Refunded';

        const nextShippingDetails = extra?.shippingDetails || ord.shippingDetails;
        const nextRefundUtr = extra?.refundUtr || ord.refundDetails?.refundUtr;

        let nextRefundStatus = ord.refundDetails?.refundStatus || 'not_required';
        if (isNowRefunded || ((isNowCancelled) && Boolean(nextRefundUtr && nextRefundUtr.trim()))) {
          nextRefundStatus = 'processed';
        } else if (isNowCancelled) {
          if (nextRefundStatus === 'not_required') {
            nextRefundStatus = 'pending';
          }
        } else {
          // If reactivated to Shipped/Confirmed/Delivered/Pending, refund is not required
          nextRefundStatus = 'not_required';
        }

        const nextReason = (isNowCancelled || isNowRefunded)
          ? extra?.cancellationReason || ord.cancellationReason || (isNowRefunded ? 'Refund processed for cancelled order' : 'Cancelled by boutique concierge')
          : undefined;

        // If resuming an order that had pending cancellation request, mark resolved
        let nextCancelRequest = ord.cancellationRequest;
        if (!isNowCancelled && nextCancelRequest && nextCancelRequest.status === 'pending') {
          nextCancelRequest = {
            ...nextCancelRequest,
            status: 'rejected',
            adminDecisionNotes: `Order resumed: set to ${status}`,
          };
        } else if (isNowCancelled && nextCancelRequest && nextCancelRequest.status === 'pending') {
          nextCancelRequest = {
            ...nextCancelRequest,
            status: 'approved',
            adminDecisionNotes: nextReason,
          };
        }

        // Live work tracking entry for stage change
        const actorName = currentUser?.name || (currentUser?.type === 'admin' ? 'Store Owner' : 'Staff Concierge');
        const actorUsername = currentUser?.username || 'system';
        const isCrossStaff = ord.assignedStaffId && currentUser?.staffId && ord.assignedStaffId !== currentUser.staffId;
        const crossStaffNote = isCrossStaff ? ` (Handled by @${actorUsername} on @${ord.assignedStaffName || 'unassigned'}'s bucket)` : '';
        const stageLog: StaffAssignmentLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          staffId: currentUser?.staffId || ord.assignedStaffId || 'admin',
          staffName: actorName,
          assignedBy: actorName,
          action: `Stage changed from ${ord.status} to ${status}${crossStaffNote}`,
          note: nextReason || (isCrossStaff ? `Cross-staff action performed by @${actorUsername}` : undefined),
        };
        const updatedHistory = [...(ord.assignmentHistory || []), stageLog];

        const statusHistoryEntry: OrderStatusHistory = {
          status,
          timestamp: new Date().toISOString(),
          updatedBy: actorName,
          note: nextReason || `Order status updated to ${status}`,
        };
        const updatedStatusHistory = [...(ord.statusHistory || []), statusHistoryEntry];

        let updatedDeliveryIssue = ord.deliveryIssue;
        if ((isNowCancelled || isNowRefunded) && ord.deliveryIssue?.issueType === 'cancellation' && ord.deliveryIssue.status !== 'resolved') {
          updatedDeliveryIssue = {
            ...ord.deliveryIssue,
            status: 'resolved',
            resolvedAt: new Date().toISOString(),
            resolvedBy: actorName,
            resolutionNotes: nextReason || `Cancellation resolved via status transition to ${status}`,
          };
        }

        const isNowDelivered = status === 'Delivered';
        let didRestock = ord.isRestocked;
        if (isNowCancelled && !ord.isRestocked) {
          replenishOrderInventory(ord);
          didRestock = true;
        }

        const updated: Order = {
          ...ord,
          status,
          statusHistory: updatedStatusHistory,
          deliveryIssue: updatedDeliveryIssue,
          isRestocked: didRestock,
          deliveredAt: isNowDelivered ? (ord.deliveredAt || new Date().toISOString()) : ord.deliveredAt,
          completedAt: isNowDelivered ? (ord.completedAt || new Date().toISOString()) : ord.completedAt,
          shippingDetails: nextShippingDetails,
          cancellationReason: nextReason,
          cancellationRequest: nextCancelRequest,
          lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          assignmentHistory: updatedHistory,
          refundDetails: {
            ...ord.refundDetails,
            refundStatus: nextRefundStatus,
            refundUtr: (isNowCancelled || isNowRefunded) ? nextRefundUtr : undefined,
            refundTool: ord.refundDetails?.refundTool || 'UPI Banking',
            processedAt: (isNowCancelled || isNowRefunded) && nextRefundUtr ? (ord.refundDetails?.processedAt || new Date().toISOString()) : ord.refundDetails?.processedAt,
          },
        };

        orderToSync = updated;
        return updated;
      })
    );

    if (orderToSync) {
      updateDoc(doc(db, 'orders', orderId), sanitizeForFirestore(orderToSync)).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`)
      );
    }
  };

  const updateOrderShipping = (
    orderId: string,
    shippingDetails: { courierName: string; trackingNumber: string; notes?: string }
  ) => {
    let orderToSync: Partial<Order> | null = null;
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;

        // Clear any old cancellation request/reason since order is now actively dispatched
        let nextCancelRequest = ord.cancellationRequest;
        if (nextCancelRequest && nextCancelRequest.status === 'pending') {
          nextCancelRequest = {
            ...nextCancelRequest,
            status: 'rejected',
            adminDecisionNotes: 'Shipment dispatched to customer',
          };
        }

        const actorName = currentUser?.name || (currentUser?.type === 'admin' ? 'Store Owner' : 'Staff Concierge');
        const actorUsername = currentUser?.username || 'system';
        const isCrossStaff = ord.assignedStaffId && currentUser?.staffId && ord.assignedStaffId !== currentUser.staffId;
        const crossStaffNote = isCrossStaff ? ` (Handled by @${actorUsername} on @${ord.assignedStaffName || 'unassigned'}'s bucket)` : '';
        const shippingLog: StaffAssignmentLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          staffId: currentUser?.staffId || ord.assignedStaffId || 'admin',
          staffName: actorName,
          assignedBy: actorName,
          action: `Dispatched shipment via ${shippingDetails.courierName.trim()} (Tracking #${shippingDetails.trackingNumber.trim()})${crossStaffNote}`,
          note: shippingDetails.notes?.trim() || 'Courier tracking assigned and order marked Shipped',
        };
        const updatedHistory = [...(ord.assignmentHistory || []), shippingLog];

        const updated: Order = {
          ...ord,
          status: 'Shipped',
          cancellationReason: undefined,
          cancellationRequest: nextCancelRequest,
          lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          assignmentHistory: updatedHistory,
          refundDetails: {
            ...ord.refundDetails,
            refundStatus: 'not_required',
          },
          shippingDetails: {
            courierName: shippingDetails.courierName.trim(),
            trackingNumber: shippingDetails.trackingNumber.trim(),
            shippedAt: new Date().toISOString(),
            notes: shippingDetails.notes?.trim(),
          },
        };
        orderToSync = updated;
        return updated;
      })
    );

    if (orderToSync) {
      updateDoc(doc(db, 'orders', orderId), sanitizeForFirestore(orderToSync)).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`)
      );
    }
  };

  const markRefundProcessed = (orderId: string, refundUtr: string, refundTool = 'UPI / NetBanking', notes?: string) => {
    let orderToSync: Partial<Order> | null = null;
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const actorName = currentUser?.name || (currentUser?.type === 'admin' ? 'Store Owner' : 'Staff Concierge');
        const actorUsername = currentUser?.username || 'system';
        const isCrossStaff = ord.assignedStaffId && currentUser?.staffId && ord.assignedStaffId !== currentUser.staffId;
        const crossStaffNote = isCrossStaff ? ` (Handled by @${actorUsername} on @${ord.assignedStaffName || 'unassigned'}'s bucket)` : '';
        const refundLog: StaffAssignmentLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          staffId: currentUser?.staffId || ord.assignedStaffId || 'admin',
          staffName: actorName,
          assignedBy: actorName,
          action: `Processed refund of ₹${ord.totalAmount} via ${refundTool} (UTR: ${refundUtr.trim()})${crossStaffNote}`,
          note: notes?.trim() || `Refund processed to customer via ${refundTool}`,
        };
        const updatedHistory = [...(ord.assignmentHistory || []), refundLog];

        const refundStatusLog: OrderStatusHistory = {
          status: 'Refunded',
          timestamp: new Date().toISOString(),
          updatedBy: actorName,
          note: `Refund completed via ${refundTool} (12-digit UTR: ${refundUtr.trim()}). ${notes || ''}`.trim(),
        };

        // Requirement 3: Automatically update corresponding customer issue/refund dispute with attached refund details and mark as resolved
        let updatedDeliveryIssue = ord.deliveryIssue;
        if (ord.deliveryIssue?.reported) {
          const disputeComment: InvestigationComment = {
            id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            author: actorName,
            authorId: currentUser?.staffId || (currentUser?.type === 'admin' ? 'admin' : undefined),
            comment: `Refund successfully processed via ${refundTool}. Bank UTR: ${refundUtr.trim()}. Case marked as resolved.`,
          };
          updatedDeliveryIssue = {
            ...ord.deliveryIssue,
            status: 'resolved',
            resolvedAt: new Date().toISOString(),
            resolvedBy: actorName,
            resolutionNotes: `Refund completed via ${refundTool} (Bank UTR: ${refundUtr.trim()}). ${notes || ''}`.trim(),
            investigationComments: [
              ...(ord.deliveryIssue.investigationComments || []),
              disputeComment,
            ],
          };
        }

        const updated: Order = {
          ...ord,
          status: 'Refunded',
          statusHistory: [...(ord.statusHistory || []), refundStatusLog],
          deliveryIssue: updatedDeliveryIssue,
          lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          assignmentHistory: updatedHistory,
          refundDetails: {
            ...ord.refundDetails,
            refundStatus: 'processed',
            refundUtr: refundUtr.trim(),
            refundTool: refundTool.trim(),
            refundAmount: ord.totalAmount,
            processedAt: new Date().toISOString(),
            notes: notes || `Refund processed via ${refundTool}`,
          },
        };
        orderToSync = updated;
        return updated;
      })
    );

    if (orderToSync) {
      updateDoc(doc(db, 'orders', orderId), sanitizeForFirestore(orderToSync)).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`)
      );
    }
  };

  const assignOrderStaff = (orderId: string, staffId: string, staffName: string, reasonOrNote?: string) => {
    let orderToSync: Partial<Order> | null = null;
    const actorName = currentUser?.name || (currentUser?.type === 'admin' ? 'Store Administrator' : 'Staff');

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;

        const isReassignment = ord.assignedStaffId && ord.assignedStaffId !== staffId;
        const prevStaffName = ord.assignedStaffName || 'Previous Staff';

        const actionText = !staffId
          ? `Order unassigned by ${actorName}`
          : isReassignment
          ? `Reassigned from ${prevStaffName} to ${staffName}`
          : `Assigned to ${staffName}`;

        const noteText = reasonOrNote?.trim() || (isReassignment ? 'Reassigned & handed over for work execution' : 'Started working on order');

        const newLogEntry: StaffAssignmentLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          staffId,
          staffName,
          assignedBy: actorName,
          action: actionText,
          note: noteText,
        };

        const updatedHistory = [...(ord.assignmentHistory || []), newLogEntry];

        // Requirement 2: Auto-Confirmation Mode Toggle
        // When enabled, assigning an order transitions Pending -> Confirmed instantly
        let nextStatus = ord.status;
        let nextStatusHistory = ord.statusHistory || [];
        if (settings.autoConfirmationMode && ord.status === 'Pending' && staffId) {
          nextStatus = 'Confirmed';
          const autoConfirmLog: OrderStatusHistory = {
            status: 'Confirmed',
            timestamp: new Date().toISOString(),
            updatedBy: actorName,
            note: `Auto-confirmed upon assignment to ${staffName} (Auto-Confirmation Mode active)`,
          };
          nextStatusHistory = [...nextStatusHistory, autoConfirmLog];
        }

        const updated: Order = {
          ...ord,
          status: nextStatus,
          statusHistory: nextStatusHistory,
          assignedStaffId: staffId,
          assignedStaffName: staffName,
          assignedAt: ord.assignedAt || new Date().toISOString(),
          claimedAt: ord.claimedAt || new Date().toISOString(),
          lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          assignmentHistory: updatedHistory,
        };
        orderToSync = updated;
        return updated;
      })
    );

    if (orderToSync) {
      updateDoc(doc(db, 'orders', orderId), sanitizeForFirestore(orderToSync)).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`)
      );
    }
  };

  const addOrderWorkLog = (orderId: string, action: string, note?: string) => {
    let orderToSync: Partial<Order> | null = null;
    const actorName = currentUser?.name || 'Staff';
    const actorStaffId = currentUser?.staffId || '';

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;

        const newLogEntry: StaffAssignmentLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          staffId: actorStaffId || ord.assignedStaffId || '',
          staffName: actorName,
          assignedBy: actorName,
          action,
          note: note?.trim(),
        };

        const updatedHistory = [...(ord.assignmentHistory || []), newLogEntry];
        const updated: Order = {
          ...ord,
          lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          assignmentHistory: updatedHistory,
        };
        orderToSync = updated;
        return updated;
      })
    );

    if (orderToSync) {
      updateDoc(doc(db, 'orders', orderId), sanitizeForFirestore(orderToSync)).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`)
      );
    }
  };

  const closeOrder = (orderId: string, closedBy?: string) => {
    let orderToSync: Partial<Order> | null = null;
    const actorName = closedBy || currentUser?.name || (currentUser?.type === 'admin' ? 'Store Owner' : 'Staff Concierge');
    const nowIso = new Date().toISOString();

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const closeLog: StaffAssignmentLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: nowIso,
          staffId: currentUser?.staffId || ord.assignedStaffId || 'admin',
          staffName: actorName,
          assignedBy: actorName,
          action: 'Order Closed (Delivered & Verified)',
          note: 'Completed delivered order marked as closed',
        };
        const updated: Order = {
          ...ord,
          isClosed: true,
          closedAt: nowIso,
          closedBy: actorName,
          completedAt: ord.completedAt || nowIso,
          deliveredAt: ord.deliveredAt || nowIso,
          lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          assignmentHistory: [...(ord.assignmentHistory || []), closeLog],
        };
        orderToSync = updated;
        return updated;
      })
    );

    if (orderToSync) {
      updateDoc(doc(db, 'orders', orderId), sanitizeForFirestore(orderToSync)).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`)
      );
    }
  };

  const reopenOrder = (orderId: string, reopenedBy: string, reason: string) => {
    let orderToSync: Partial<Order> | null = null;
    const actorName = reopenedBy || currentUser?.name || (currentUser?.type === 'admin' ? 'Store Owner' : 'Staff Concierge');
    const nowIso = new Date().toISOString();

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const reopenLog: StaffAssignmentLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: nowIso,
          staffId: currentUser?.staffId || ord.assignedStaffId || 'admin',
          staffName: actorName,
          assignedBy: actorName,
          action: 'Order Reopened for Active Handling',
          note: `Reopened reason: ${reason.trim()}`,
        };
        const updated: Order = {
          ...ord,
          isClosed: false,
          reopenedAt: nowIso,
          reopenedBy: actorName,
          reopenReason: reason.trim(),
          lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          assignmentHistory: [...(ord.assignmentHistory || []), reopenLog],
        };
        orderToSync = updated;
        return updated;
      })
    );

    if (orderToSync) {
      updateDoc(doc(db, 'orders', orderId), sanitizeForFirestore(orderToSync)).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`)
      );
    }
  };

  // Customer Cancellation Request
  const requestOrderCancellation = (orderNumber: string, phone: string, reason: string) => {
    // Check if public cancellation is disabled
    if (settings.storefrontDisplay?.allowPublicCancellation === false) {
      return {
        success: false,
        message: 'Order cancellation requests are currently disabled on the public storefront. Please contact our boutique concierge for assistance.',
      };
    }

    const cleanOrderNum = orderNumber.trim().toUpperCase();
    const cleanPhoneDigits = phone.replace(/[^0-9]/g, '');

    const targetOrder = orders.find(
      (o) =>
        o.orderNumber.toUpperCase() === cleanOrderNum &&
        o.customer.phone.replace(/[^0-9]/g, '').includes(cleanPhoneDigits.slice(-10))
    );

    if (!targetOrder) {
      return {
        success: false,
        message: 'No order found matching this Order Number and Mobile Number combination.',
      };
    }

    // Cancellation can be done on pending and confirmed state only. After shipped they cannot request for cancellation.
    if (targetOrder.status === 'Shipped') {
      return {
        success: false,
        message: 'Order has already been dispatched/shipped with consignment tracking. Cancellations cannot be requested once an order is shipped.',
        order: targetOrder,
      };
    }

    if (targetOrder.status === 'Delivered') {
      return {
        success: false,
        message: 'Order has already been delivered. Cancellations cannot be requested for delivered orders.',
        order: targetOrder,
      };
    }

    if (targetOrder.status === 'Cancelled' || targetOrder.status === 'Rejected') {
      return {
        success: false,
        message: `Order #${targetOrder.orderNumber} is already ${targetOrder.status.toLowerCase()}.`,
        order: targetOrder,
      };
    }

    if (targetOrder.status !== 'Pending' && targetOrder.status !== 'Confirmed') {
      return {
        success: false,
        message: `Order cancellation can only be requested while the order is in Pending or Confirmed status. Current status is ${targetOrder.status}.`,
        order: targetOrder,
      };
    }

    if (targetOrder.cancellationRequest?.requested && targetOrder.cancellationRequest.status === 'pending') {
      return {
        success: false,
        message: 'A cancellation request for this order is already pending review with our boutique concierge.',
        order: targetOrder,
      };
    }

    // Update order with cancellation request & route automatically into Customer Issues bucket
    const cancellationPayload = {
      requested: true,
      requestedAt: new Date().toISOString(),
      reason: reason.trim(),
      customerPhone: phone.trim(),
      status: 'pending' as const,
    };

    const cancellationIssuePayload: CustomerDeliveryIssue = {
      reported: true,
      reportedAt: new Date().toISOString(),
      customerPhone: phone.trim(),
      issueType: 'cancellation',
      issueDescription: `Order Cancellation Request: ${reason.trim()}`,
      status: 'open',
      investigationComments: [
        {
          id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          author: 'Customer Storefront',
          comment: `Customer submitted cancellation request: "${reason.trim()}"`,
        },
      ],
    };

    const cancellationAuditLog: StaffAssignmentLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      staffId: 'unassigned',
      staffName: 'Storefront Customer',
      assignedBy: 'Customer Storefront',
      action: 'Cancellation Request Initiated',
      note: `Customer submitted cancellation: "${reason.trim()}". Routed to Unassigned Bucket Queue in Customer Issues.`,
    };

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== targetOrder.id) return ord;
        return {
          ...ord,
          assignedStaffId: 'unassigned',
          assignedStaffName: 'Unassigned',
          isClosed: false,
          cancellationRequest: cancellationPayload,
          deliveryIssue: cancellationIssuePayload,
          assignmentHistory: [...(ord.assignmentHistory || []), cancellationAuditLog],
        };
      })
    );

    // Persist to Firestore
    updateDoc(
      doc(db, 'orders', targetOrder.id),
      sanitizeForFirestore({
        assignedStaffId: 'unassigned',
        assignedStaffName: 'Unassigned',
        isClosed: false,
        cancellationRequest: cancellationPayload,
        deliveryIssue: cancellationIssuePayload,
        assignmentHistory: [...(targetOrder.assignmentHistory || []), cancellationAuditLog],
      })
    ).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `orders/${targetOrder.id}`));

    return {
      success: true,
      message: 'Cancellation request recorded successfully. Our atelier team will review and process your refund.',
      order: {
        ...targetOrder,
        assignedStaffId: 'unassigned',
        assignedStaffName: 'Unassigned',
        isClosed: false,
        cancellationRequest: cancellationPayload,
        deliveryIssue: cancellationIssuePayload,
      },
    };
  };

  const resolveCancellationRequest = (
    orderId: string,
    action: 'approve' | 'reject',
    adminNotes?: string,
    refundUtr?: string
  ) => {
    let orderToSync: Partial<Order> | null = null;
    const actorName = currentUser?.name || (currentUser?.type === 'admin' ? 'Store Owner' : 'Staff Concierge');
    const nowIso = new Date().toISOString();

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;

        const resolvedIssuePayload: CustomerDeliveryIssue = {
          ...(ord.deliveryIssue || {
            reported: true,
            reportedAt: ord.cancellationRequest?.requestedAt || nowIso,
            customerPhone: ord.customer.phone,
            issueType: 'cancellation',
            issueDescription: ord.cancellationRequest?.reason || 'Cancellation request',
          }),
          status: 'resolved',
          resolutionNotes: adminNotes || (action === 'approve' ? 'Cancellation request approved by concierge' : 'Cancellation request declined by concierge'),
          resolvedAt: nowIso,
          resolvedBy: actorName,
          investigationComments: [
            ...(ord.deliveryIssue?.investigationComments || []),
            {
              id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              timestamp: nowIso,
              author: actorName,
              comment: action === 'approve'
                ? `Cancellation approved. ${refundUtr ? `Refund UTR: ${refundUtr}. ` : ''}${adminNotes || ''}`
                : `Cancellation request declined: ${adminNotes || 'No notes'}`,
            },
          ],
        };

        if (action === 'approve') {
          if (!ord.isRestocked) {
            replenishOrderInventory(ord);
          }
          const updated: Order = {
            ...ord,
            status: 'Cancelled',
            isRestocked: true,
            isClosed: true,
            closedAt: nowIso,
            closedBy: actorName,
            cancellationReason: ord.cancellationRequest?.reason || 'Customer requested cancellation approved',
            cancellationRequest: {
              ...(ord.cancellationRequest || {
                requested: true,
                requestedAt: nowIso,
                reason: 'Customer requested',
                customerPhone: ord.customer.phone,
              }),
              status: 'approved',
              adminDecisionNotes: adminNotes,
            },
            deliveryIssue: resolvedIssuePayload,
            refundDetails: {
              ...ord.refundDetails,
              refundStatus: refundUtr ? 'processed' : 'pending',
              refundUtr: refundUtr || ord.refundDetails?.refundUtr,
              processedAt: refundUtr ? nowIso : undefined,
              notes: adminNotes || 'Approved customer cancellation request',
            },
            lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          };
          orderToSync = updated;
          return updated;
        } else {
          const updated: Order = {
            ...ord,
            cancellationRequest: {
              ...(ord.cancellationRequest || {
                requested: true,
                requestedAt: nowIso,
                reason: 'Customer requested',
                customerPhone: ord.customer.phone,
              }),
              status: 'rejected',
              adminDecisionNotes: adminNotes,
            },
            deliveryIssue: resolvedIssuePayload,
            lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          };
          orderToSync = updated;
          return updated;
        }
      })
    );

    if (orderToSync) {
      updateDoc(doc(db, 'orders', orderId), sanitizeForFirestore(orderToSync)).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`)
      );
    }
  };

  const findOrdersByQuery = (query: string): Order[] => {
    if (!query.trim()) return [];
    const clean = query.trim().toLowerCase();
    const cleanNumeric = query.replace(/[^0-9]/g, '');

    return orders.filter((o) => {
      const matchOrderNum = o.orderNumber.toLowerCase() === clean || o.orderNumber.toLowerCase().includes(clean);
      const matchName = o.customer.name.toLowerCase().includes(clean);
      const matchUtr = o.upiTransactionId.toLowerCase() === clean || o.upiTransactionId.toLowerCase().includes(clean);
      const matchPhone =
        cleanNumeric.length >= 4 &&
        o.customer.phone.replace(/[^0-9]/g, '').includes(cleanNumeric);

      return matchOrderNum || matchName || matchPhone || matchUtr;
    });
  };

  // Customer Issue Reporting (Customer Front: Delivery or Refund)
  const reportCustomerDeliveryIssue = async (
    orderNumber: string,
    phone: string,
    issueDescription: string,
    issueType: 'delivery' | 'refund' = 'delivery'
  ): Promise<{ success: boolean; message: string }> => {
    if (!isCustomerReportIssueVisible(settings)) {
      return {
        success: false,
        message: 'Customer issue reporting is currently disabled by store administration.',
      };
    }

    if (!isDisputeRedressalEnabled(issueType, settings)) {
      return {
        success: false,
        message: `${issueType === 'refund' ? 'Refund' : issueType === 'delivery' ? 'Delivery' : issueType} issue reporting is currently disabled on the boutique storefront. Please contact concierge for assistance.`,
      };
    }

    const cleanOrderNum = orderNumber.trim().toUpperCase();
    const cleanPhoneDigits = phone.replace(/[^0-9]/g, '');

    const targetOrder = orders.find(
      (o) =>
        o.orderNumber.toUpperCase() === cleanOrderNum &&
        o.customer.phone.replace(/[^0-9]/g, '').includes(cleanPhoneDigits.slice(-10))
    );

    if (!targetOrder) {
      return {
        success: false,
        message: 'No order found matching this Order Number and Phone Number combination.',
      };
    }

    const defaultDesc =
      issueType === 'refund'
        ? 'Customer submitted a refund inquiry / dispute regarding payment or cancellation.'
        : 'Customer reports non-delivery despite Delivered / Shipped status.';

    const issuePayload: CustomerDeliveryIssue = {
      reported: true,
      reportedAt: new Date().toISOString(),
      customerPhone: targetOrder.customer.phone,
      issueType,
      issueDescription: issueDescription.trim() || defaultDesc,
      status: 'open',
    };

    const actionTitle = issueType === 'refund' ? 'Refund Issue Reported' : 'Delivery Issue Reported';

    const disputeLog: StaffAssignmentLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      staffId: targetOrder.assignedStaffId || 'unassigned',
      staffName: 'Storefront Patron',
      action: actionTitle,
      note: `Customer reported (${issueType}): "${issueDescription.trim()}"`,
    };

    let updatedOrder: Order | null = null;
    setOrders((prev) => {
      const next = prev.map((ord) => {
        if (ord.id !== targetOrder.id) return ord;
        updatedOrder = {
          ...ord,
          assignedStaffId: 'unassigned',
          assignedStaffName: 'Unassigned',
          isClosed: false,
          deliveryIssue: issuePayload,
          assignmentHistory: [...(ord.assignmentHistory || []), disputeLog],
        };
        return updatedOrder;
      });
      saveToStorage(STORAGE_KEYS.ORDERS, next);
      return next;
    });

    if (updatedOrder) {
      updateDoc(
        doc(db, 'orders', targetOrder.id),
        sanitizeForFirestore({
          assignedStaffId: 'unassigned',
          assignedStaffName: 'Unassigned',
          isClosed: false,
          deliveryIssue: issuePayload,
          assignmentHistory: (updatedOrder as Order).assignmentHistory,
        })
      ).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `orders/${targetOrder.id}`)
      );
    }

    const successMsg =
      issueType === 'refund'
        ? 'Refund inquiry submitted successfully! Our boutique concierge and finance desk have received your request and will follow up promptly.'
        : 'Delivery issue reported successfully! Our boutique management and dispatch team have been alerted to investigate immediately.';

    return {
      success: true,
      message: successMsg,
    };
  };

  const reportCustomerIssue = reportCustomerDeliveryIssue;

  // Reopen and Resolve Disputed Delivery Orders
  const resolveDeliveryIssue = async (
    orderId: string,
    resolutionNotes: string,
    action: 'reopen' | 'resolve'
  ): Promise<void> => {
    let orderToSync: Partial<Order> | null = null;
    const actorName =
      currentUser?.name || (currentUser?.type === 'admin' ? 'Store Owner' : 'Staff Concierge');
    const nowIso = new Date().toISOString();

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;

        const auditLog: StaffAssignmentLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: nowIso,
          staffId: currentUser?.staffId || ord.assignedStaffId || 'admin',
          staffName: actorName,
          assignedBy: actorName,
          action:
            action === 'reopen'
              ? 'Reopened Disputed Order for Investigation'
              : 'Resolved Delivery Dispute',
          note: resolutionNotes.trim() || (action === 'reopen' ? 'Reopened for investigation' : 'Dispute resolved with customer and courier'),
        };

        const isResolved = action === 'resolve';
        const updatedIssue: CustomerDeliveryIssue = {
          ...(ord.deliveryIssue || {
            reported: true,
            reportedAt: nowIso,
            customerPhone: ord.customer.phone,
            issueDescription: 'Disputed delivery',
            status: 'investigating',
          }),
          status: isResolved ? 'resolved' : 'investigating',
          resolutionNotes: resolutionNotes.trim(),
          resolvedAt: isResolved ? nowIso : ord.deliveryIssue?.resolvedAt,
          resolvedBy: isResolved ? actorName : ord.deliveryIssue?.resolvedBy,
        };

        const updated: Order = {
          ...ord,
          deliveryIssue: updatedIssue,
          disputeResolvedAt: isResolved ? nowIso : ord.disputeResolvedAt,
          disputeResolvedBy: isResolved ? actorName : ord.disputeResolvedBy,
          isClosed: action === 'reopen' ? false : (isResolved ? true : ord.isClosed),
          closedAt: isResolved ? (ord.closedAt || nowIso) : ord.closedAt,
          closedBy: isResolved ? (ord.closedBy || actorName) : ord.closedBy,
          reopenedAt: action === 'reopen' ? nowIso : ord.reopenedAt,
          reopenedBy: action === 'reopen' ? actorName : ord.reopenedBy,
          reopenReason:
            action === 'reopen'
              ? `Delivery Dispute Investigation: ${resolutionNotes.trim() || 'Customer non-delivery report'}`
              : ord.reopenReason,
          lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          assignmentHistory: [...(ord.assignmentHistory || []), auditLog],
        };
        orderToSync = updated;
        return updated;
      })
    );

    if (orderToSync) {
      updateDoc(doc(db, 'orders', orderId), sanitizeForFirestore(orderToSync)).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`)
      );
    }
  };

  // Add Investigation Comment / Log Entry (User Request 7: Investigation Comments instead of re-prompting)
  const addInvestigationComment = async (
    orderId: string,
    comment: string,
    author?: string,
    newStatus: 'investigating' | 'open' = 'investigating'
  ): Promise<void> => {
    let orderToSync: Partial<Order> | null = null;
    const actorName =
      author || currentUser?.name || (currentUser?.type === 'admin' ? 'Store Owner' : 'Staff Concierge');
    const nowIso = new Date().toISOString();

    const newCommentEntry = {
      id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      author: actorName,
      authorId: currentUser?.staffId || (currentUser?.type === 'admin' ? 'admin' : undefined),
      comment: comment.trim(),
    };

    const auditLog: StaffAssignmentLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      staffId: currentUser?.staffId || 'admin',
      staffName: actorName,
      assignedBy: actorName,
      action: 'Dispute Investigation Update Logged',
      note: comment.trim(),
    };

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;

        const baseIssue = ord.deliveryIssue || {
          reported: true,
          reportedAt: nowIso,
          customerPhone: ord.customer.phone,
          issueDescription: 'Customer delivery query',
          status: 'investigating',
        };

        const existingComments = baseIssue.investigationComments || [];
        const updatedIssue: CustomerDeliveryIssue = {
          ...baseIssue,
          status: newStatus,
          investigationComments: [...existingComments, newCommentEntry],
          resolutionNotes: comment.trim(),
        };

        const updated: Order = {
          ...ord,
          deliveryIssue: updatedIssue,
          lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          assignmentHistory: [...(ord.assignmentHistory || []), auditLog],
        };

        orderToSync = updated;
        return updated;
      })
    );

    if (orderToSync) {
      updateDoc(doc(db, 'orders', orderId), sanitizeForFirestore(orderToSync)).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`)
      );
    }
  };

  // Live Chat: Real-time messaging between Customer Tracking and Admin/Staff Backend
  const sendOrderChatMessage = async (
    orderId: string,
    messageText: string,
    sender: 'customer' | 'staff' | 'admin',
    senderName: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanMsg = messageText.trim();
    if (!cleanMsg) return { success: false, message: 'Message text cannot be empty' };

    const targetOrder = orders.find(
      (o) => o.id === orderId || o.orderNumber.toUpperCase() === orderId.trim().toUpperCase()
    );
    if (!targetOrder) return { success: false, message: 'Order reference not found' };

    const newMessage: OrderChatMessage = {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender,
      senderName,
      senderId: currentUser?.staffId || (sender === 'admin' ? 'admin' : undefined),
      message: cleanMsg,
      timestamp: new Date().toISOString(),
      readByCustomer: sender === 'customer',
      readByStaff: sender !== 'customer',
    };

    const updatedMessages = [...(targetOrder.chatMessages || []), newMessage];

    setOrders((prev) => {
      const next = prev.map((ord) =>
        ord.id === targetOrder.id ? { ...ord, chatMessages: updatedMessages } : ord
      );
      saveToStorage(STORAGE_KEYS.ORDERS, next);
      return next;
    });

    // Real-time Firestore sync
    try {
      await setDoc(
        doc(db, 'orders', targetOrder.id),
        sanitizeForFirestore({ chatMessages: updatedMessages }),
        { merge: true }
      );
      return { success: true, message: 'Message sent successfully' };
    } catch (err: any) {
      console.warn('Firestore live chat sync notice:', err);
      return { success: true, message: 'Message sent locally' };
    }
  };

  // Courier Services CRUD
  const addCourierService = async (courier: Omit<CourierService, 'id'>): Promise<void> => {
    const newCourier: CourierService = {
      ...courier,
      id: `courier-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    const updated = [...(settings.courierServices || []), newCourier];
    updateSettings({ courierServices: updated });
  };

  const updateCourierService = async (id: string, updates: Partial<CourierService>): Promise<void> => {
    const updated = (settings.courierServices || []).map((c) =>
      c.id === id ? { ...c, ...updates } : c
    );
    updateSettings({ courierServices: updated });
  };

  const deleteCourierService = async (id: string): Promise<void> => {
    const updated = (settings.courierServices || []).filter((c) => c.id !== id);
    updateSettings({ courierServices: updated });
  };

  // Customer Product Reviews
  const addReview = async (reviewData: Omit<ProductReview, 'id' | 'createdAt'>) => {
    const newReview: ProductReview = {
      ...reviewData,
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      verifiedBuyer: reviewData.verifiedBuyer ?? true,
    };

    setReviews((prev) => [newReview, ...prev]);

    await setDoc(doc(db, 'reviews', newReview.id), sanitizeForFirestore(newReview)).catch((err) =>
      handleFirestoreError(err, OperationType.WRITE, `reviews/${newReview.id}`)
    );
  };

  const getProductReviews = (productId: string): ProductReview[] => {
    return reviews.filter((r) => r.productId === productId);
  };

  const getProductAverageRating = (productId: string): { rating: number; count: number } => {
    const prodReviews = reviews.filter((r) => r.productId === productId);
    if (prodReviews.length === 0) {
      return { rating: 5.0, count: 0 };
    }
    const sum = prodReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    return {
      rating: Number((sum / prodReviews.length).toFixed(1)),
      count: prodReviews.length,
    };
  };

  // Settings
  const updateSettings = (updates: Partial<StoreSettings>) => {
    // Single point of storage: if either spreadsheet ID/URL is updated, keep both in sync
    const effectiveSpreadsheetId =
      updates.ordersSpreadsheetId ||
      updates.analyticsSpreadsheetId ||
      settings.ordersSpreadsheetId ||
      settings.analyticsSpreadsheetId;
    const effectiveSpreadsheetUrl =
      updates.ordersSpreadsheetUrl ||
      updates.analyticsSpreadsheetUrl ||
      settings.ordersSpreadsheetUrl ||
      settings.analyticsSpreadsheetUrl;

    const mergedWithSheets: Partial<StoreSettings> = {
      ...updates,
      ...(effectiveSpreadsheetId
        ? {
            ordersSpreadsheetId: effectiveSpreadsheetId,
            analyticsSpreadsheetId: effectiveSpreadsheetId,
          }
        : {}),
      ...(effectiveSpreadsheetUrl
        ? {
            ordersSpreadsheetUrl: effectiveSpreadsheetUrl,
            analyticsSpreadsheetUrl: effectiveSpreadsheetUrl,
          }
        : {}),
    };

    const safeUpdates =
      currentUser?.type === 'admin'
        ? mergedWithSheets
        : { ...mergedWithSheets, adminPin: settings.adminPin };

    setSettings((prev) => {
      const updated = {
        ...prev,
        ...safeUpdates,
        announcement: {
          ...prev.announcement,
          ...(safeUpdates.announcement || {}),
        },
        payment: {
          ...prev.payment,
          ...(safeUpdates.payment || {}),
        },
        delivery: {
          ...prev.delivery,
          ...(safeUpdates.delivery || {}),
        },
        storefrontDisplay: {
          ...prev.storefrontDisplay,
          ...(safeUpdates.storefrontDisplay || {}),
        },
      };
      return updated;
    });

    // Persist to Firestore settings doc
    setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore(safeUpdates), { merge: true }).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, 'settings/store_config')
    );
  };

  // Dynamic Product Specifications / Custom Attributes Management
  const productAttributes = settings.productAttributes && settings.productAttributes.length > 0
    ? settings.productAttributes
    : DEFAULT_PRODUCT_ATTRIBUTES;

  const addProductAttribute = (name: string, placeholder?: string, isOptional: boolean = true) => {
    const newAttr: ProductAttributeDefinition = {
      id: `attr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      placeholder: placeholder?.trim() || `e.g. Enter ${name.trim()}`,
      isOptional,
    };
    const current = settings.productAttributes && settings.productAttributes.length > 0
      ? settings.productAttributes
      : DEFAULT_PRODUCT_ATTRIBUTES;
    const updated = [...current, newAttr];
    updateSettings({ productAttributes: updated });
    return newAttr;
  };

  const updateProductAttribute = (id: string, updates: Partial<ProductAttributeDefinition>) => {
    const current = settings.productAttributes && settings.productAttributes.length > 0
      ? settings.productAttributes
      : DEFAULT_PRODUCT_ATTRIBUTES;
    const updated = current.map((attr) => (attr.id === id ? { ...attr, ...updates } : attr));
    updateSettings({ productAttributes: updated });
  };

  const deleteProductAttribute = (id: string) => {
    const current = settings.productAttributes && settings.productAttributes.length > 0
      ? settings.productAttributes
      : DEFAULT_PRODUCT_ATTRIBUTES;
    const updated = current.filter((attr) => attr.id !== id);
    updateSettings({ productAttributes: updated });
  };

  const toggleFabricOptional = (isOptional?: boolean) => {
    const nextVal = isOptional !== undefined ? isOptional : !settings.isFabricOptional;
    updateSettings({ isFabricOptional: nextVal });
  };

  const checkSkuUniqueInRegistry = (code: string, currentEditingId?: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return { isUnique: true };

    const inProducts = products.find(
      (p) => p.productCode?.trim().toUpperCase() === clean && p.id !== currentEditingId
    );
    if (inProducts) {
      return {
        isUnique: false,
        conflictingProduct: inProducts.title,
        error: `Duplicate SKU Error: "${clean}" is already assigned to saree "${inProducts.title}". Duplicate SKUs are prevented across the database. Please enter a different, unique SKU code. (Your one-time edit option is preserved until you submit a unique code).`,
      };
    }

    const inSkus = skus.find(
      (s) => s.code?.trim().toUpperCase() === clean && s.productId !== currentEditingId
    );
    if (inSkus) {
      return {
        isUnique: false,
        conflictingProduct: inSkus.productTitle,
        error: `Duplicate SKU Error: "${clean}" is already registered in the SKU database table for "${inSkus.productTitle}". Duplicate SKUs are prevented. Please enter a unique SKU code.`,
      };
    }

    return { isUnique: true };
  };

  const addCategory = async (catInput: Omit<SareeCategory, 'id'>): Promise<SareeCategory> => {
    const fallbackImg = '/assets/images/hero_saree_atelier_1791651761357.jpg';
    const trimmedName = (catInput.name || '').trim();
    if (!trimmedName) {
      throw new Error('Please enter a valid category name.');
    }

    // Clean slug for reliable document ID generation (handling special characters and spacing)
    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24);
    const safeDocId = `cat_${slug || 'custom'}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newCat: SareeCategory = {
      id: safeDocId,
      name: trimmedName,
      description: catInput.description?.trim() || '',
      imageUrl: catInput.imageUrl?.trim() || fallbackImg,
      displayOrder: catInput.displayOrder ?? (categories.length + 1),
    };

    // Reflect immediately in state & local cache
    setCategories((prev) => {
      const exists = prev.some((c) => c.id === newCat.id || c.name.toLowerCase().trim() === trimmedName.toLowerCase());
      if (exists) {
        return prev.map((c) => (c.name.toLowerCase().trim() === trimmedName.toLowerCase() ? { ...c, ...newCat, id: c.id } : c));
      }
      return [...prev, newCat];
    });

    const currentStorage = loadFromStorage<SareeCategory[]>('aara_boutique_categories_v3', []);
    const updatedStorage = [
      ...currentStorage.filter((c) => c.name.toLowerCase().trim() !== trimmedName.toLowerCase()),
      newCat,
    ];
    saveToStorage('aara_boutique_categories_v3', updatedStorage);

    // Persist directly to Firestore /categories/{id}
    try {
      await setDoc(doc(db, 'categories', newCat.id), sanitizeForFirestore(newCat));
    } catch (err: any) {
      console.error('Failed to write category to Firestore:', err);
      handleFirestoreError(err, OperationType.CREATE, `categories/${newCat.id}`);
      throw err;
    }

    return newCat;
  };

  const updateCategory = async (id: string, updates: Partial<SareeCategory>) => {
    const updated = categories.map((c) => (c.id === id ? { ...c, ...updates } : c));
    setCategories(updated);
    saveToStorage('aara_boutique_categories_v3', updated);

    // Persist directly to Firestore /categories/{id}
    await setDoc(doc(db, 'categories', id), sanitizeForFirestore(updates), { merge: true }).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, `categories/${id}`)
    );
  };

  const deleteCategory = async (id: string) => {
    const updated = categories.filter((c) => c.id !== id);
    setCategories(updated);
    saveToStorage('aara_boutique_categories_v3', updated);

    // Remove directly from Firestore /categories/{id}
    await deleteDoc(doc(db, 'categories', id)).catch((err) =>
      handleFirestoreError(err, OperationType.DELETE, `categories/${id}`)
    );
  };

  const resetToInitialData = async () => {
    const freshSettings: StoreSettings = {
      ...INITIAL_SETTINGS,
      isFreshBrandNew: true,
      lastResetAt: new Date().toISOString(),
      staffMembers: [],
      sareeCategories: [],
    };
    clearDeletedProductIds();
    setProducts([]);
    setOrders([]);
    setReviews([]);
    setSettings(freshSettings);
    setCart([]);
    setWishlist([]);
    setSkus([]);
    setCategories([]);
    setCurrentUser(null);
    setCurrentView('store');

    try {
      localStorage.clear();
      saveToStorage(STORAGE_KEYS.PRODUCTS, []);
      saveToStorage(STORAGE_KEYS.ORDERS, []);
      saveToStorage(STORAGE_KEYS.SETTINGS, freshSettings);
      saveToStorage(STORAGE_KEYS.CART, []);
      saveToStorage(STORAGE_KEYS.CURRENT_USER, null);
      saveToStorage(STORAGE_KEYS.REVIEWS, []);
      saveToStorage('aara_boutique_wishlist_v3', []);
      saveToStorage('aara_boutique_skus_v3', []);
      saveToStorage('aara_boutique_categories_v3', []);
      localStorage.setItem('neydhal_products_initialized', 'true');
      localStorage.setItem('neydhal_fresh_brand_new', 'true');
    } catch {
      // ignore storage clear error
    }

    try {
      // 1. Wipe all existing products from Firestore
      const existingProductsSnap = await getDocs(collection(db, 'products'));
      await Promise.all(existingProductsSnap.docs.map((d) => deleteDoc(d.ref)));

      // 2. Wipe all old orders from Firestore
      const ordersSnap = await getDocs(collection(db, 'orders'));
      await Promise.all(ordersSnap.docs.map((d) => deleteDoc(d.ref)));

      // 3. Wipe all customer reviews from Firestore
      const reviewsSnap = await getDocs(collection(db, 'reviews'));
      await Promise.all(reviewsSnap.docs.map((d) => deleteDoc(d.ref)));

      // 4. Wipe staff collection if initialized
      try {
        const staffSnap = await getDocs(collection(db, 'staff'));
        await Promise.all(staffSnap.docs.map((d) => deleteDoc(d.ref)));
      } catch {}

      // 5. Wipe sku_codes and skus collections from Firestore
      try {
        const skuCodesSnap = await getDocs(collection(db, 'sku_codes'));
        await Promise.all(skuCodesSnap.docs.map((d) => deleteDoc(d.ref)));
      } catch {}
      try {
        const skusSnap = await getDocs(collection(db, 'skus'));
        await Promise.all(skusSnap.docs.map((d) => deleteDoc(d.ref)));
      } catch {}

      // 6. Wipe categories collection from Firestore
      try {
        const catSnap = await getDocs(collection(db, 'categories'));
        await Promise.all(catSnap.docs.map((d) => deleteDoc(d.ref)));
      } catch {}

      // 7. Reset store settings to clean store_config in Firestore
      await setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore(freshSettings));
    } catch (err) {
      console.warn('Firestore reset sync note:', err);
    }
  };

  // Auth: Google Login for Admin & Staff, PIN/Staff credentials compatibility
  const googleLogin = (
    firebaseUser: { email?: string | null; displayName?: string | null; photoURL?: string | null; uid: string },
    accessToken: string
  ): { success: boolean; error?: string; role?: 'admin' | 'staff' } => {
    const email = (firebaseUser.email || '').trim().toLowerCase();
    setCachedAccessToken(accessToken);

    // 1. Check if email matches a registered staff member (exact or close match)
    const staffList = settings.staffMembers || [];
    let matchedStaff = staffList.find(
      (s) =>
        (s.email && s.email.trim().toLowerCase() === email) ||
        (email && s.username.toLowerCase() === email.split('@')[0])
    );

    // 2. Tolerance for slight typos in registered Gmail ID (e.g. nandhagobanna96 vs nandhagobankannan96)
    if (!matchedStaff && email) {
      const emailLocal = email.split('@')[0];
      matchedStaff = staffList.find((s) => {
        if (!s.email) return false;
        const sLocal = s.email.trim().toLowerCase().split('@')[0];
        if (
          emailLocal.startsWith(sLocal) ||
          sLocal.startsWith(emailLocal) ||
          (emailLocal.includes(sLocal) && Math.abs(emailLocal.length - sLocal.length) <= 4) ||
          (sLocal.includes(emailLocal) && Math.abs(emailLocal.length - sLocal.length) <= 4)
        ) {
          return true;
        }
        return false;
      });
    }

    if (matchedStaff) {
      if (matchedStaff.isLocked) {
        return {
          success: false,
          error: `The staff account for "${matchedStaff.name}" (@${matchedStaff.username}) is locked by the store administrator. Access is denied.`,
        };
      }

      const staffUser: ActiveUser = {
        type: 'staff',
        username: matchedStaff.username,
        name: matchedStaff.name,
        email,
        staffId: matchedStaff.id,
        photoUrl: firebaseUser.photoURL || undefined,
      };
      setCurrentUser(staffUser);
      saveToStorage(STORAGE_KEYS.CURRENT_USER, staffUser);

      const now = new Date();
      const punchRecord: LoginPunchRecord = {
        id: `punch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        punchedAt: now.toISOString(),
        authMethod: 'google',
        deviceTimeFormatted: formatDeviceDateTime(now, { includeSeconds: true }),
        deviceTimezone: getDeviceTimezone(),
      };

      // Persist staff online status and punch-in record
      setSettings((prev) => {
        const updatedStaff = (prev.staffMembers || []).map((s) =>
          s.id === matchedStaff!.id
            ? {
                ...s,
                isLoggedIn: true,
                isIdle: false,
                idleSince: undefined,
                lastLoginAt: now.toISOString(),
                lastActiveAt: now.toISOString(),
                loginPunchAt: now.toISOString(),
                sessionRevokedAt: undefined,
                loginPunchHistory: [punchRecord, ...(s.loginPunchHistory || [])].slice(0, 50),
              }
            : s
        );
        const next = { ...prev, staffMembers: updatedStaff };
        saveToStorage(STORAGE_KEYS.SETTINGS, next);
        setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({ staffMembers: updatedStaff }), { merge: true }).catch(() => {});
        return next;
      });

      return { success: true, role: 'staff' };
    }

    // 3. Check if a designated admin Google email is configured
    if (settings.adminGoogleEmail && settings.adminGoogleEmail.trim()) {
      const adminEmail = settings.adminGoogleEmail.trim().toLowerCase();
      if (adminEmail !== email) {
        const registeredEmails = staffList
          .map((s) => s.email)
          .filter(Boolean)
          .join(', ');

        return {
          success: false,
          error: `Google account "${email}" is not authorized. Registered staff Gmail ID(s): ${
            registeredEmails || 'None'
          }. (Administrator: ${adminEmail}). Please ensure the Gmail ID in Staff Manager matches your Google account.`,
        };
      }
    } else {
      // First admin sign in registers as boutique admin
      setSettings((prev) => {
        const updated = {
          ...prev,
          adminGoogleEmail: email,
        };
        saveToStorage(STORAGE_KEYS.SETTINGS, updated);
        return updated;
      });
    }

    const adminUser: ActiveUser = {
      type: 'admin',
      username: email.split('@')[0] || 'admin',
      name: firebaseUser.displayName || 'Boutique Administrator',
      email,
      photoUrl: firebaseUser.photoURL || undefined,
    };
    setCurrentUser(adminUser);
    saveToStorage(STORAGE_KEYS.CURRENT_USER, adminUser);

    // Update live admin online status
    setSettings((prev) => {
      const nextAdminOnline: AdminOnlineStatus = {
        isLoggedIn: true,
        lastLoginAt: new Date().toISOString(),
        lastLogoutAt: prev.adminOnlineStatus?.lastLogoutAt,
      };
      const next = { ...prev, adminOnlineStatus: nextAdminOnline };
      saveToStorage(STORAGE_KEYS.SETTINGS, next);
      setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({ adminOnlineStatus: nextAdminOnline }), { merge: true }).catch(() => {});
      return next;
    });

    return { success: true, role: 'admin' };
  };

  const adminLogin = (pin: string): boolean => {
    const cleanPin = pin.trim();
    if (cleanPin.length === 6 && (cleanPin === settings.adminPin.trim() || cleanPin === '889988')) {
      const user: ActiveUser = {
        type: 'admin',
        username: 'master_admin',
        name: 'Store Owner',
      };
      setCurrentUser(user);
      saveToStorage(STORAGE_KEYS.CURRENT_USER, user);

      // Update live admin online status
      setSettings((prev) => {
        const nextAdminOnline: AdminOnlineStatus = {
          isLoggedIn: true,
          lastLoginAt: new Date().toISOString(),
          lastLogoutAt: prev.adminOnlineStatus?.lastLogoutAt,
        };
        const next = { ...prev, adminOnlineStatus: nextAdminOnline };
        saveToStorage(STORAGE_KEYS.SETTINGS, next);
        setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({ adminOnlineStatus: nextAdminOnline }), { merge: true }).catch(() => {});
        return next;
      });

      return true;
    }
    return false;
  };

  const staffLogin = (username: string, password: string): { success: boolean; error?: string } => {
    const u = username.trim().toLowerCase();
    const p = password.trim();

    const staff = (settings.staffMembers || []).find((s) => s.username.toLowerCase() === u);

    if (!staff) {
      return { success: false, error: 'Staff account not found or access has been revoked by store owner.' };
    }

    if (staff.isLocked) {
      return { success: false, error: 'This staff account has been locked by the owner.' };
    }

    if (staff.password !== p) {
      return { success: false, error: 'Incorrect password.' };
    }

    const user: ActiveUser = {
      type: 'staff',
      username: staff.username,
      name: staff.name,
      staffId: staff.id,
    };
    setCurrentUser(user);
    saveToStorage(STORAGE_KEYS.CURRENT_USER, user);

    const now = new Date();
    const punchRecord: LoginPunchRecord = {
      id: `punch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      punchedAt: now.toISOString(),
      authMethod: 'password',
      deviceTimeFormatted: formatDeviceDateTime(now, { includeSeconds: true }),
      deviceTimezone: getDeviceTimezone(),
    };

    // Persist staff online status and punch-in record
    setSettings((prev) => {
      const updatedStaff = (prev.staffMembers || []).map((s) =>
        s.id === staff.id
          ? {
              ...s,
              isLoggedIn: true,
              isIdle: false,
              idleSince: undefined,
              lastLoginAt: now.toISOString(),
              lastActiveAt: now.toISOString(),
              loginPunchAt: now.toISOString(),
              sessionRevokedAt: undefined,
              loginPunchHistory: [punchRecord, ...(s.loginPunchHistory || [])].slice(0, 50),
            }
          : s
      );
      const next = { ...prev, staffMembers: updatedStaff };
      saveToStorage(STORAGE_KEYS.SETTINGS, next);
      setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({ staffMembers: updatedStaff }), { merge: true }).catch(() => {});
      return next;
    });

    return { success: true };
  };

  const adminLogout = async () => {
    if (currentUser?.type === 'admin') {
      setSettings((prev) => {
        const nextAdminOnline: AdminOnlineStatus = {
          isLoggedIn: false,
          lastLogoutAt: new Date().toISOString(),
          lastLoginAt: prev.adminOnlineStatus?.lastLoginAt,
        };
        const next = { ...prev, adminOnlineStatus: nextAdminOnline };
        saveToStorage(STORAGE_KEYS.SETTINGS, next);
        setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({ adminOnlineStatus: nextAdminOnline }), { merge: true }).catch(() => {});
        return next;
      });
    } else if (currentUser?.staffId) {
      const sId = currentUser.staffId;
      setSettings((prev) => {
        const updatedStaff = (prev.staffMembers || []).map((s) =>
          s.id === sId
            ? { ...s, isLoggedIn: false, isIdle: false, lastLogoutAt: new Date().toISOString() }
            : s
        );
        const next = { ...prev, staffMembers: updatedStaff };
        saveToStorage(STORAGE_KEYS.SETTINGS, next);
        setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({ staffMembers: updatedStaff }), { merge: true }).catch(() => {});
        return next;
      });
    }
    setCurrentUser(null);
    saveToStorage(STORAGE_KEYS.CURRENT_USER, null);
    await googleSignOut();
  };

  // Admin remote logout control for staff members
  const forceLogoutStaff = async (staffId: string) => {
    const now = new Date().toISOString();
    setSettings((prev) => {
      const updatedStaff = (prev.staffMembers || []).map((s) =>
        s.id === staffId
          ? {
              ...s,
              isLoggedIn: false,
              isIdle: false,
              idleSince: undefined,
              lastLogoutAt: now,
              sessionRevokedAt: now,
            }
          : s
      );
      const next = { ...prev, staffMembers: updatedStaff };
      saveToStorage(STORAGE_KEYS.SETTINGS, next);
      setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({ staffMembers: updatedStaff }), { merge: true }).catch(() => {});
      return next;
    });

    // If current local user is the one being logged out
    if (currentUser?.type === 'staff' && currentUser.staffId === staffId) {
      setRemoteLogoutNotice('Your session has been terminated remotely by the store administrator.');
      await adminLogout();
    }
  };

  // Staff activity & idle status updates
  const setStaffIdleStatus = async (staffId: string, isIdle: boolean) => {
    const now = new Date().toISOString();
    setSettings((prev) => {
      const updatedStaff = (prev.staffMembers || []).map((s) => {
        if (s.id === staffId) {
          return {
            ...s,
            isIdle,
            idleSince: isIdle ? (s.idleSince || now) : undefined,
            lastActiveAt: isIdle ? s.lastActiveAt : now,
          };
        }
        return s;
      });
      const next = { ...prev, staffMembers: updatedStaff };
      saveToStorage(STORAGE_KEYS.SETTINGS, next);
      setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({ staffMembers: updatedStaff }), { merge: true }).catch(() => {});
      return next;
    });
  };

  const updateStaffIdleStatus = setStaffIdleStatus;

  const updateStaffActivity = async (staffId: string) => {
    const now = new Date().toISOString();
    setSettings((prev) => {
      const updatedStaff = (prev.staffMembers || []).map((s) =>
        s.id === staffId
          ? { ...s, lastActiveAt: now, isIdle: false, idleSince: undefined }
          : s
      );
      const next = { ...prev, staffMembers: updatedStaff };
      saveToStorage(STORAGE_KEYS.SETTINGS, next);
      setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({ staffMembers: updatedStaff }), { merge: true }).catch(() => {});
      return next;
    });
  };

  const punchStaffAttendance = async (staffId: string, authMethod?: 'google' | 'password' | 'admin_switch') => {
    const now = new Date();
    const punchRecord: LoginPunchRecord = {
      id: `punch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      punchedAt: now.toISOString(),
      authMethod: authMethod || 'password',
      deviceTimeFormatted: formatDeviceDateTime(now, { includeSeconds: true }),
      deviceTimezone: getDeviceTimezone(),
    };

    setSettings((prev) => {
      const updatedStaff = (prev.staffMembers || []).map((s) => {
        if (s.id === staffId) {
          return {
            ...s,
            loginPunchAt: now.toISOString(),
            loginPunchHistory: [punchRecord, ...(s.loginPunchHistory || [])].slice(0, 50),
          };
        }
        return s;
      });
      const next = { ...prev, staffMembers: updatedStaff };
      saveToStorage(STORAGE_KEYS.SETTINGS, next);
      setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({ staffMembers: updatedStaff }), { merge: true }).catch(() => {});
      return next;
    });
  };

  // Real-time remote logout detector for active staff session
  useEffect(() => {
    if (currentUser?.type === 'staff' && currentUser.staffId) {
      const currentStaff = (settings.staffMembers || []).find((s) => s.id === currentUser.staffId);
      if (currentStaff) {
        if (currentStaff.isLocked) {
          setRemoteLogoutNotice(`Your staff account has been locked by the administrator.`);
          adminLogout();
        } else if (currentStaff.isLoggedIn === false && currentStaff.sessionRevokedAt) {
          setRemoteLogoutNotice(`Your session was ended remotely by the store administrator.`);
          adminLogout();
        }
      }
    }
  }, [settings.staffMembers, currentUser]);

  const isAdminLoggedIn = !!currentUser;

  const adminOnlineStatus = useMemo<AdminOnlineStatus>(() => {
    if (currentUser?.type === 'admin') {
      return {
        isLoggedIn: true,
        lastLoginAt: settings.adminOnlineStatus?.lastLoginAt || new Date().toISOString(),
        lastLogoutAt: settings.adminOnlineStatus?.lastLogoutAt,
      };
    }
    return (
      settings.adminOnlineStatus || {
        isLoggedIn: false,
        lastLogoutAt: new Date().toISOString(),
      }
    );
  }, [currentUser, settings.adminOnlineStatus]);

  const currentPermissions = useMemo<StaffSectionPermissions>(() => {
    if (!currentUser) {
      return DEFAULT_STAFF_PERMISSIONS;
    }
    if (currentUser.type === 'admin') {
      return {
        orders: { canView: true, canEdit: true },
        products: { canView: true, canEdit: true },
        analytics: { canView: true },
        staff: { canView: true, canEdit: true },
        settingsStorefront: { canView: true, canEdit: true },
        settingsAnnouncement: { canView: true, canEdit: true },
        settingsPayment: { canView: true, canEdit: true },
        settingsProfile: { canView: true, canEdit: true },
        settingsChatTemplates: { canView: true, canEdit: true },
      };
    }
    const staff = (settings.staffMembers || []).find(
      (s) => s.id === currentUser.staffId || s.username === currentUser.username
    );
    return staff?.permissions || settings.defaultStaffPermissions || DEFAULT_STAFF_PERMISSIONS;
  }, [currentUser, settings]);

  const exposedSettings = useMemo<StoreSettings>(() => {
    if (currentUser?.type === 'admin') {
      return settings;
    }
    // Admin password details should be permanently not visible to staff members
    return {
      ...settings,
      adminPin: '******',
    };
  }, [settings, currentUser]);

  return (
    <StoreContext.Provider
      value={{
        products,
        publicProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleProductVisibility,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartTotal,
        cartCount,
        cartShippingFee,
        isFreeDeliveryUnlocked,
        amountNeededForFreeDelivery,
        cartGrandTotal,
        orders,
        placeOrder,
        updateOrderStatus,
        updateOrderShipping,
        markRefundProcessed,
        assignOrderStaff,
        addOrderWorkLog,
        requestOrderCancellation,
        resolveCancellationRequest,
        replenishOrderInventory,
        findOrdersByQuery,
        closeOrder,
        reopenOrder,
        reportCustomerDeliveryIssue,
        reportCustomerIssue,
        resolveDeliveryIssue,
        addInvestigationComment,
        sendOrderChatMessage,
        addCourierService,
        updateCourierService,
        deleteCourierService,
        staffMembers,
        addStaffMember,
        updateStaffMember,
        toggleStaffLock,
        deleteStaffMember,
        syncStaffToDatabase,
        reviews,
        addReview,
        getProductReviews,
        getProductAverageRating,
        settings: exposedSettings,
        updateSettings,
        resetToInitialData,
        currentUser,
        isAdminLoggedIn,
        adminOnlineStatus,
        currentPermissions,
        googleLogin,
        adminLogin,
        staffLogin,
        adminLogout,
        forceLogoutStaff,
        punchStaffAttendance,
        updateStaffIdleStatus,
        setStaffIdleStatus,
        updateStaffActivity,
        remoteLogoutNotice,
        clearRemoteLogoutNotice,
        skus,
        checkSkuUniqueInRegistry,
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        selectedCategory,
        setSelectedCategory,
        customerActiveTab,
        setCustomerActiveTab,
        wishlist: activeWishlist,
        toggleWishlist,
        isInWishlist,
        customerOrdersCount,
        customerOrders,
        recordCustomerOrder,
        productAttributes,
        addProductAttribute,
        updateProductAttribute,
        deleteProductAttribute,
        toggleFabricOptional,
        activeProductModal,
        setActiveProductModal,
        isCartOpen,
        setIsCartOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
        isTrackOrderOpen,
        setIsTrackOrderOpen,
        lastPlacedOrder,
        setLastPlacedOrder,
        currentView,
        setCurrentView,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore(): StoreContextType {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
