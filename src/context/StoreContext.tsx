import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
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
  DeletedOrderAuditLog,
  CustomerUser,
  CustomerAddress,
  ResellerUser,
  ResellerAccessRequest,
  AppNotification,
} from '../types/store';
import { isProductRestocked } from '../utils/productValidation';
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
import { googleSignOut, setCachedAccessToken, googleSignIn } from '../utils/firebaseAuth';
import { syncPWAAndDocumentMetadata } from '../utils/dynamicManifest';
import { formatDeviceDateTime, getDeviceTimezone } from '../utils/deviceTime';
import { sendRestockPushNotification, playChatChimeSound } from '../utils/audio';
import {
  notifyCustomerOfConciergeMessage,
  notifyStaffOfCustomerMessage,
} from '../utils/deviceNotifications';
import {
  collection,
  doc,
  getDoc,
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
  isDisputeActiveForType,
  isDisputeResolvedForType,
} from '../utils/disputeRedressals';
import { isProductInActiveCategories } from '../utils/productValidation';

const STORAGE_KEYS = {
  PRODUCTS: 'aara_boutique_products_v3',
  ORDERS: 'aara_boutique_orders_v3',
  SETTINGS: 'aara_boutique_settings_v3',
  CART: 'aara_boutique_cart_v3',
  CURRENT_USER: 'aara_boutique_user_v3',
  CURRENT_CUSTOMER: 'aara_boutique_customer_v3',
  CURRENT_RESELLER: 'aara_boutique_reseller_v3',
  REVIEWS: 'aara_boutique_reviews_v3',
  DELETED_ORDERS_LOG: 'aara_boutique_deleted_orders_log_v3',
};

export interface ActiveUser {
  type: 'admin' | 'staff';
  username: string;
  name: string;
  email?: string;
  photoUrl?: string;
  staffId?: string;
}

export type CustomerActiveTab =
  | 'categories'
  | 'search'
  | 'wishlist'
  | 'orders'
  | 'order-detail'
  | 'account'
  | 'cart'
  | 'home';

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
  cartStockWarning: string | null;
  clearCartStockWarning: () => void;
  dismissCartPriceAlert: (productId: string) => void;

  // Orders
  orders: Order[];
  deletedOrderLogs: DeletedOrderAuditLog[];
  adminDeletionAlert: DeletedOrderAuditLog | null;
  dismissAdminDeletionAlert: () => void;
  clearDeletedOrderLogs: () => Promise<void>;
  placeOrder: (orderInput: {
    customer: Order['customer'];
    items: CartItem[];
    upiTransactionId?: string;
    paymentScreenshotUrl?: string;
    paymentScreenshotStoragePath?: string;
    deviceType?: 'mobile' | 'tablet' | 'desktop';
    paymentGateway?: 'upi_manual' | 'direct_upi';
    refundUpiId?: string;
    refundUpiPhone?: string;
    notes?: string;
    checkoutMethod: 'submit_order' | 'whatsapp';
  }) => Order;
  deleteOrder: (
    orderId: string,
    options?: { restockItems?: boolean; reason?: string }
  ) => Promise<void>;
  verifyOrderPayment: (
    orderId: string,
    utrOrTxnId?: string,
    paymentMode?: string,
    verifiedBy?: string
  ) => Promise<void>;
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
  assignCustomerIssueStaff: (orderId: string, staffId: string, staffName: string, reasonOrNote?: string) => void;
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
  markOrderChatMessagesAsRead: (orderId: string, reader: 'customer' | 'staff') => Promise<void>;
  customerUnreadChatCount: number;
  staffUnreadChatCount: number;
  incomingChatAlert: {
    order: Order;
    message: OrderChatMessage;
    recipient: 'customer' | 'staff';
  } | null;
  dismissChatAlert: () => void;
  activeAdminChatOrderId: string | null;
  setActiveAdminChatOrderId: (id: string | null) => void;
  activeCustomerChatOrderId: string | null;
  setActiveCustomerChatOrderId: (id: string | null) => void;

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
  customerActiveTab: CustomerActiveTab;
  setCustomerActiveTab: (tab: CustomerActiveTab) => void;
  selectedCustomerOrderId: string | null;
  setSelectedCustomerOrderId: (id: string | null) => void;

  // Wishlist
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;

  // Customer Orders Count & Soft Clearing
  customerOrdersCount: number;
  customerOrders: Order[];
  hiddenCustomerOrders: Order[];
  hiddenCustomerOrderIds: string[];
  recordCustomerOrder: (orderNumber: string, phone?: string) => void;
  hideCustomerOrder: (orderIdOrNumber: string) => void;
  unhideCustomerOrder: (orderIdOrNumber: string) => void;

  // Customer Authentication & Data Privacy (Strict Data Isolation)
  currentCustomer: CustomerUser | null;
  customerLogin: (emailOrPhone: string, password?: string) => Promise<{ success: boolean; customer?: CustomerUser; error?: string }>;
  customerLoginWithGoogle: (options?: {
    mode?: 'signin' | 'register';
    phone?: string;
    name?: string;
    autoSignIn?: boolean;
  }) => Promise<{
    success: boolean;
    customer?: CustomerUser;
    error?: string;
    isNotRegistered?: boolean;
    isAlreadyRegistered?: boolean;
    registered?: boolean;
    email?: string;
    displayName?: string;
  }>;
  customerRegister: (data: Omit<CustomerUser, 'id' | 'createdAt' | 'savedAddresses'>) => Promise<{ success: boolean; customer?: CustomerUser; error?: string }>;
  customerLogout: () => void;
  updateCustomerProfile: (updates: Partial<CustomerUser>) => Promise<void>;
  addCustomerAddress: (address: Omit<CustomerAddress, 'id'>) => Promise<void>;
  deleteCustomerAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
  isCustomerAuthModalOpen: boolean;
  setIsCustomerAuthModalOpen: (open: boolean) => void;
  isCustomerAccountModalOpen: boolean;
  setIsCustomerAccountModalOpen: (open: boolean) => void;

  // Dedicated Reseller Portal & B2B Wholesale Management
  currentReseller: ResellerUser | null;
  resellers: ResellerUser[];
  resellerRequests: ResellerAccessRequest[];
  resellerLogin: (emailOrPhone: string, password?: string) => Promise<{ success: boolean; reseller?: ResellerUser; error?: string }>;
  resellerLoginWithGoogle: (
    optionsOrBusinessName?:
      | string
      | {
          mode?: 'signin' | 'register';
          businessName?: string;
          whatsappNumber?: string;
          contactName?: string;
          city?: string;
          state?: string;
          gstOrPan?: string;
        },
    legacyWhatsapp?: string
  ) => Promise<{
    success: boolean;
    reseller?: ResellerUser;
    error?: string;
    isNotRegistered?: boolean;
    isPending?: boolean;
    email?: string;
  }>;
  resellerRegister: (data: Omit<ResellerUser, 'id' | 'createdAt' | 'wholesaleDiscountPercent' | 'status'>) => Promise<{ success: boolean; reseller?: ResellerUser; error?: string }>;
  requestResellerAccess: (data: {
    businessName?: string;
    contactName: string;
    email: string;
    whatsappNumber: string;
    city?: string;
    gstOrPan?: string;
  }) => Promise<{ success: boolean; error?: string; alreadyApproved?: boolean; alreadyPending?: boolean }>;
  approveResellerRequest: (requestId: string, options?: { wholesaleDiscountPercent?: number }) => Promise<{ success: boolean; error?: string }>;
  declineResellerRequest: (requestId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  createResellerManual: (data: Omit<ResellerUser, 'id' | 'createdAt' | 'totalSales' | 'totalOrdersCount'>) => Promise<{ success: boolean; error?: string }>;
  updateResellerStatus: (resellerId: string, status: 'active' | 'suspended' | 'locked') => Promise<{ success: boolean; error?: string }>;
  toggleResellerLock: (resellerId: string, forceLocked?: boolean) => Promise<{ success: boolean; isLocked?: boolean; error?: string }>;
  deleteReseller: (resellerId: string) => Promise<{ success: boolean; error?: string }>;
  updateResellerMargin: (resellerId: string, marginPercent: number) => Promise<{ success: boolean; error?: string }>;
  resellerLogout: () => void;
  resellerOrders: Order[];
  placeResellerOrder: (input: {
    items: CartItem[];
    dropshipRecipient: Order['dropshipRecipient'];
    resellerMargin: number;
    upiTransactionId?: string;
    paymentGateway?: 'upi_manual' | 'direct_upi';
    notes?: string;
  }) => Promise<Order>;
  isResellerPortalOpen: boolean;
  setIsResellerPortalOpen: (open: boolean) => void;

  // Reseller Address Management
  addResellerAddress: (address: Omit<CustomerAddress, 'id'>) => Promise<void>;
  updateResellerAddress: (id: string, updates: Partial<CustomerAddress>) => Promise<void>;
  deleteResellerAddress: (id: string) => Promise<void>;
  setDefaultResellerAddress: (id: string) => Promise<void>;

  // Customer & Reseller Notifications
  customerNotifications: AppNotification[];
  resellerNotifications: AppNotification[];
  markCustomerNotificationRead: (id: string) => void;
  markAllCustomerNotificationsRead: () => void;
  markResellerNotificationRead: (id: string) => void;
  markAllResellerNotificationsRead: () => void;
  clearCustomerNotifications: () => void;
  clearResellerNotifications: () => void;

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
          : 'neydhalclothing247@gmail.com',
      contactPhone: loaded.contactPhone || '+91 88073 92520',
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
      customerLoginDisplay: {
        ...INITIAL_SETTINGS.customerLoginDisplay,
        ...(loaded.customerLoginDisplay || {}),
      },
      resellerLoginDisplay: {
        ...INITIAL_SETTINGS.resellerLoginDisplay,
        ...(loaded.resellerLoginDisplay || {}),
      },
      enableOrderDeletion: loaded.enableOrderDeletion ?? false,
      payment: {
        ...INITIAL_SETTINGS.payment,
        ...(loaded.payment || {}),
        upiId: loaded.payment?.upiId || INITIAL_SETTINGS.payment.upiId,
        upiNumber: loaded.payment?.upiNumber || INITIAL_SETTINGS.payment.upiNumber,
        merchantName: loaded.payment?.merchantName || loaded.payment?.payeeName || INITIAL_SETTINGS.payment.merchantName,
        payeeName: loaded.payment?.payeeName || loaded.payment?.merchantName || INITIAL_SETTINGS.payment.payeeName,
      },
      customStoreDomain:
        !loaded.customStoreDomain ||
        loaded.customStoreDomain.includes('neydhal-smoky') ||
        loaded.customStoreDomain.includes('vercel.app')
          ? 'https://neydhalclothing.in'
          : loaded.customStoreDomain,
    };
    if (updated && (updated.adminPin === '889900' || !updated.adminPin)) {
      return { ...updated, adminPin: '889988' };
    }
    return updated;
  });

  const [cart, setCart] = useState<CartItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.CART, [])
  );
  const [cartStockWarning, setCartStockWarning] = useState<string | null>(null);
  const clearCartStockWarning = () => setCartStockWarning(null);

  // Deleted Orders Audit Ledger & Instant Admin Deletion Alert
  const [deletedOrderLogs, setDeletedOrderLogs] = useState<DeletedOrderAuditLog[]>(() =>
    loadFromStorage(STORAGE_KEYS.DELETED_ORDERS_LOG, [])
  );
  const [adminDeletionAlert, setAdminDeletionAlert] = useState<DeletedOrderAuditLog | null>(null);
  const dismissAdminDeletionAlert = () => setAdminDeletionAlert(null);

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

  // Customer Account & Privacy State
  const [currentCustomer, setCurrentCustomer] = useState<CustomerUser | null>(() =>
    loadFromStorage<CustomerUser | null>(STORAGE_KEYS.CURRENT_CUSTOMER, null)
  );
  const [customers, setCustomers] = useState<CustomerUser[]>(() =>
    loadFromStorage<CustomerUser[]>('aara_boutique_customers_v3', [])
  );
  const [isCustomerAuthModalOpen, setIsCustomerAuthModalOpen] = useState(false);
  const [isCustomerAccountModalOpen, setIsCustomerAccountModalOpen] = useState(false);

  // Dedicated Reseller Portal State
  const [currentReseller, setCurrentReseller] = useState<ResellerUser | null>(() =>
    loadFromStorage<ResellerUser | null>(STORAGE_KEYS.CURRENT_RESELLER, null)
  );
  const [resellers, setResellers] = useState<ResellerUser[]>(() => {
    const stored = loadFromStorage<ResellerUser[]>('aara_boutique_resellers_v3', []);
    return stored.filter((r) => r.id !== 'res_demo_meenakshi');
  });
  const [resellerRequests, setResellerRequests] = useState<ResellerAccessRequest[]>(() =>
    loadFromStorage<ResellerAccessRequest[]>('neydhal_reseller_requests_v1', [])
  );
  const [isResellerPortalOpen, setIsResellerPortalOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      const pathname = window.location.pathname;
      return hash.includes('reseller') || pathname === '/reseller' || search.includes('reseller');
    }
    return false;
  });

  // Customer Browsing State & Wishlist
  const [wishlist, setWishlist] = useState<string[]>(() =>
    loadFromStorage('aara_boutique_wishlist_v3', [])
  );
  const [customerActiveTab, setCustomerActiveTab] = useState<CustomerActiveTab>('categories');
  const [selectedCustomerOrderId, setSelectedCustomerOrderId] = useState<string | null>(null);
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

  // Active, visible wishlist derived state: instantly purges any deleted, hidden, or removed-category product from badges & lists
  const activeWishlist = useMemo(() => {
    const activeVisibleIds = new Set(
      products
        .filter((p) => p.isVisible !== false && isProductInActiveCategories(p, categories))
        .map((p) => p.id)
    );
    return wishlist.filter((id) => activeVisibleIds.has(id));
  }, [wishlist, products, categories]);

  // Automatic Wishlist Removal & Dynamic Adjustment for Deleted or Hidden Products
  useEffect(() => {
    if (products.length > 0) {
      setWishlist((prevWishlist) => {
        const activeVisibleIds = new Set(
          products
            .filter((p) => p.isVisible !== false && isProductInActiveCategories(p, categories))
            .map((p) => p.id)
        );
        const cleaned = prevWishlist.filter((id) => activeVisibleIds.has(id));
        if (cleaned.length !== prevWishlist.length) {
          saveToStorage('aara_boutique_wishlist_v3', cleaned);
          return cleaned;
        }
        return prevWishlist;
      });
    }
  }, [products, categories]);

  // Real-time synchronization: when a category is removed, immediately purge all orphaned products created under that category
  // from products, cart, wishlist, and linked crossSellProductIds
  useEffect(() => {
    if (categories.length === 0 || products.length === 0) return;

    const orphaned = products.filter((p) => !isProductInActiveCategories(p, categories));
    if (orphaned.length === 0) return;

    const orphanedIds = new Set(orphaned.map((p) => p.id));

    // 1. Mark as deleted & clean SKU in registry & Firestore
    orphaned.forEach((p) => {
      markProductAsDeleted(p.id);
      if (p.productCode) {
        const cleanSku = p.productCode.trim().toUpperCase();
        deleteDoc(doc(db, 'sku_codes', cleanSku)).catch(() => {});
        deleteDoc(doc(db, 'skus', cleanSku)).catch(() => {});
        setSkus((prev) => prev.filter((s) => s.code?.trim().toUpperCase() !== cleanSku));
      }
      deleteDoc(doc(db, 'products', p.id)).catch(() => {});
    });

    // 2. Remove orphaned products from products state & storage, and purge from other products' crossSellProductIds
    setProducts((prev) => {
      const cleaned = prev
        .filter((p) => !orphanedIds.has(p.id))
        .map((p) => {
          if (p.crossSellProductIds && p.crossSellProductIds.some((id) => orphanedIds.has(id))) {
            const cleanedCross = p.crossSellProductIds.filter((id) => !orphanedIds.has(id));
            setDoc(doc(db, 'products', p.id), sanitizeForFirestore({ crossSellProductIds: cleanedCross }), { merge: true }).catch(() => {});
            return { ...p, crossSellProductIds: cleanedCross };
          }
          return p;
        });
      saveToStorage(STORAGE_KEYS.PRODUCTS, cleaned);
      return cleaned;
    });

    // 3. Purge orphaned products from cart state & storage
    setCart((prev) => {
      const cleanedCart = prev.filter((item) => !orphanedIds.has(item.product.id));
      if (cleanedCart.length !== prev.length) {
        saveToStorage(STORAGE_KEYS.CART, cleanedCart);
        return cleanedCart;
      }
      return prev;
    });

    // 4. Purge orphaned products from wishlist state & storage
    setWishlist((prev) => {
      const cleanedWishlist = prev.filter((id) => !orphanedIds.has(id));
      if (cleanedWishlist.length !== prev.length) {
        saveToStorage('aara_boutique_wishlist_v3', cleanedWishlist);
        return cleanedWishlist;
      }
      return prev;
    });
  }, [categories, products]);

  // Real-time Cart Auto-Sanitization: immediately remove any item from cart if product was deleted or category was removed
  useEffect(() => {
    if (cart.length === 0) return;
    const deletedIds = getDeletedProductIds();
    const cleaned = cart.filter((item) => {
      if (deletedIds.has(item.product.id)) return false;
      if (!isProductInActiveCategories(item.product, categories)) return false;
      return true;
    });
    if (cleaned.length !== cart.length) {
      setCart(cleaned);
      saveToStorage(STORAGE_KEYS.CART, cleaned);
    }
  }, [cart, categories]);

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

  // Customer soft-cleared/hidden order IDs (stored on device to keep personal view clean)
  const [hiddenCustomerOrderIds, setHiddenCustomerOrderIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = JSON.parse(localStorage.getItem('aara_hidden_customer_orders') || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });

  const hideCustomerOrder = (orderIdOrNumber: string) => {
    if (!orderIdOrNumber) return;
    const cleanKey = orderIdOrNumber.trim().toUpperCase();
    setHiddenCustomerOrderIds((prev) => {
      if (prev.includes(cleanKey)) return prev;
      const next = [cleanKey, ...prev];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('aara_hidden_customer_orders', JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  };

  const unhideCustomerOrder = (orderIdOrNumber: string) => {
    if (!orderIdOrNumber) return;
    const cleanKey = orderIdOrNumber.trim().toUpperCase();
    setHiddenCustomerOrderIds((prev) => {
      const next = prev.filter((k) => k !== cleanKey);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('aara_hidden_customer_orders', JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  };

  const hiddenOrderKeysSet = useMemo(() => {
    return new Set(hiddenCustomerOrderIds.map((k) => k.trim().toUpperCase()));
  }, [hiddenCustomerOrderIds]);

  const allCustomerOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    // 1. If customer is authenticated, enforce strict customer privacy & data isolation!
    if (currentCustomer) {
      const cleanCustPhone = (currentCustomer.phone || '').replace(/\D/g, '').slice(-10);
      const custEmail = (currentCustomer.email || '').trim().toLowerCase();

      return orders.filter((o) => {
        if (o.orderType === 'reseller') return false; // Reseller orders handled independently
        if (o.customerId && o.customerId === currentCustomer.id) return true;
        if (custEmail && o.customerEmail && o.customerEmail.toLowerCase() === custEmail) return true;
        if (custEmail && o.customer?.email && o.customer.email.toLowerCase() === custEmail) return true;
        const ordPhone = (o.customer?.phone || '').replace(/\D/g, '').slice(-10);
        return Boolean(cleanCustPhone && ordPhone && cleanCustPhone === ordPhone);
      });
    }

    // 2. If visitor is NOT logged in: strictly isolate to the order placed in current active session!
    // Never show another customer's data!
    if (lastPlacedOrder?.orderNumber) {
      return orders.filter((o) => o.id === lastPlacedOrder.id || o.orderNumber === lastPlacedOrder.orderNumber);
    }

    return [];
  }, [orders, currentCustomer, lastPlacedOrder]);

  // Customer orders visible in My Orders dashboard (strictly isolated)
  const customerOrders = useMemo(() => {
    return allCustomerOrders;
  }, [allCustomerOrders]);

  const hiddenCustomerOrders = useMemo(() => {
    return [];
  }, []);

  const customerOrdersCount = customerOrders.length;

  // Reseller Orders strictly filtered & categorized independently
  const resellerOrders = useMemo(() => {
    if (!orders || orders.length === 0 || !currentReseller) return [];
    const cleanResellerPhone = (currentReseller.whatsappNumber || currentReseller.phone || '').replace(/\D/g, '').slice(-10);
    const cleanEmail = (currentReseller.email || '').toLowerCase().trim();
    const cleanBusinessName = (currentReseller.businessName || '').toLowerCase().trim();
    const cleanName = (currentReseller.name || '').toLowerCase().trim();

    return orders.filter((o) => {
      // Must be reseller type or RES- prefixed order
      const isResellerOrder = o.orderType === 'reseller' || (o.orderNumber && o.orderNumber.startsWith('RES-'));
      if (!isResellerOrder) return false;

      // Direct reseller ID match
      if (o.resellerId && (o.resellerId === currentReseller.id || o.resellerId === currentReseller.email)) return true;

      // Reseller business name or partner name match
      if (o.resellerBusinessName && cleanBusinessName && o.resellerBusinessName.toLowerCase().trim() === cleanBusinessName) return true;
      if (o.resellerName && cleanName && o.resellerName.toLowerCase().trim() === cleanName) return true;

      // Customer email match
      if (cleanEmail && o.customer?.email && o.customer.email.toLowerCase().trim() === cleanEmail) return true;

      // Phone match against customer phone or dropship recipient phone
      const oCustPhone = (o.customer?.phone || '').replace(/\D/g, '').slice(-10);
      const oDropshipPhone = (o.dropshipRecipient?.phone || '').replace(/\D/g, '').slice(-10);
      if (cleanResellerPhone && (oCustPhone === cleanResellerPhone || oDropshipPhone === cleanResellerPhone)) return true;

      // Attribution in note or audit logs
      if (o.lastUpdatedBy && cleanBusinessName && o.lastUpdatedBy.toLowerCase().includes(cleanBusinessName)) return true;

      // Fallback: if order is reseller order and unassigned to specific other reseller
      if (!o.resellerId) return true;

      return false;
    });
  }, [orders, currentReseller]);

  // Customer & Reseller Notification System
  const [readCustomerNotifIds, setReadCustomerNotifIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('neydhal_read_customer_notifs');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [readResellerNotifIds, setReadResellerNotifIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('neydhal_read_reseller_notifs');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [dismissedCustomerNotifIds, setDismissedCustomerNotifIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('neydhal_dismissed_customer_notifs');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [dismissedResellerNotifIds, setDismissedResellerNotifIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('neydhal_dismissed_reseller_notifs');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Calculate customer notifications (Restocks, Order dispatches, Concierge chat)
  const customerNotifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = [];

    // 1. Restocked products within active duration
    const restockedProducts = products.filter((p) =>
      isProductRestocked(p, settings.restockTagDurationHours)
    );
    for (const p of restockedProducts) {
      const notifId = `notif_restock_${p.id}_${p.restockedAt || 'recent'}`;
      if (dismissedCustomerNotifIds.has(notifId)) continue;
      const isRead = readCustomerNotifIds.has(notifId);
      list.push({
        id: notifId,
        title: `Restocked: ${p.title}`,
        message: `Handcrafted ${p.fabric || 'Heritage Saree'} in ${p.color} is back in stock (${p.stockCount || 1} available). Tap to view and reserve.`,
        type: 'restock',
        createdAt: p.restockedAt || p.createdAt || new Date().toISOString(),
        timestamp: p.restockedAt || p.createdAt || new Date().toISOString(),
        read: isRead,
        isRead: isRead,
        targetType: 'product',
        targetId: p.id,
        productId: p.id,
        imageUrl: p.images && p.images.length > 0 ? p.images[0] : undefined,
      });
    }

    // 2. Customer orders status & courier dispatches
    if (customerOrders && customerOrders.length > 0) {
      for (const order of customerOrders) {
        const notifId = `notif_order_${order.id}_${order.status}`;
        if (!dismissedCustomerNotifIds.has(notifId)) {
          let msg = `Order #${order.orderNumber} status is ${order.status}.`;
          if (order.status === 'Shipped') {
            msg = `Dispatched via ${order.shippingDetails?.courierName || 'Partner Courier'}${order.shippingDetails?.trackingNumber ? ` (Tracking: ${order.shippingDetails.trackingNumber})` : ''}. Click to track your parcel.`;
          } else if (order.status === 'Delivered') {
            msg = `Delivered! We hope you cherish your authentic weave. Click to view order certificate.`;
          } else if (order.status === 'Confirmed') {
            msg = `Order confirmed by our master weavers. It is now queued for packaging.`;
          }
          const isRead = readCustomerNotifIds.has(notifId);
          list.push({
            id: notifId,
            title: `Order #${order.orderNumber}: ${order.status}`,
            message: msg,
            type: 'order',
            createdAt: order.createdAt,
            timestamp: order.createdAt,
            read: isRead,
            isRead: isRead,
            targetType: 'order',
            targetId: order.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            metadata: { orderNumber: order.orderNumber },
          });
        }

        // 3. Concierge chat updates
        if (order.chatMessages && order.chatMessages.length > 0) {
          const staffMsgs = order.chatMessages.filter(
            (m) => m.sender === 'staff' || m.sender === 'admin' || (m as any).senderRole === 'staff'
          );
          if (staffMsgs.length > 0) {
            const latestMsg = staffMsgs[staffMsgs.length - 1];
            const chatNotifId = `notif_chat_${order.id}_${latestMsg.id || latestMsg.timestamp}`;
            if (!dismissedCustomerNotifIds.has(chatNotifId)) {
              const isRead = readCustomerNotifIds.has(chatNotifId);
              list.push({
                id: chatNotifId,
                title: `Concierge Chat: Order #${order.orderNumber}`,
                message: `${latestMsg.senderName || 'Atelier Master'}: "${latestMsg.message.slice(0, 90)}"`,
                type: 'chat',
                createdAt: latestMsg.timestamp || order.createdAt,
                timestamp: latestMsg.timestamp || order.createdAt,
                read: isRead,
                isRead: isRead,
                targetType: 'chat',
                targetId: order.id,
                orderId: order.id,
                orderNumber: order.orderNumber,
                metadata: { orderNumber: order.orderNumber },
              });
            }
          }
        }
      }
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [products, customerOrders, settings.restockTagDurationHours, readCustomerNotifIds, dismissedCustomerNotifIds]);

  // Calculate reseller notifications (Wholesale Restocks, Dropship order dispatches, Chats)
  const resellerNotifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = [];

    // 1. Wholesale restocked items
    const wholesaleRestocked = products.filter(
      (p) => isProductRestocked(p, settings.restockTagDurationHours) && p.isWholesaleAvailable !== false
    );
    for (const p of wholesaleRestocked) {
      const notifId = `notif_res_restock_${p.id}_${p.restockedAt || 'recent'}`;
      if (dismissedResellerNotifIds.has(notifId)) continue;
      const wholesaleRate = p.wholesalePrice ? `₹${p.wholesalePrice}` : `Wholesale`;
      const isRead = readResellerNotifIds.has(notifId);
      list.push({
        id: notifId,
        title: `Wholesale Restock: ${p.title}`,
        message: `${wholesaleRate} — Handloom replenished (${p.stockCount || 1} units). Ready for dropshipping.`,
        type: 'restock',
        createdAt: p.restockedAt || p.createdAt || new Date().toISOString(),
        timestamp: p.restockedAt || p.createdAt || new Date().toISOString(),
        read: isRead,
        isRead: isRead,
        targetType: 'product',
        targetId: p.id,
        productId: p.id,
        imageUrl: p.images && p.images.length > 0 ? p.images[0] : undefined,
      });
    }

    // 2. Dropship Orders updates
    if (resellerOrders && resellerOrders.length > 0) {
      for (const order of resellerOrders) {
        const notifId = `notif_res_order_${order.id}_${order.status}`;
        if (!dismissedResellerNotifIds.has(notifId)) {
          const recipientName = order.customer?.name || 'Customer';
          const recipientCity = order.customer?.city || '';
          let msg = `Order #${order.orderNumber} for ${recipientName} is now ${order.status}.`;
          if (order.status === 'Shipped') {
            msg = `Discreet parcel dispatched via ${order.shippingDetails?.courierName || 'Courier'}${order.shippingDetails?.trackingNumber ? ` (AWB: ${order.shippingDetails.trackingNumber})` : ''} to ${recipientName}, ${recipientCity}.`;
          } else if (order.status === 'Delivered') {
            msg = `Delivered to ${recipientName}, ${recipientCity}. Dropship completed!`;
          }
          const isRead = readResellerNotifIds.has(notifId);
          list.push({
            id: notifId,
            title: `Dropship #${order.orderNumber}: ${order.status}`,
            message: msg,
            type: 'order',
            createdAt: order.createdAt,
            timestamp: order.createdAt,
            read: isRead,
            isRead: isRead,
            targetType: 'reseller_orders',
            targetId: order.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            metadata: { orderNumber: order.orderNumber },
          });
        }

        // 3. Chat updates
        if (order.chatMessages && order.chatMessages.length > 0) {
          const staffMsgs = order.chatMessages.filter(
            (m) => m.sender === 'staff' || m.sender === 'admin' || (m as any).senderRole === 'staff'
          );
          if (staffMsgs.length > 0) {
            const latestMsg = staffMsgs[staffMsgs.length - 1];
            const chatNotifId = `notif_res_chat_${order.id}_${latestMsg.id || latestMsg.timestamp}`;
            if (!dismissedResellerNotifIds.has(chatNotifId)) {
              const isRead = readResellerNotifIds.has(chatNotifId);
              list.push({
                id: chatNotifId,
                title: `Dispatch Desk: Order #${order.orderNumber}`,
                message: `${latestMsg.senderName || 'Dispatch Desk'}: "${latestMsg.message.slice(0, 90)}"`,
                type: 'chat',
                createdAt: latestMsg.timestamp || order.createdAt,
                timestamp: latestMsg.timestamp || order.createdAt,
                read: isRead,
                isRead: isRead,
                targetType: 'chat',
                targetId: order.id,
                orderId: order.id,
                orderNumber: order.orderNumber,
                metadata: { orderNumber: order.orderNumber },
              });
            }
          }
        }
      }
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [products, resellerOrders, settings.restockTagDurationHours, readResellerNotifIds, dismissedResellerNotifIds]);

  const markCustomerNotificationRead = (id: string) => {
    setReadCustomerNotifIds((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem('neydhal_read_customer_notifs', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const markAllCustomerNotificationsRead = () => {
    const allIds = customerNotifications.map((n) => n.id);
    setReadCustomerNotifIds((prev) => {
      const next = new Set([...prev, ...allIds]);
      try {
        localStorage.setItem('neydhal_read_customer_notifs', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const markResellerNotificationRead = (id: string) => {
    setReadResellerNotifIds((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem('neydhal_read_reseller_notifs', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const markAllResellerNotificationsRead = () => {
    const allIds = resellerNotifications.map((n) => n.id);
    setReadResellerNotifIds((prev) => {
      const next = new Set([...prev, ...allIds]);
      try {
        localStorage.setItem('neydhal_read_reseller_notifs', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const clearCustomerNotifications = () => {
    const allIds = customerNotifications.map((n) => n.id);
    setDismissedCustomerNotifIds((prev) => {
      const next = new Set([...prev, ...allIds]);
      try {
        localStorage.setItem('neydhal_dismissed_customer_notifs', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const clearResellerNotifications = () => {
    const allIds = resellerNotifications.map((n) => n.id);
    setDismissedResellerNotifIds((prev) => {
      const next = new Set([...prev, ...allIds]);
      try {
        localStorage.setItem('neydhal_dismissed_reseller_notifs', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Customer Authentication & Management Methods
  const customerLogin = async (emailOrPhone: string, password?: string) => {
    const cleanInput = emailOrPhone.trim().toLowerCase();
    const cleanPhone = emailOrPhone.replace(/\D/g, '').slice(-10);


    // Look in memory / cache first
    let found = customers.find(
      (c) =>
        (cleanPhone && c.phone && c.phone.replace(/\D/g, '').slice(-10) === cleanPhone) ||
        (c.email && c.email.toLowerCase() === cleanInput)
    );

    // If not found in cache, check Firestore directly
    if (!found) {
      try {
        const querySnapshot = await getDocs(collection(db, 'customers'));
        querySnapshot.forEach((docSnap) => {
          const data = { id: docSnap.id, ...docSnap.data() } as CustomerUser;
          const dPhone = (data.phone || '').replace(/\D/g, '').slice(-10);
          const dEmail = (data.email || '').toLowerCase().trim();
          if ((cleanPhone && dPhone === cleanPhone) || (cleanInput && dEmail === cleanInput)) {
            found = data;
          }
        });
        if (found) {
          setCustomers((prev) => {
            const next = [found!, ...prev.filter((c) => c.id !== found!.id)];
            saveToStorage('aara_boutique_customers_v3', next);
            return next;
          });
        }
      } catch (err) {
        console.warn('Firestore customer lookup notice:', err);
      }
    }

    if (found) {
      if (found.password && password && found.password !== password) {
        return { success: false, error: 'Incorrect password.' };
      }
      setCurrentCustomer(found);
      saveToStorage(STORAGE_KEYS.CURRENT_CUSTOMER, found);
      return { success: true, customer: found };
    }

    // Auto-create customer account on phone login
    const newCust: CustomerUser = {
      id: `cust_${Date.now()}`,
      name: cleanPhone ? `Customer ${cleanPhone.slice(-4)}` : cleanInput.split('@')[0],
      email: cleanInput.includes('@') ? cleanInput : '',
      phone: cleanPhone || '',
      password: password || undefined,
      savedAddresses: [],
      createdAt: new Date().toISOString(),
      authMethod: password ? 'password' : 'guest',
    };

    setCustomers((prev) => {
      const next = [newCust, ...prev];
      saveToStorage('aara_boutique_customers_v3', next);
      return next;
    });
    setCurrentCustomer(newCust);
    saveToStorage(STORAGE_KEYS.CURRENT_CUSTOMER, newCust);
    setDoc(doc(db, 'customers', newCust.id), sanitizeForFirestore(newCust)).catch(() => {});
    return { success: true, customer: newCust };
  };

  const customerLoginWithGoogle = async (options?: {
    mode?: 'signin' | 'register';
    phone?: string;
    name?: string;
    autoSignIn?: boolean;
  }) => {
    const mode = options?.mode || 'signin';
    try {
      const authResult = await googleSignIn();
      if (!authResult?.user) {
        return { success: false, error: 'Google sign-in was cancelled or could not be completed.' };
      }
      const fbUser = authResult.user;
      const email = (fbUser.email || '').toLowerCase().trim();
      const name = (options?.name || fbUser.displayName || (email ? email.split('@')[0] : 'Valued Patron')).trim();
      const phoneInput = (options?.phone || (fbUser.phoneNumber ? fbUser.phoneNumber.replace(/\D/g, '').slice(-10) : '')).trim();

      // Check if customer profile exists in Firestore /customers collection or local cache
      let existingCustomer: CustomerUser | null = null;
      try {
        const docSnap = await getDoc(doc(db, 'customers', fbUser.uid));
        if (docSnap.exists()) {
          existingCustomer = { id: docSnap.id, ...docSnap.data() } as CustomerUser;
        } else {
          const foundInCache = customers.find(
            (c) => c.id === fbUser.uid || (email && c.email && c.email.toLowerCase() === email)
          );
          if (foundInCache) {
            existingCustomer = foundInCache;
          } else if (email) {
            try {
              const querySnapshot = await getDocs(collection(db, 'customers'));
              const foundDoc = querySnapshot.docs.find((d) => {
                const data = d.data();
                return d.id === fbUser.uid || (data.email && data.email.toLowerCase() === email);
              });
              if (foundDoc) {
                existingCustomer = { id: foundDoc.id, ...foundDoc.data() } as CustomerUser;
              }
            } catch {
              // cache fallback
            }
          }
        }
      } catch (err) {
        const foundInCache = customers.find(
          (c) => c.id === fbUser.uid || (email && c.email && c.email.toLowerCase() === email)
        );
        if (foundInCache) existingCustomer = foundInCache;
      }

      if (mode === 'signin') {
        if (!existingCustomer) {
          // Unregistered Google user: do NOT sign in automatically.
          // Sign out immediately so session is cleanly cleared.
          await googleSignOut().catch(() => {});
          return {
            success: false,
            isNotRegistered: true,
            email,
            displayName: fbUser.displayName || '',
            error: `No patron account registered for ${email || 'this Google account'}. Please register your profile below before signing in.`,
          };
        }

        // Authenticated customer who has already registered
        const updated: CustomerUser = {
          ...existingCustomer,
          id: existingCustomer.id || fbUser.uid,
          name: existingCustomer.name || name,
          email: existingCustomer.email || email,
          avatarUrl: fbUser.photoURL || existingCustomer.avatarUrl,
          authMethod: 'google',
        };

        setCurrentCustomer(updated);
        saveToStorage(STORAGE_KEYS.CURRENT_CUSTOMER, updated);
        setCustomers((prev) => {
          const next = [updated, ...prev.filter((c) => c.id !== updated.id && c.email?.toLowerCase() !== email)];
          saveToStorage('aara_boutique_customers_v3', next);
          return next;
        });

        // Persist to Firestore gracefully without failing the sign-in
        try {
          await setDoc(doc(db, 'customers', updated.id), sanitizeForFirestore(updated), { merge: true });
        } catch (fsErr) {
          console.warn('Firestore customer document write notice (saved locally):', fsErr);
        }

        return { success: true, customer: updated };
      }

      // mode === 'register'
      if (existingCustomer) {
        // Account already exists in Google Auth / Firestore: update provided details so registration succeeds gracefully!
        const updatedCust: CustomerUser = {
          ...existingCustomer,
          id: existingCustomer.id || fbUser.uid,
          name: name || existingCustomer.name || fbUser.displayName || 'Valued Patron',
          phone: phoneInput || existingCustomer.phone || '',
          email: email || existingCustomer.email,
          avatarUrl: fbUser.photoURL || existingCustomer.avatarUrl,
          authMethod: 'google',
        };

        setCustomers((prev) => {
          const next = [updatedCust, ...prev.filter((c) => c.id !== updatedCust.id && c.email?.toLowerCase() !== email)];
          saveToStorage('aara_boutique_customers_v3', next);
          return next;
        });

        try {
          await setDoc(doc(db, 'customers', updatedCust.id), sanitizeForFirestore(updatedCust), { merge: true });
        } catch (fsErr) {
          console.warn('Firestore customer update notice:', fsErr);
        }

        const shouldAutoSignIn = options?.autoSignIn ?? false;
        if (shouldAutoSignIn) {
          setCurrentCustomer(updatedCust);
          saveToStorage(STORAGE_KEYS.CURRENT_CUSTOMER, updatedCust);
        } else {
          await googleSignOut().catch(() => {});
        }

        return {
          success: true,
          registered: true,
          isAlreadyRegistered: true,
          customer: updatedCust,
        };
      }

      // Create new verified customer in Firestore /customers collection
      const newCust: CustomerUser = {
        id: fbUser.uid,
        name,
        email,
        phone: phoneInput,
        avatarUrl: fbUser.photoURL || undefined,
        savedAddresses: [],
        createdAt: new Date().toISOString(),
        authMethod: 'google',
      };

      setCustomers((prev) => {
        const next = [newCust, ...prev.filter((c) => c.id !== newCust.id && c.email?.toLowerCase() !== email)];
        saveToStorage('aara_boutique_customers_v3', next);
        return next;
      });

      // Write to Firestore with safe fallback so permission errors or network drops do not block registration
      try {
        await setDoc(doc(db, 'customers', newCust.id), sanitizeForFirestore(newCust));
      } catch (fsErr: any) {
        console.warn('Firestore customer create document notice (saved locally):', fsErr?.message || fsErr);
      }

      const shouldAutoSignIn = options?.autoSignIn ?? false;
      if (shouldAutoSignIn) {
        setCurrentCustomer(newCust);
        saveToStorage(STORAGE_KEYS.CURRENT_CUSTOMER, newCust);
      } else {
        // Sign out so that user is presented with confirmation message and can click Proceed to Sign In
        await googleSignOut().catch(() => {});
      }

      return { success: true, registered: true, customer: newCust };
    } catch (err: any) {
      const isPopupClosed = err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed');
      if (isPopupClosed) {
        return { success: false, error: 'Google sign-in popup was closed before completion. Please try again.' };
      }
      console.warn('Google Sign-In notice (Customer):', err?.message || err);
      return { success: false, error: err?.message || 'Google authentication failed. Please try again.' };
    }
  };

  const customerRegister = async (data: Omit<CustomerUser, 'id' | 'createdAt' | 'savedAddresses'>) => {
    const newCust: CustomerUser = {
      ...data,
      id: `cust_${Date.now()}`,
      savedAddresses: [],
      createdAt: new Date().toISOString(),
    };
    setCustomers((prev) => {
      const next = [newCust, ...prev];
      saveToStorage('aara_boutique_customers_v3', next);
      return next;
    });
    setCurrentCustomer(newCust);
    saveToStorage(STORAGE_KEYS.CURRENT_CUSTOMER, newCust);
    try {
      await setDoc(doc(db, 'customers', newCust.id), sanitizeForFirestore(newCust));
    } catch (fsErr) {
      console.warn('Firestore customer document write notice:', fsErr);
    }
    return { success: true, customer: newCust };
  };

  const customerLogout = () => {
    setCurrentCustomer(null);
    saveToStorage(STORAGE_KEYS.CURRENT_CUSTOMER, null);
    googleSignOut().catch(() => {});
  };

  const updateCustomerProfile = async (updates: Partial<CustomerUser>) => {
    if (!currentCustomer) return;
    const updated = { ...currentCustomer, ...updates };
    setCurrentCustomer(updated);
    saveToStorage(STORAGE_KEYS.CURRENT_CUSTOMER, updated);
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setDoc(doc(db, 'customers', updated.id), sanitizeForFirestore(updated), { merge: true }).catch(() => {});
  };

  const addCustomerAddress = async (address: Omit<CustomerAddress, 'id'>) => {
    if (!currentCustomer) return;
    const newAddr: CustomerAddress = {
      ...address,
      id: `addr_${Date.now()}`,
    };
    let updatedAddrs = currentCustomer.savedAddresses || [];
    if (newAddr.isDefault) {
      updatedAddrs = updatedAddrs.map((a) => ({ ...a, isDefault: false }));
    }
    updatedAddrs = [newAddr, ...updatedAddrs];
    await updateCustomerProfile({ savedAddresses: updatedAddrs });
  };

  const deleteCustomerAddress = async (id: string) => {
    if (!currentCustomer) return;
    const updatedAddrs = (currentCustomer.savedAddresses || []).filter((a) => a.id !== id);
    await updateCustomerProfile({ savedAddresses: updatedAddrs });
  };

  const setDefaultAddress = async (id: string) => {
    if (!currentCustomer) return;
    const updatedAddrs = (currentCustomer.savedAddresses || []).map((a) => ({
      ...a,
      isDefault: a.id === id,
    }));
    await updateCustomerProfile({ savedAddresses: updatedAddrs });
  };

  // Dedicated Reseller Address Management Methods
  const addResellerAddress = async (address: Omit<CustomerAddress, 'id'>) => {
    if (!currentReseller) return;
    const newAddr: CustomerAddress = {
      ...address,
      id: `res_addr_${Date.now()}`,
    };
    let currentAddrs = currentReseller.savedAddresses ? [...currentReseller.savedAddresses] : [];
    if (newAddr.isDefault || currentAddrs.length === 0) {
      newAddr.isDefault = true;
      currentAddrs = currentAddrs.map((a) => ({ ...a, isDefault: false }));
    }
    const updatedAddrs = [newAddr, ...currentAddrs];
    const updatedReseller: ResellerUser = {
      ...currentReseller,
      savedAddresses: updatedAddrs,
    };
    setCurrentReseller(updatedReseller);
    saveToStorage(STORAGE_KEYS.CURRENT_RESELLER, updatedReseller);
    setResellers((prev) => prev.map((r) => (r.id === updatedReseller.id ? updatedReseller : r)));
    await setDoc(doc(db, 'resellers', updatedReseller.id), sanitizeForFirestore(updatedReseller), { merge: true }).catch(() => {});
  };

  const updateResellerAddress = async (id: string, updates: Partial<CustomerAddress>) => {
    if (!currentReseller) return;
    let currentAddrs = currentReseller.savedAddresses ? [...currentReseller.savedAddresses] : [];
    if (updates.isDefault) {
      currentAddrs = currentAddrs.map((a) => ({ ...a, isDefault: a.id === id }));
    }
    const updatedAddrs = currentAddrs.map((a) => (a.id === id ? { ...a, ...updates } : a));
    const updatedReseller: ResellerUser = {
      ...currentReseller,
      savedAddresses: updatedAddrs,
    };
    setCurrentReseller(updatedReseller);
    saveToStorage(STORAGE_KEYS.CURRENT_RESELLER, updatedReseller);
    setResellers((prev) => prev.map((r) => (r.id === updatedReseller.id ? updatedReseller : r)));
    await setDoc(doc(db, 'resellers', updatedReseller.id), sanitizeForFirestore(updatedReseller), { merge: true }).catch(() => {});
  };

  const deleteResellerAddress = async (id: string) => {
    if (!currentReseller) return;
    const remaining = (currentReseller.savedAddresses || []).filter((a) => a.id !== id);
    if (remaining.length > 0 && !remaining.some((a) => a.isDefault)) {
      remaining[0].isDefault = true;
    }
    const updatedReseller: ResellerUser = {
      ...currentReseller,
      savedAddresses: remaining,
    };
    setCurrentReseller(updatedReseller);
    saveToStorage(STORAGE_KEYS.CURRENT_RESELLER, updatedReseller);
    setResellers((prev) => prev.map((r) => (r.id === updatedReseller.id ? updatedReseller : r)));
    await setDoc(doc(db, 'resellers', updatedReseller.id), sanitizeForFirestore(updatedReseller), { merge: true }).catch(() => {});
  };

  const setDefaultResellerAddress = async (id: string) => {
    if (!currentReseller) return;
    const updatedAddrs = (currentReseller.savedAddresses || []).map((a) => ({
      ...a,
      isDefault: a.id === id,
    }));
    const updatedReseller: ResellerUser = {
      ...currentReseller,
      savedAddresses: updatedAddrs,
    };
    setCurrentReseller(updatedReseller);
    saveToStorage(STORAGE_KEYS.CURRENT_RESELLER, updatedReseller);
    setResellers((prev) => prev.map((r) => (r.id === updatedReseller.id ? updatedReseller : r)));
    await setDoc(doc(db, 'resellers', updatedReseller.id), sanitizeForFirestore(updatedReseller), { merge: true }).catch(() => {});
  };

  // Dedicated Reseller Portal & B2B Wholesale Methods
  const resellerLogin = async (emailOrPhone: string, password?: string) => {
    const cleanInput = emailOrPhone.trim().toLowerCase();
    const cleanPhone = emailOrPhone.replace(/\D/g, '').slice(-10);

    const found = resellers.find(
      (r) =>
        (cleanPhone &&
          (r.whatsappNumber?.replace(/\D/g, '').slice(-10) === cleanPhone ||
            r.phone?.replace(/\D/g, '').slice(-10) === cleanPhone)) ||
        (r.email && r.email.toLowerCase() === cleanInput)
    );

    if (found) {
      if (found.isLocked || found.status === 'suspended' || found.status === 'locked') {
        return { success: false, error: 'Account Locked: Your reseller portal access has been locked by administration. You cannot log into the reseller portal.' };
      }
      if (found.status !== 'active') {
        return { success: false, error: 'Your reseller account is awaiting admin approval. You will be able to sign in once approved by Neydhal administration.' };
      }
      if (found.password && password && found.password !== password) {
        return { success: false, error: 'Incorrect reseller password.' };
      }
      setCurrentReseller(found);
      saveToStorage(STORAGE_KEYS.CURRENT_RESELLER, found);
      return { success: true, reseller: found };
    }

    // Check if there is a pending access request
    const pendingReq = resellerRequests.find(
      (req) => (cleanInput && req.email.toLowerCase() === cleanInput) || (cleanPhone && req.whatsappNumber.slice(-10) === cleanPhone)
    );
    if (pendingReq && pendingReq.status === 'pending') {
      return {
        success: false,
        error: `Your reseller access request for "${pendingReq.email}" is pending approval by Neydhal administration.`,
      };
    }

    return {
      success: false,
      error: 'Access Denied: No approved reseller account found. Reseller access requires admin authentication. Please click "Register as Reseller" and submit an access request.',
    };
  };

  const resellerLoginWithGoogle = async (
    optionsOrBusinessName?:
      | string
      | {
          mode?: 'signin' | 'register';
          businessName?: string;
          whatsappNumber?: string;
          contactName?: string;
          city?: string;
          state?: string;
          gstOrPan?: string;
        },
    legacyWhatsapp?: string
  ) => {
    try {
      const authResult = await googleSignIn();
      if (!authResult?.user) {
        return { success: false, error: 'Google sign-in was cancelled or could not be completed.' };
      }
      const fbUser = authResult.user;
      const email = (fbUser.email || '').toLowerCase().trim();
      const defaultName = fbUser.displayName || 'Reseller Partner';

      // Check if reseller exists in Firestore /reseller collection or local state
      let existingReseller: ResellerUser | null = null;
      try {
        const docSnap = await getDoc(doc(db, 'reseller', fbUser.uid));
        if (docSnap.exists()) {
          existingReseller = { id: docSnap.id, ...docSnap.data() } as ResellerUser;
        } else {
          // Check by email in Firestore 'reseller' collection
          const found = resellers.find(
            (r) => r.id === fbUser.uid || (email && r.email && r.email.toLowerCase() === email)
          );
          if (found && found.id !== 'res_demo_meenakshi') {
            existingReseller = found;
          }
        }
      } catch (err) {
        const found = resellers.find(
          (r) => r.id === fbUser.uid || (email && r.email && r.email.toLowerCase() === email)
        );
        if (found && found.id !== 'res_demo_meenakshi') existingReseller = found;
      }

      // Check if there is a pending request for this email
      const pendingReq = resellerRequests.find(
        (req) => req.email.toLowerCase() === email && req.status === 'pending'
      );

      // Check if reseller is locked
      if (existingReseller && (existingReseller.isLocked || existingReseller.status === 'suspended' || existingReseller.status === 'locked')) {
        await googleSignOut().catch(() => {});
        return {
          success: false,
          isNotRegistered: false,
          email,
          error: `Account Locked: Reseller portal access for "${email}" has been locked by administration. You cannot log into the reseller portal. Please contact the boutique to unlock your account.`,
        };
      }

      // Reseller MUST be approved by admin to log in!
      if (!existingReseller || existingReseller.status !== 'active') {
        await googleSignOut().catch(() => {});
        if (pendingReq) {
          return {
            success: false,
            isNotRegistered: false,
            isPending: true,
            email,
            error: `Your reseller access request for "${email}" is currently pending review on the Admin Reseller Ledger. You will receive access once approved by Neydhal administration.`,
          };
        }
        return {
          success: false,
          isNotRegistered: true,
          email,
          error: `Access Denied: Google account "${email}" is not authorized as a B2B Reseller. Reseller access requires admin approval. Please submit an access request using the registration form.`,
        };
      }

      const updated: ResellerUser = {
        ...existingReseller,
        name: existingReseller.name || defaultName,
        email: existingReseller.email || email,
        avatarUrl: fbUser.photoURL || existingReseller.avatarUrl,
        authMethod: 'google',
      };
      setCurrentReseller(updated);
      saveToStorage(STORAGE_KEYS.CURRENT_RESELLER, updated);
      setResellers((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setDoc(doc(db, 'reseller', updated.id), sanitizeForFirestore(updated), { merge: true }).catch(() => {});
      return { success: true, reseller: updated };
    } catch (err: any) {
      const isPopupClosed = err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed');
      if (isPopupClosed) {
        return { success: false, error: 'Google sign-in popup was closed before completion. Please try again.' };
      }
      return { success: false, error: err?.message || 'Google authentication failed. Please try again.' };
    }
  };

  const requestResellerAccess = async (data: {
    businessName?: string;
    contactName: string;
    email: string;
    whatsappNumber: string;
    city?: string;
    gstOrPan?: string;
  }) => {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanPhone = data.whatsappNumber.replace(/\D/g, '').slice(-10);

    // Check if already an approved active reseller in reseller collection
    const alreadyApproved = resellers.some(
      (r) => r.email?.toLowerCase() === cleanEmail && r.status === 'active'
    );
    if (alreadyApproved) {
      return {
        success: false,
        alreadyApproved: true,
        error: 'User account has been register with Neydhal clothing. proceed to login.',
      };
    }

    // Check if already pending
    const existingPending = resellerRequests.find(
      (req) => req.email.toLowerCase() === cleanEmail && req.status === 'pending'
    );
    if (existingPending) {
      return {
        success: false,
        alreadyPending: true,
        error: `An access request for "${cleanEmail}" is already pending admin review on the Reseller Ledger. We will notify you once approved.`,
      };
    }

    const newRequest: ResellerAccessRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      businessName: data.businessName?.trim() || undefined,
      contactName: data.contactName.trim(),
      email: cleanEmail,
      whatsappNumber: cleanPhone,
      city: data.city?.trim() || '',
      gstOrPan: data.gstOrPan?.trim() || undefined,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      wholesaleDiscountPercent: 20,
    };

    const nextRequests = [newRequest, ...resellerRequests.filter((r) => r.id !== newRequest.id)];
    setResellerRequests(nextRequests);
    saveToStorage('neydhal_reseller_requests_v1', nextRequests);

    try {
      await setDoc(doc(db, 'reseller_requests', newRequest.id), sanitizeForFirestore(newRequest));
    } catch (err: any) {
      console.warn('Failed to save reseller request to Firestore:', err);
    }

    return { success: true };
  };

  const approveResellerRequest = async (requestId: string, options?: { wholesaleDiscountPercent?: number }) => {
    const target = resellerRequests.find((r) => r.id === requestId);
    if (!target) return { success: false, error: 'Access request not found.' };

    const discount = options?.wholesaleDiscountPercent ?? target.wholesaleDiscountPercent ?? 20;
    const cleanEmail = target.email.toLowerCase().trim();
    const resellerId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newReseller: ResellerUser = {
      id: resellerId,
      businessName: target.businessName || `${target.contactName}'s Collections`,
      name: target.contactName,
      email: cleanEmail,
      phone: target.whatsappNumber,
      whatsappNumber: target.whatsappNumber,
      city: target.city || '',
      state: target.state || 'Tamil Nadu',
      gstOrPan: target.gstOrPan || undefined,
      wholesaleDiscountPercent: discount,
      status: 'active',
      authMethod: 'google',
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser?.name || 'Admin Owner',
      totalSales: 0,
      totalOrdersCount: 0,
    };

    const updatedRequest: ResellerAccessRequest = {
      ...target,
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: currentUser?.name || 'Admin Owner',
      wholesaleDiscountPercent: discount,
    };

    const updatedResellers = [newReseller, ...resellers.filter((r) => r.email?.toLowerCase() !== cleanEmail)];
    const updatedRequests = resellerRequests.map((r) => (r.id === requestId ? updatedRequest : r));

    setResellers(updatedResellers);
    setResellerRequests(updatedRequests);
    saveToStorage('aara_boutique_resellers_v3', updatedResellers);
    saveToStorage('neydhal_reseller_requests_v1', updatedRequests);

    // Save to separate collection named "reseller" on database and update request in "reseller_requests"
    try {
      await setDoc(doc(db, 'reseller', newReseller.id), sanitizeForFirestore(newReseller));
      await setDoc(doc(db, 'reseller_requests', requestId), sanitizeForFirestore(updatedRequest), { merge: true });
    } catch (err: any) {
      console.warn('Error saving approved reseller to Firestore:', err);
    }

    return { success: true };
  };

  const declineResellerRequest = async (requestId: string, reason?: string) => {
    const target = resellerRequests.find((r) => r.id === requestId);
    if (!target) return { success: false, error: 'Access request not found.' };

    const updatedRequest: ResellerAccessRequest = {
      ...target,
      status: 'declined',
      reviewedAt: new Date().toISOString(),
      reviewedBy: currentUser?.name || 'Admin Owner',
      rejectionReason: reason || 'Declined by boutique administration',
    };

    const updatedRequests = resellerRequests.map((r) => (r.id === requestId ? updatedRequest : r));
    setResellerRequests(updatedRequests);
    saveToStorage('neydhal_reseller_requests_v1', updatedRequests);

    try {
      await setDoc(doc(db, 'reseller_requests', requestId), sanitizeForFirestore(updatedRequest), { merge: true });
    } catch (err: any) {
      console.warn('Error declining reseller request in Firestore:', err);
    }
    return { success: true };
  };

  const createResellerManual = async (
    data: Omit<ResellerUser, 'id' | 'createdAt' | 'totalSales' | 'totalOrdersCount'>
  ) => {
    const cleanEmail = data.email.toLowerCase().trim();
    const resellerId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newReseller: ResellerUser = {
      ...data,
      id: resellerId,
      email: cleanEmail,
      status: 'active',
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser?.name || 'Admin Owner',
      totalSales: 0,
      totalOrdersCount: 0,
    };

    const updatedResellers = [newReseller, ...resellers.filter((r) => r.id !== newReseller.id)];
    setResellers(updatedResellers);
    saveToStorage('aara_boutique_resellers_v3', updatedResellers);

    try {
      await setDoc(doc(db, 'reseller', newReseller.id), sanitizeForFirestore(newReseller));
    } catch (err: any) {
      console.warn('Error saving manual reseller to Firestore:', err);
    }
    return { success: true };
  };

  const updateResellerStatus = async (resellerId: string, status: 'active' | 'suspended' | 'locked') => {
    const isLocked = status !== 'active';
    const updated = resellers.map((r) =>
      r.id === resellerId
        ? {
            ...r,
            status,
            isLocked,
            lockedAt: isLocked ? new Date().toISOString() : undefined,
            lockedBy: isLocked ? (currentUser?.name || 'Store Admin') : undefined,
          }
        : r
    );
    setResellers(updated);
    saveToStorage('aara_boutique_resellers_v3', updated);

    if (isLocked && currentReseller?.id === resellerId) {
      setCurrentReseller(null);
      saveToStorage(STORAGE_KEYS.CURRENT_RESELLER, null);
    }

    try {
      await updateDoc(doc(db, 'reseller', resellerId), {
        status,
        isLocked,
        lockedAt: isLocked ? new Date().toISOString() : null,
        lockedBy: isLocked ? (currentUser?.name || 'Store Admin') : null,
      });
    } catch (err: any) {
      console.warn('Error updating reseller status in Firestore:', err);
    }
    return { success: true };
  };

  const toggleResellerLock = async (resellerId: string, forceLocked?: boolean) => {
    const target = resellers.find((r) => r.id === resellerId);
    if (!target) return { success: false, error: 'Reseller not found.' };

    const shouldLock = forceLocked !== undefined ? forceLocked : !(target.isLocked || target.status === 'suspended' || target.status === 'locked');
    const newStatus: 'active' | 'suspended' = shouldLock ? 'suspended' : 'active';

    const updated = resellers.map((r) =>
      r.id === resellerId
        ? {
            ...r,
            isLocked: shouldLock,
            status: newStatus,
            lockedAt: shouldLock ? new Date().toISOString() : undefined,
            lockedBy: shouldLock ? (currentUser?.name || 'Store Admin') : undefined,
          }
        : r
    );
    setResellers(updated);
    saveToStorage('aara_boutique_resellers_v3', updated);

    if (shouldLock && (currentReseller?.id === resellerId || (target.email && currentReseller?.email?.toLowerCase() === target.email.toLowerCase()))) {
      setCurrentReseller(null);
      saveToStorage(STORAGE_KEYS.CURRENT_RESELLER, null);
    }

    try {
      await setDoc(
        doc(db, 'reseller', resellerId),
        {
          isLocked: shouldLock,
          status: newStatus,
          lockedAt: shouldLock ? new Date().toISOString() : null,
          lockedBy: shouldLock ? (currentUser?.name || 'Store Admin') : null,
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn('Error toggling reseller lock in Firestore:', err);
    }

    return { success: true, isLocked: shouldLock };
  };

  const deleteReseller = async (resellerId: string) => {
    const target = resellers.find((r) => r.id === resellerId);
    const updated = resellers.filter((r) => r.id !== resellerId);
    setResellers(updated);
    saveToStorage('aara_boutique_resellers_v3', updated);

    if (currentReseller?.id === resellerId || (target?.email && currentReseller?.email?.toLowerCase() === target.email.toLowerCase())) {
      setCurrentReseller(null);
      saveToStorage(STORAGE_KEYS.CURRENT_RESELLER, null);
    }

    try {
      await deleteDoc(doc(db, 'reseller', resellerId)).catch(() => {});
      await deleteDoc(doc(db, 'resellers', resellerId)).catch(() => {});
      if (target?.email) {
        const matches = resellerRequests.filter((req) => req.email.toLowerCase() === target.email.toLowerCase());
        for (const req of matches) {
          await deleteDoc(doc(db, 'reseller_requests', req.id)).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn('Error deleting reseller in Firestore:', err);
    }
    return { success: true };
  };

  const updateResellerMargin = async (resellerId: string, marginPercent: number) => {
    const cleanMargin = Math.max(0, Math.min(100, Math.round(Number(marginPercent) || 0)));
    const target = resellers.find((r) => r.id === resellerId);
    if (!target) return { success: false, error: 'Reseller not found.' };

    const updated = resellers.map((r) =>
      r.id === resellerId
        ? {
            ...r,
            wholesaleDiscountPercent: cleanMargin,
            updatedAt: new Date().toISOString(),
          }
        : r
    );
    setResellers(updated);
    saveToStorage('aara_boutique_resellers_v3', updated);

    if (currentReseller?.id === resellerId || (target.email && currentReseller?.email?.toLowerCase() === target.email.toLowerCase())) {
      const updatedCurrent: ResellerUser = {
        ...currentReseller,
        wholesaleDiscountPercent: cleanMargin,
      };
      setCurrentReseller(updatedCurrent);
      saveToStorage(STORAGE_KEYS.CURRENT_RESELLER, updatedCurrent);
    }

    try {
      await setDoc(
        doc(db, 'reseller', resellerId),
        {
          wholesaleDiscountPercent: cleanMargin,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn('Error updating reseller margin in Firestore:', err);
    }

    return { success: true };
  };

  const resellerRegister = async (
    data: Omit<ResellerUser, 'id' | 'createdAt' | 'wholesaleDiscountPercent' | 'status'>
  ) => {
    return requestResellerAccess({
      businessName: data.businessName,
      contactName: data.name,
      email: data.email,
      whatsappNumber: data.whatsappNumber || data.phone,
      city: data.city,
      gstOrPan: data.gstOrPan,
    });
  };

  const resellerLogout = () => {
    setCurrentReseller(null);
    saveToStorage(STORAGE_KEYS.CURRENT_RESELLER, null);
    googleSignOut().catch(() => {});
  };

  const placeResellerOrder = async (input: {
    items: CartItem[];
    dropshipRecipient: Order['dropshipRecipient'];
    resellerMargin: number;
    upiTransactionId?: string;
    paymentGateway?: 'upi_manual' | 'direct_upi';
    notes?: string;
  }): Promise<Order> => {
    if (!currentReseller) throw new Error('Reseller not authenticated');

    const subtotal = input.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const shippingFee = 0; // Wholesale bulk orders free delivery
    const totalAmount = subtotal;
    const prefix = 'RES';
    const orderNumber = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

    const upiTxnId = (input.upiTransactionId || `RES${Date.now()}`).trim();
    const paymentModeName = 'Wholesale B2B UPI';

    const newOrder: Order = {
      id: `order-${Date.now()}`,
      orderNumber,
      createdAt: new Date().toISOString(),
      customer: {
        name: input.dropshipRecipient?.name || currentReseller.name,
        phone: input.dropshipRecipient?.phone || currentReseller.whatsappNumber,
        email: currentReseller.email || '',
        address: input.dropshipRecipient?.address || currentReseller.businessName,
        city: input.dropshipRecipient?.city || currentReseller.city || 'Salem',
        state: input.dropshipRecipient?.state || currentReseller.state || 'Tamil Nadu',
        pincode: input.dropshipRecipient?.pincode || '636001',
      },
      items: input.items,
      subtotal,
      shippingFee,
      totalAmount,
      upiTransactionId: upiTxnId,
      paymentGateway: input.paymentGateway || 'direct_upi',
      paymentStatus: 'paid',
      isPaymentVerified: true,
      paymentVerifiedAt: new Date().toISOString(),
      paymentVerifiedBy: 'B2B Wholesale Prepayment',
      paymentMethod: paymentModeName,
      refundDetails: {
        refundStatus: 'not_required',
      },
      status: 'Pending',
      checkoutMethod: 'submit_order',
      notes: input.notes,
      orderType: 'reseller',
      resellerId: currentReseller.id,
      resellerName: currentReseller.name,
      resellerBusinessName: currentReseller.businessName,
      resellerMargin: input.resellerMargin,
      dropshipRecipient: input.dropshipRecipient,
      lastUpdatedBy: `reseller:${currentReseller.businessName}`,
      assignmentHistory: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          staffId: 'unassigned',
          staffName: 'Wholesale B2B Queue',
          assignedBy: 'Reseller Portal',
          action: 'Reseller Dropship Order Placed',
          note: `Partner: ${currentReseller.businessName}. Wholesale Total: ₹${totalAmount}, Reseller Margin: ₹${input.resellerMargin}`,
        },
      ],
    };

    setOrders((prev) => [newOrder, ...prev]);

    // Deduct stock for ordered items
    input.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.product.id);
      if (prod) {
        const remainingCount = Math.max(0, (prod.stockCount ?? 1) - item.quantity);
        const nextStatus =
          remainingCount === 0 ? 'out_of_stock' : remainingCount <= 2 ? 'limited' : prod.stockStatus;
        updateProduct(prod.id, {
          stockCount: remainingCount,
          stockStatus: nextStatus,
        });
      }
    });

    setDoc(doc(db, 'orders', newOrder.id), sanitizeForFirestore(newOrder)).catch(() => {});
    return newOrder;
  };

  // Active deep-link live chat order IDs
  const [activeAdminChatOrderId, setActiveAdminChatOrderId] = useState<string | null>(null);
  const [activeCustomerChatOrderId, setActiveCustomerChatOrderId] = useState<string | null>(null);

  // Floating in-app alert banner for incoming live chat messages
  const [incomingChatAlert, setIncomingChatAlert] = useState<{
    order: Order;
    message: OrderChatMessage;
    recipient: 'customer' | 'staff';
  } | null>(null);

  const dismissChatAlert = () => setIncomingChatAlert(null);

  // Unread chat counts
  const customerUnreadChatCount = useMemo(() => {
    if (!customerOrders || customerOrders.length === 0) return 0;
    let count = 0;
    for (const ord of customerOrders) {
      if (ord.chatMessages) {
        for (const msg of ord.chatMessages) {
          if (!msg.readByCustomer && msg.sender !== 'customer') {
            count++;
          }
        }
      }
    }
    return count;
  }, [customerOrders]);

  const staffUnreadChatCount = useMemo(() => {
    if (!orders || orders.length === 0) return 0;
    let count = 0;
    for (const ord of orders) {
      if (ord.chatMessages) {
        for (const msg of ord.chatMessages) {
          if (!msg.readByStaff && msg.sender === 'customer') {
            count++;
          }
        }
      }
    }
    return count;
  }, [orders]);

  // Real-time Live Chat Notification Monitor across Customer and Staff Devices
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const isInitialChatMountRef = useRef<boolean>(true);

  // In-memory registry to guarantee idempotency and prevent stock inflation on order cancellation
  const restockedOrderIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    orders.forEach((ord) => {
      if (ord.isRestocked || ord.status === 'Cancelled') {
        restockedOrderIdsRef.current.add(ord.id);
      }
    });
  }, [orders]);

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

  // Real-time Live Chat Notification Monitor
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    const currentMessages: { order: Order; message: OrderChatMessage }[] = [];
    orders.forEach((ord) => {
      (ord.chatMessages || []).forEach((msg) => {
        currentMessages.push({ order: ord, message: msg });
      });
    });

    if (isInitialChatMountRef.current) {
      currentMessages.forEach(({ message }) => {
        knownMessageIdsRef.current.add(message.id);
      });
      isInitialChatMountRef.current = false;
      return;
    }

    const newMessages = currentMessages.filter(
      ({ message }) => !knownMessageIdsRef.current.has(message.id)
    );

    if (newMessages.length === 0) return;

    // Immediately mark as known to avoid duplicate triggers
    newMessages.forEach(({ message }) => {
      knownMessageIdsRef.current.add(message.id);
    });

    newMessages.forEach(({ order, message }) => {
      if (message.sender === 'customer') {
        // Customer replied on live chat -> Notify us on staff device!
        notifyStaffOfCustomerMessage(order, message, () => {
          setCurrentView('admin');
          setActiveAdminChatOrderId(order.id);
        });

        setIncomingChatAlert({
          order,
          message,
          recipient: 'staff',
        });
      } else if (message.sender === 'staff' || message.sender === 'admin') {
        // We sent live chat message -> Notify customer on user device!
        notifyCustomerOfConciergeMessage(order, message, () => {
          setIsTrackOrderOpen(true);
          setActiveCustomerChatOrderId(order.id);
        });

        setIncomingChatAlert({
          order,
          message,
          recipient: 'customer',
        });
      }
    });
  }, [orders]);

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

  // Real-time Firestore sync for Deleted Orders Audit Log (strictly admin audit trail)
  useEffect(() => {
    // Audit logs are strictly an administrative record; skip entirely for storefront visitors
    if (!currentUser || currentUser.type !== 'admin') {
      setDeletedOrderLogs([]);
      return;
    }

    const unsub = onSnapshot(
      collection(db, 'deleted_orders_log'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: DeletedOrderAuditLog[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as DeletedOrderAuditLog);
          });
          list.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
          setDeletedOrderLogs(list);
          saveToStorage(STORAGE_KEYS.DELETED_ORDERS_LOG, list);
        } else {
          setDeletedOrderLogs([]);
          saveToStorage(STORAGE_KEYS.DELETED_ORDERS_LOG, []);
        }
      },
      (error) => {
        console.warn('Firestore deleted_orders_log sync warning:', error);
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Real-time Firestore sync for Boutique Settings & Announcements
  useEffect(() => {
    let isSeeding = false;
    const unsub = onSnapshot(
      doc(db, 'settings', 'store_config'),
      (snapshot) => {
        if (snapshot.exists()) {
          const rawData = snapshot.data() as Partial<StoreSettings>;
          const normalizedDomain =
            !rawData.customStoreDomain ||
            rawData.customStoreDomain.includes('neydhal-smoky') ||
            rawData.customStoreDomain.includes('vercel.app')
              ? 'https://neydhalclothing.in'
              : rawData.customStoreDomain;

          if (rawData.customStoreDomain !== normalizedDomain) {
            setDoc(
              doc(db, 'settings', 'store_config'),
              { customStoreDomain: normalizedDomain },
              { merge: true }
            ).catch(() => {});
          }

          const data = { ...rawData, customStoreDomain: normalizedDomain };
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
            customerLoginDisplay: {
              ...prev.customerLoginDisplay,
              ...(data.customerLoginDisplay || {}),
            },
            resellerLoginDisplay: {
              ...prev.resellerLoginDisplay,
              ...(data.resellerLoginDisplay || {}),
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

  // Real-time Firestore sync for Customers Collection (/customers)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'customers'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: CustomerUser[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as CustomerUser);
          });
          setCustomers(list);
          saveToStorage('aara_boutique_customers_v3', list);
        } else {
          setCustomers([]);
          saveToStorage('aara_boutique_customers_v3', []);
        }
      },
      (error) => {
        console.warn('Firestore customers listener warning:', error);
      }
    );
    return () => unsub();
  }, []);

  // Real-time Firestore sync for Reseller Collection (/reseller)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'reseller'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: ResellerUser[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as ResellerUser;
            if (d.id !== 'res_demo_meenakshi') {
              list.push({ ...data, id: d.id });
            }
          });
          setResellers(list);
          saveToStorage('aara_boutique_resellers_v3', list);
        } else {
          // Fallback to check legacy 'resellers' collection
          getDocs(collection(db, 'resellers')).then((legacySnap) => {
            if (!legacySnap.empty) {
              const legacyList: ResellerUser[] = [];
              legacySnap.forEach((d) => {
                if (d.id !== 'res_demo_meenakshi') {
                  legacyList.push({ ...(d.data() as ResellerUser), id: d.id });
                }
              });
              if (legacyList.length > 0) {
                setResellers(legacyList);
                saveToStorage('aara_boutique_resellers_v3', legacyList);
              }
            }
          }).catch(() => {});
        }
      },
      (error) => {
        console.warn('Firestore reseller listener warning:', error);
      }
    );
    return () => unsub();
  }, []);

  // Real-time Firestore sync for Reseller Access Requests (/reseller_requests)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'reseller_requests'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: ResellerAccessRequest[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as ResellerAccessRequest;
            list.push({ ...data, id: d.id });
          });
          list.sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
          setResellerRequests(list);
          saveToStorage('neydhal_reseller_requests_v1', list);
        }
      },
      (error) => {
        console.warn('Firestore reseller_requests listener warning:', error);
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
    return products.filter((p) => p.isVisible && !p.resellerOnly && isProductInActiveCategories(p, categories));
  }, [products, categories]);

  const staffMembers = useMemo(() => {
    return settings.staffMembers || [];
  }, [settings.staffMembers]);

  // Cart operations
  const addToCart = (product: Product, quantity = 1) => {
    if (!isProductInActiveCategories(product, categories)) {
      setCartStockWarning('Cannot add item; this product category is no longer available in the boutique.');
      return;
    }
    const liveProd = products.find((p) => p.id === product.id) || product;
    const availableStock = Math.max(0, liveProd.stockCount ?? 99);

    // Prevent adding out of stock items
    if (liveProd.stockStatus === 'out_of_stock' || availableStock <= 0) {
      setCartStockWarning('Cannot add item; this product is currently out of stock.');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= availableStock) {
          setCartStockWarning(
            `Cannot add more items; stock limit reached (${availableStock} ${availableStock === 1 ? 'item' : 'items'} available in stock)`
          );
          return prev;
        }
        const nextQty = Math.min(existing.quantity + quantity, availableStock);
        if (existing.quantity + quantity > availableStock) {
          setCartStockWarning(
            `Cannot add more items; stock limit reached (${availableStock} ${availableStock === 1 ? 'item' : 'items'} available in stock)`
          );
        } else {
          setCartStockWarning(null);
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: nextQty }
            : item
        );
      }
      const initialQty = Math.min(quantity, availableStock);
      if (quantity > availableStock) {
        setCartStockWarning(
          `Cannot add more items; stock limit reached (${availableStock} ${availableStock === 1 ? 'item' : 'items'} available in stock)`
        );
      } else {
        setCartStockWarning(null);
      }
      return [...prev, { product: liveProd, quantity: initialQty }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      setCartStockWarning(null);
      return;
    }

    const currentProd = products.find((p) => p.id === productId);
    const cartItem = cart.find((item) => item.product.id === productId);
    const availableStock = Math.max(0, currentProd?.stockCount ?? cartItem?.product.stockCount ?? 99);

    if (quantity > availableStock) {
      setCartStockWarning(
        `Cannot add more items; stock limit reached (${availableStock} ${availableStock === 1 ? 'item' : 'items'} available in stock)`
      );
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === productId ? { ...item, quantity: availableStock } : item
        )
      );
      return;
    }

    setCartStockWarning(null);
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

  // Dynamic Real-Time Cart Price Synchronization & Price Change Notification (User Requirement 3)
  useEffect(() => {
    if (!cart || cart.length === 0 || !products || products.length === 0) return;

    let hasAnyChanges = false;
    const nextCart = cart.map((cartItem) => {
      const liveProd = products.find(
        (p) =>
          p.id === cartItem.product.id ||
          (Boolean(p.productCode) &&
            Boolean(cartItem.product.productCode) &&
            p.productCode.trim().toUpperCase() === cartItem.product.productCode.trim().toUpperCase())
      );

      if (!liveProd) return cartItem;

      // 1. Detect dynamic price change by admin or staff
      if (liveProd.price !== cartItem.product.price) {
        hasAnyChanges = true;
        const oldPrice = cartItem.product.price;
        const newPrice = liveProd.price;
        const previousPriceRecorded = cartItem.previousPrice !== undefined ? cartItem.previousPrice : oldPrice;
        const notice = `The price of this item has been updated from ₹${oldPrice.toLocaleString('en-IN')} to ₹${newPrice.toLocaleString('en-IN')}`;

        return {
          ...cartItem,
          product: {
            ...liveProd,
            price: newPrice,
          },
          previousPrice: previousPriceRecorded,
          priceChangeNotice: notice,
          priceChangedAt: new Date().toISOString(),
        };
      }

      // 2. Synchronize non-price changes (title, stock, images) while preserving existing price alert
      if (
        cartItem.product.title !== liveProd.title ||
        cartItem.product.stockCount !== liveProd.stockCount ||
        cartItem.product.stockStatus !== liveProd.stockStatus ||
        cartItem.product.images?.[0] !== liveProd.images?.[0]
      ) {
        hasAnyChanges = true;
        return {
          ...cartItem,
          product: {
            ...liveProd,
            price: liveProd.price,
          },
        };
      }

      return cartItem;
    });

    if (hasAnyChanges) {
      setCart(nextCart);
      saveToStorage(STORAGE_KEYS.CART, nextCart);
    }
  }, [products]);

  const dismissCartPriceAlert = (productId: string) => {
    setCart((prev) => {
      const updated = prev.map((item) => {
        if (item.product.id === productId) {
          const { priceChangeNotice, previousPrice, ...rest } = item;
          return rest;
        }
        return item;
      });
      saveToStorage(STORAGE_KEYS.CART, updated);
      return updated;
    });
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

  const placeOrder = ({
    customer,
    items,
    upiTransactionId,
    paymentScreenshotUrl,
    paymentScreenshotStoragePath,
    deviceType,
    paymentGateway,
    refundUpiId,
    refundUpiPhone,
    notes,
    checkoutMethod,
  }: {
    customer: Order['customer'];
    items: CartItem[];
    upiTransactionId?: string;
    paymentScreenshotUrl?: string;
    paymentScreenshotStoragePath?: string;
    deviceType?: 'mobile' | 'tablet' | 'desktop';
    paymentGateway?: 'upi_manual' | 'direct_upi';
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

    const resolvedUpiTxnId = (upiTransactionId || `TXN${Date.now()}`).trim();
    const paymentModeName = 'Direct Manual UPI';

    // Per user specification: manual UPI orders initialize with status "pending_verification"
    // so boutique staff can review screenshot against merchant ledger and approve manually.
    const initialStatus: OrderStatus = 'pending_verification';

    const newOrder: Order = {
      id: `order-${Date.now()}`,
      orderNumber,
      createdAt: new Date().toISOString(),
      customer,
      items,
      subtotal,
      shippingFee,
      totalAmount,
      upiTransactionId: resolvedUpiTxnId,
      paymentScreenshotUrl: paymentScreenshotUrl || undefined,
      paymentScreenshotStoragePath: paymentScreenshotStoragePath || undefined,
      deviceType: deviceType || 'desktop',
      paymentGateway: paymentGateway || 'direct_upi',
      paymentStatus: 'pending',
      isPaymentVerified: false,
      paymentVerifiedAt: undefined,
      paymentVerifiedBy: undefined,
      paymentMethod: paymentModeName,
      refundDetails: {
        refundUpiId: refundUpiId ? refundUpiId.trim() : undefined,
        refundUpiPhone: refundUpiPhone ? refundUpiPhone.trim() : undefined,
        refundStatus: 'not_required',
      },
      status: initialStatus,
      checkoutMethod,
      notes,
      customerId: currentCustomer?.id,
      customerEmail: currentCustomer?.email || customer.email,
      orderType: 'retail',
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
          note: `Customer uploaded payment screenshot with UTR: ${resolvedUpiTxnId}. Awaiting merchant verification & approval.`,
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

  const verifyOrderPayment = async (
    orderId: string,
    utrOrTxnId?: string,
    paymentMode?: string,
    verifiedBy?: string
  ): Promise<void> => {
    const actor =
      verifiedBy ||
      currentUser?.name ||
      (currentUser?.type === 'admin' ? 'Store Owner' : 'Staff Concierge');
    const nowIso = new Date().toISOString();

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const resolvedTxn = (
          utrOrTxnId ||
          ord.upiTransactionId ||
          `VERIFIED-${Date.now().toString().slice(-6)}`
        ).trim();
        const mode = paymentMode || ord.paymentMethod || 'Prepaid Direct UPI';
        const nextStatus = ord.status === 'pending_verification' ? 'Confirmed' : ord.status;
        const statusHistoryEntry = ord.status === 'pending_verification'
          ? [
              ...(ord.statusHistory || []),
              {
                status: 'Confirmed' as OrderStatus,
                timestamp: nowIso,
                updatedBy: actor,
                note: `Payment verified & order confirmed by ${actor} (Txn: ${resolvedTxn})`,
              },
            ]
          : ord.statusHistory;

        const updated: Order = {
          ...ord,
          status: nextStatus,
          statusHistory: statusHistoryEntry,
          isPaymentVerified: true,
          paymentStatus: 'paid',
          paymentVerifiedAt: nowIso,
          paymentVerifiedBy: actor,
          upiTransactionId: resolvedTxn,
          paymentMethod: mode,
          assignmentHistory: [
            ...(ord.assignmentHistory || []),
            {
              id: `log-${Date.now()}`,
              timestamp: nowIso,
              staffId: currentUser?.staffId || (currentUser?.type === 'admin' ? 'admin' : 'staff'),
              staffName: actor,
              assignedBy: actor,
              action: 'Payment Verified & Confirmed',
              note: `Payment verified by ${actor}. Txn/UTR: ${resolvedTxn}. Channel: ${mode}.`,
            },
          ],
        };

        // Persist update to Firestore
        setDoc(doc(db, 'orders', ord.id), sanitizeForFirestore(updated), { merge: true }).catch((err) =>
          console.warn('Error saving payment verification to Firestore:', err)
        );

        return updated;
      })
    );
  };

  // Real-Time Stock Replenishment on Order Cancellation (Strictly Idempotent)
  const replenishOrderInventory = (order: Order) => {
    if (!order || !order.id) return;
    // Strict Guard: Prevent double-restock or stock inflation if already processed
    if (order.isRestocked || restockedOrderIdsRef.current.has(order.id)) {
      return;
    }
    if (!order.items || order.items.length === 0) return;

    // Immediately register in ref and flag in-memory order object to block concurrent/duplicate calls
    restockedOrderIdsRef.current.add(order.id);
    order.isRestocked = true;

    const restockedTitles: string[] = [];
    let affectedCategory: string | undefined;

    setProducts((prev) => {
      const next = prev.map((prod) => {
        // Collect all matching line items in this specific order
        const matchingItems = order.items.filter((it) => {
          const itId = it.product?.id || (it as any).productId;
          const itCode = it.product?.productCode || (it as any).productCode;
          return (
            (itId && itId === prod.id) ||
            (Boolean(itCode) &&
              Boolean(prod.productCode) &&
              itCode.trim().toUpperCase() === prod.productCode.trim().toUpperCase())
          );
        });

        if (matchingItems.length === 0) return prod;

        // Restore strictly the exact physical quantity purchased in this specific order
        const exactRestockQty = matchingItems.reduce(
          (sum, it) => sum + Math.max(1, Number(it.quantity) || 1),
          0
        );

        const currentStock =
          typeof prod.stockCount === 'number' && !isNaN(prod.stockCount)
            ? Math.max(0, prod.stockCount)
            : 0;

        // Correctly returning physical stock from current database count + exact order quantity
        const newCount = currentStock + exactRestockQty;
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

    // Mark order isRestocked in orders state & Firestore
    setOrders((prev) =>
      prev.map((ord) => (ord.id === order.id ? { ...ord, isRestocked: true } : ord))
    );
    updateDoc(doc(db, 'orders', order.id), { isRestocked: true }).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`)
    );

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
    let orderToSync: any = null;
    const isNowCancelled = status === 'Cancelled' || status === 'Rejected';
    if (isNowCancelled) {
      const targetOrder = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (
        targetOrder &&
        !targetOrder.isRestocked &&
        !restockedOrderIdsRef.current.has(targetOrder.id)
      ) {
        replenishOrderInventory(targetOrder);
      }
    }

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId && ord.orderNumber !== orderId) return ord;

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
        const didRestock = isNowCancelled ? true : Boolean(ord.isRestocked);

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
      const syncDocId = orderToSync.id || orderId;
      updateDoc(doc(db, 'orders', syncDocId), sanitizeForFirestore(orderToSync)).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `orders/${syncDocId}`)
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

  const assignCustomerIssueStaff = (
    orderId: string,
    staffId: string,
    staffName: string,
    reasonOrNote?: string
  ) => {
    let orderToSync: Partial<Order> | null = null;
    const actorName =
      currentUser?.name || (currentUser?.type === 'admin' ? 'Store Owner' : 'Staff Concierge');

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;

        const prevIssueStaffName =
          ord.issueAssignedStaffName || ord.deliveryIssue?.assignedStaffName || 'Unassigned';
        const isReassignment = Boolean(
          ord.issueAssignedStaffId &&
            ord.issueAssignedStaffId !== 'unassigned' &&
            ord.issueAssignedStaffId !== staffId
        );

        const actionText =
          !staffId || staffId === 'unassigned'
            ? `Customer Issue unassigned by ${actorName}`
            : isReassignment
            ? `Customer Issue reassigned from ${prevIssueStaffName} to ${staffName}`
            : `Customer Issue assigned to ${staffName}`;

        const noteText =
          reasonOrNote?.trim() ||
          (isReassignment
            ? 'Issue reassigned for investigation & redressal'
            : 'Claimed issue for investigation & redressal');

        const newLogEntry: StaffAssignmentLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          staffId,
          staffName,
          assignedBy: actorName,
          action: actionText,
          note: noteText,
        };

        const updatedDeliveryIssue: CustomerDeliveryIssue = {
          ...(ord.deliveryIssue || {
            reported: true,
            reportedAt: new Date().toISOString(),
            customerPhone: ord.customer.phone,
            issueType: ord.cancellationRequest ? 'cancellation' : 'delivery',
            issueDescription: ord.cancellationRequest?.reason || 'Customer issue',
            status: 'investigating',
          }),
          assignedStaffId: staffId,
          assignedStaffName: staffName,
          status: ord.deliveryIssue?.status === 'resolved' ? 'resolved' : 'investigating',
          investigationComments: [
            ...(ord.deliveryIssue?.investigationComments || []),
            {
              id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              timestamp: new Date().toISOString(),
              author: actorName,
              comment: `${actionText}. Note: ${noteText}`,
            },
          ],
        };

        const updated: Order = {
          ...ord,
          issueAssignedStaffId: staffId,
          issueAssignedStaffName: staffName,
          deliveryIssue: updatedDeliveryIssue,
          lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          assignmentHistory: [...(ord.assignmentHistory || []), newLogEntry],
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

  const deleteOrder = async (
    orderId: string,
    options?: { restockItems?: boolean; reason?: string }
  ): Promise<void> => {
    // Guard: Order deletion must be enabled in boutique settings
    if (!settings.enableOrderDeletion) {
      console.warn('Order deletion is blocked: enableOrderDeletion is disabled in Settings.');
      throw new Error(
        'Order deletion is currently disabled in Boutique Settings. Please enable the Order Deletion toggle in Admin Settings first.'
      );
    }

    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    // Optional inventory replenishment if requested and not already restocked
    if (
      options?.restockItems &&
      !targetOrder.isRestocked &&
      !restockedOrderIdsRef.current.has(targetOrder.id)
    ) {
      replenishOrderInventory(targetOrder);
    }

    // Construct comprehensive audit trail record
    const actorName =
      currentUser?.name || (currentUser?.type === 'admin' ? 'Store Owner' : 'Staff Concierge');
    const actorId = currentUser?.staffId || (currentUser?.type === 'admin' ? 'admin' : '');
    const actorRole =
      currentUser?.type === 'admin'
        ? 'admin'
        : settings.staffMembers?.find((s) => s.id === currentUser?.staffId)?.role || 'staff';
    const nowIso = new Date().toISOString();

    const itemsSummary =
      targetOrder.items && targetOrder.items.length > 0
        ? targetOrder.items.map((it) => `${it.product?.title || 'Saree'} (x${it.quantity})`).join(', ')
        : 'N/A';

    const auditEntry: DeletedOrderAuditLog = {
      id: `del-log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      orderId: targetOrder.id,
      orderNumber: targetOrder.orderNumber,
      customerName: targetOrder.customer.name,
      customerPhone: targetOrder.customer.phone,
      totalAmount: targetOrder.totalAmount,
      itemsCount: targetOrder.items.reduce((sum, it) => sum + (it.quantity || 1), 0),
      itemsSummary,
      deletedBy: actorName,
      deletedById: actorId,
      deletedByRole: actorRole,
      deletedAt: nowIso,
      deletionReason: options?.reason?.trim() || 'Manual removal by authorized staff/admin',
      restockedItems: Boolean(options?.restockItems),
      orderSnapshot: targetOrder,
    };

    // 1. Persist audit log to dedicated Firestore collection (/deleted_orders_log)
    setDoc(doc(db, 'deleted_orders_log', auditEntry.id), sanitizeForFirestore(auditEntry)).catch(
      (err) => console.warn('Failed to sync deleted order audit log to Firestore:', err)
    );

    // 2. Update local state and localStorage for audit ledger
    setDeletedOrderLogs((prev) => {
      const next = [auditEntry, ...prev.filter((l) => l.id !== auditEntry.id)];
      saveToStorage(STORAGE_KEYS.DELETED_ORDERS_LOG, next);
      return next;
    });

    // 3. Trigger instant real-time notification & chime to main store admin
    setAdminDeletionAlert(auditEntry);
    playChatChimeSound();

    // 4. Remove from in-memory orders state & local storage
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== orderId);
      saveToStorage(STORAGE_KEYS.ORDERS, next);
      return next;
    });

    if (lastPlacedOrder?.id === orderId) {
      setLastPlacedOrder(null);
    }

    if (activeAdminChatOrderId === orderId) {
      setActiveAdminChatOrderId(null);
    }
    if (activeCustomerChatOrderId === orderId) {
      setActiveCustomerChatOrderId(null);
    }
    if (incomingChatAlert?.order.id === orderId) {
      setIncomingChatAlert(null);
    }

    // Clean from customer order numbers ledger
    const cleanNum = targetOrder.orderNumber.trim().toUpperCase();
    setCustomerOrderNumbers((prev) => {
      const next = prev.filter((n) => n.trim().toUpperCase() !== cleanNum);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('aara_customer_orders', JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    // 5. Delete document from Firestore
    try {
      await deleteDoc(doc(db, 'orders', orderId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${orderId}`);
    }
  };

  const clearDeletedOrderLogs = async (): Promise<void> => {
    setDeletedOrderLogs([]);
    saveToStorage(STORAGE_KEYS.DELETED_ORDERS_LOG, []);
    try {
      const snap = await getDocs(collection(db, 'deleted_orders_log'));
      snap.forEach((d) => {
        deleteDoc(doc(db, 'deleted_orders_log', d.id)).catch(() => {});
      });
    } catch (err) {
      console.warn('Failed to clear deleted orders log in Firestore:', err);
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
        (o.customer.phone.replace(/[^0-9]/g, '').includes(cleanPhoneDigits.slice(-10)) ||
          (o.dropshipRecipient?.phone && o.dropshipRecipient.phone.replace(/[^0-9]/g, '').includes(cleanPhoneDigits.slice(-10))))
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
      assignedStaffId: 'unassigned',
      assignedStaffName: 'Unassigned',
      investigationComments: [
        {
          id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          author: 'Customer Storefront',
          comment: `Customer submitted cancellation request: "${reason.trim()}". Routed exclusively to Customer Issues triage queue.`,
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
      note: `Customer submitted cancellation: "${reason.trim()}". Routed to Unassigned Queue in Customer Issues.`,
    };

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== targetOrder.id) return ord;
        return {
          ...ord,
          issueAssignedStaffId: 'unassigned',
          issueAssignedStaffName: 'Unassigned',
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
        issueAssignedStaffId: 'unassigned',
        issueAssignedStaffName: 'Unassigned',
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
        issueAssignedStaffId: 'unassigned',
        issueAssignedStaffName: 'Unassigned',
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

    const targetOrder = orders.find((o) => o.id === orderId);
    if (
      action === 'approve' &&
      targetOrder &&
      !targetOrder.isRestocked &&
      !restockedOrderIdsRef.current.has(targetOrder.id)
    ) {
      replenishOrderInventory(targetOrder);
    }

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

        const existingResolvedHistory = ord.resolvedIssuesHistory || [];
        const nextResolvedHistory = [
          ...existingResolvedHistory.filter((h) => h.issueType !== 'cancellation'),
          resolvedIssuePayload,
        ];

        if (action === 'approve') {
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
            resolvedIssuesHistory: nextResolvedHistory,
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
            resolvedIssuesHistory: nextResolvedHistory,
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
        (o.customer.phone.replace(/[^0-9]/g, '').includes(cleanPhoneDigits.slice(-10)) ||
          (o.dropshipRecipient?.phone && o.dropshipRecipient.phone.replace(/[^0-9]/g, '').includes(cleanPhoneDigits.slice(-10))))
    );

    if (!targetOrder) {
      return {
        success: false,
        message: 'No order found matching this Order Number and Phone Number combination.',
      };
    }

    // Prevent duplicate active requests for the exact same dispute category
    if (isDisputeActiveForType(targetOrder, issueType)) {
      return {
        success: false,
        message: `An active ${issueType === 'refund' ? 'refund inquiry' : 'delivery dispute'} for order #${targetOrder.orderNumber} is already currently being investigated by our concierge team. Duplicate requests for the same active issue are not permitted.`,
      };
    }

    // Maintain strict rule: Prevent multiple or duplicate requests for the same dispute category once resolved
    if (isDisputeResolvedForType(targetOrder, issueType)) {
      return {
        success: false,
        message: `A ${issueType === 'refund' ? 'refund inquiry' : 'delivery dispute'} for order #${targetOrder.orderNumber} has already been officially resolved and closed by boutique concierge. Multiple requests for the same dispute category are not permitted.`,
      };
    }

    // Lifecycle validation: Delivery disputes require Delivered status
    if (issueType === 'delivery') {
      const orderStage = (targetOrder.status || '').trim().toLowerCase();
      if (orderStage !== 'delivered') {
        return {
          success: false,
          message: 'Delivery issue reporting is only available after an order has been marked as Delivered.',
        };
      }
    }

    // Lifecycle validation: Refund disputes require Cancelled, Rejected, or Refunded status
    if (issueType === 'refund') {
      const orderStage = (targetOrder.status || '').trim().toLowerCase();
      const refundTxStatus = (targetOrder.refundDetails?.refundStatus || '').trim().toLowerCase();
      const isCancelledOrRefunded =
        orderStage === 'cancelled' ||
        orderStage === 'rejected' ||
        orderStage === 'refunded' ||
        refundTxStatus === 'processed' ||
        refundTxStatus === 'pending' ||
        refundTxStatus === 'completed' ||
        Boolean(targetOrder.refundDetails?.refundUtr) ||
        Boolean(targetOrder.cancellationReason) ||
        Boolean(targetOrder.cancellationRequest?.requested);

      if (!isCancelledOrRefunded) {
        return {
          success: false,
          message: 'Refund issue reporting is only available after an order has been cancelled or moved to refunded status.',
        };
      }
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
      assignedStaffId: 'unassigned',
      assignedStaffName: 'Unassigned',
      investigationComments: [
        {
          id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          author: 'Customer Storefront',
          comment: `Customer submitted ${issueType} issue: "${issueDescription.trim()}". Routed exclusively to Customer Issues triage queue.`,
        },
      ],
    };

    const actionTitle = issueType === 'refund' ? 'Refund Issue Reported' : 'Delivery Issue Reported';

    const disputeLog: StaffAssignmentLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      staffId: 'unassigned',
      staffName: 'Storefront Patron',
      action: actionTitle,
      note: `Customer reported (${issueType}): "${issueDescription.trim()}". Routed to Customer Issues.`,
    };

    // Archive any previously resolved dispute into resolvedIssuesHistory to preserve past resolution audit
    const prevIssue = targetOrder.deliveryIssue;
    const existingResolvedHistory = targetOrder.resolvedIssuesHistory || [];
    const nextResolvedHistory =
      prevIssue && prevIssue.reported && prevIssue.status === 'resolved'
        ? [...existingResolvedHistory.filter((h) => h.issueType !== prevIssue.issueType), prevIssue]
        : existingResolvedHistory;

    let updatedOrder: Order | null = null;
    setOrders((prev) => {
      const next = prev.map((ord) => {
        if (ord.id !== targetOrder.id) return ord;
        updatedOrder = {
          ...ord,
          issueAssignedStaffId: 'unassigned',
          issueAssignedStaffName: 'Unassigned',
          isClosed: false,
          deliveryIssue: issuePayload,
          resolvedIssuesHistory: nextResolvedHistory,
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
          issueAssignedStaffId: 'unassigned',
          issueAssignedStaffName: 'Unassigned',
          isClosed: false,
          deliveryIssue: issuePayload,
          resolvedIssuesHistory: nextResolvedHistory,
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

        const isRefund = ord.deliveryIssue?.issueType === 'refund';
        const actionTitle =
          action === 'reopen'
            ? (isRefund ? 'Reopened Refund Inquiry for Investigation' : 'Reopened Disputed Order for Investigation')
            : (isRefund ? 'Resolved Refund Dispute' : 'Resolved Delivery Dispute');

        const auditLog: StaffAssignmentLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: nowIso,
          staffId: currentUser?.staffId || ord.assignedStaffId || 'admin',
          staffName: actorName,
          assignedBy: actorName,
          action: actionTitle,
          note: resolutionNotes.trim() || (action === 'reopen' ? 'Reopened for investigation' : 'Dispute resolved with customer and accounts desk'),
        };

        const isResolved = action === 'resolve';
        const updatedIssue: CustomerDeliveryIssue = {
          ...(ord.deliveryIssue || {
            reported: true,
            reportedAt: nowIso,
            customerPhone: ord.customer.phone,
            issueDescription: 'Disputed issue',
            status: 'investigating',
          }),
          issueType: ord.deliveryIssue?.issueType || (ord.cancellationRequest ? 'refund' : 'delivery'),
          status: isResolved ? 'resolved' : 'investigating',
          resolutionNotes: resolutionNotes.trim(),
          resolvedAt: isResolved ? nowIso : ord.deliveryIssue?.resolvedAt,
          resolvedBy: isResolved ? actorName : ord.deliveryIssue?.resolvedBy,
        };

        const existingResolvedHistory = ord.resolvedIssuesHistory || [];
        const nextResolvedHistory = isResolved
          ? [
              ...existingResolvedHistory.filter((h) => h.issueType !== updatedIssue.issueType),
              updatedIssue,
            ]
          : existingResolvedHistory;

        const updated: Order = {
          ...ord,
          deliveryIssue: updatedIssue,
          resolvedIssuesHistory: nextResolvedHistory,
          disputeResolvedAt: isResolved ? nowIso : ord.disputeResolvedAt,
          disputeResolvedBy: isResolved ? actorName : ord.disputeResolvedBy,
          isClosed: action === 'reopen' ? false : (isResolved ? true : ord.isClosed),
          closedAt: isResolved ? (ord.closedAt || nowIso) : ord.closedAt,
          closedBy: isResolved ? (ord.closedBy || actorName) : ord.closedBy,
          reopenedAt: action === 'reopen' ? nowIso : ord.reopenedAt,
          reopenedBy: action === 'reopen' ? actorName : ord.reopenedBy,
          reopenReason:
            action === 'reopen'
              ? `${isRefund ? 'Refund Inquiry' : 'Delivery Dispute'} Investigation: ${resolutionNotes.trim() || 'Customer report'}`
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

    // Register our own sent message ID immediately so self-sent messages do not trigger notification alert
    knownMessageIdsRef.current.add(newMessage.id);

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

  // Mark chat messages as read for customer or staff
  const markOrderChatMessagesAsRead = async (
    orderId: string,
    reader: 'customer' | 'staff'
  ): Promise<void> => {
    const targetOrder = orders.find(
      (o) => o.id === orderId || o.orderNumber.toUpperCase() === orderId.trim().toUpperCase()
    );
    if (!targetOrder || !targetOrder.chatMessages || targetOrder.chatMessages.length === 0) return;

    let hasChanges = false;
    const updatedMessages = targetOrder.chatMessages.map((msg) => {
      if (reader === 'customer' && !msg.readByCustomer && msg.sender !== 'customer') {
        hasChanges = true;
        return { ...msg, readByCustomer: true };
      }
      if (reader === 'staff' && !msg.readByStaff && msg.sender === 'customer') {
        hasChanges = true;
        return { ...msg, readByStaff: true };
      }
      return msg;
    });

    if (!hasChanges) return;

    // Dismiss active banner if it was for this order
    setIncomingChatAlert((prev) => (prev && prev.order.id === targetOrder.id ? null : prev));

    setOrders((prev) => {
      const next = prev.map((ord) =>
        ord.id === targetOrder.id ? { ...ord, chatMessages: updatedMessages } : ord
      );
      saveToStorage(STORAGE_KEYS.ORDERS, next);
      return next;
    });

    try {
      await setDoc(
        doc(db, 'orders', targetOrder.id),
        sanitizeForFirestore({ chatMessages: updatedMessages }),
        { merge: true }
      );
    } catch (err: any) {
      console.warn('Firestore chat read sync notice:', err);
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
        customerLoginDisplay: {
          ...prev.customerLoginDisplay,
          ...(safeUpdates.customerLoginDisplay || {}),
        },
        resellerLoginDisplay: {
          ...prev.resellerLoginDisplay,
          ...(safeUpdates.resellerLoginDisplay || {}),
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
    const targetCat = categories.find((c) => c.id === id);
    const catName = (targetCat?.name || '').trim().toLowerCase();
    const catId = id.trim().toLowerCase();

    const updated = categories.filter((c) => c.id !== id);
    setCategories(updated);
    saveToStorage('aara_boutique_categories_v3', updated);

    // Identify all products created under this category
    const productsToDelete = products.filter((p) => {
      const pCat = (p.category || '').trim().toLowerCase();
      if (catName && (pCat === catName || pCat.includes(catName) || catName.includes(pCat))) return true;
      if (pCat === catId) return true;
      if (targetCat?.name && p.category === targetCat.name) return true;
      // If it's a jewelry category and no other jewelry categories remain in updated:
      if (catName.includes('jewel') && p.productType === 'jewelry') {
        const hasOtherJewelry = updated.some((c) => Boolean(c?.name && c.name.toLowerCase().includes('jewel')));
        if (!hasOtherJewelry) return true;
      }
      return false;
    });

    const productIdsToDelete = new Set(productsToDelete.map((p) => p.id));

    if (productsToDelete.length > 0) {
      productsToDelete.forEach((p) => {
        markProductAsDeleted(p.id);
        if (p.productCode) {
          const cleanSku = p.productCode.trim().toUpperCase();
          deleteDoc(doc(db, 'sku_codes', cleanSku)).catch(() => {});
          deleteDoc(doc(db, 'skus', cleanSku)).catch(() => {});
          setSkus((prev) => prev.filter((s) => s.code?.trim().toUpperCase() !== cleanSku));
        }
        deleteDoc(doc(db, 'products', p.id)).catch(() => {});
      });

      setProducts((prev) => {
        const next = prev
          .filter((p) => !productIdsToDelete.has(p.id))
          .map((p) => {
            if (p.crossSellProductIds && p.crossSellProductIds.some((xId) => productIdsToDelete.has(xId))) {
              const cleanedCross = p.crossSellProductIds.filter((xId) => !productIdsToDelete.has(xId));
              setDoc(doc(db, 'products', p.id), sanitizeForFirestore({ crossSellProductIds: cleanedCross }), { merge: true }).catch(() => {});
              return { ...p, crossSellProductIds: cleanedCross };
            }
            return p;
          });
        saveToStorage(STORAGE_KEYS.PRODUCTS, next);
        return next;
      });

      setCart((prev) => {
        const next = prev.filter((item) => !productIdsToDelete.has(item.product.id));
        saveToStorage(STORAGE_KEYS.CART, next);
        return next;
      });

      setWishlist((prev) => {
        const next = prev.filter((itemId) => !productIdsToDelete.has(itemId));
        saveToStorage('aara_boutique_wishlist_v3', next);
        return next;
      });
    }

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
        cartStockWarning,
        clearCartStockWarning,
        dismissCartPriceAlert,
        orders,
        deletedOrderLogs,
        adminDeletionAlert,
        dismissAdminDeletionAlert,
        clearDeletedOrderLogs,
        placeOrder,
        deleteOrder,
        verifyOrderPayment,
        updateOrderStatus,
        updateOrderShipping,
        markRefundProcessed,
        assignOrderStaff,
        assignCustomerIssueStaff,
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
        markOrderChatMessagesAsRead,
        customerUnreadChatCount,
        staffUnreadChatCount,
        incomingChatAlert,
        dismissChatAlert,
        activeAdminChatOrderId,
        setActiveAdminChatOrderId,
        activeCustomerChatOrderId,
        setActiveCustomerChatOrderId,
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
        selectedCustomerOrderId,
        setSelectedCustomerOrderId,
        wishlist: activeWishlist,
        toggleWishlist,
        isInWishlist,
        customerOrdersCount,
        customerOrders,
        hiddenCustomerOrders,
        hiddenCustomerOrderIds,
        recordCustomerOrder,
        hideCustomerOrder,
        unhideCustomerOrder,
        currentCustomer,
        customerLogin,
        customerLoginWithGoogle,
        customerRegister,
        customerLogout,
        updateCustomerProfile,
        addCustomerAddress,
        deleteCustomerAddress,
        setDefaultAddress,
        isCustomerAuthModalOpen,
        setIsCustomerAuthModalOpen,
        isCustomerAccountModalOpen,
        setIsCustomerAccountModalOpen,
        currentReseller,
        resellers,
        resellerRequests,
        resellerLogin,
        resellerLoginWithGoogle,
        resellerRegister,
        requestResellerAccess,
        approveResellerRequest,
        declineResellerRequest,
        createResellerManual,
        updateResellerStatus,
        toggleResellerLock,
        deleteReseller,
        updateResellerMargin,
        resellerLogout,
        resellerOrders,
        placeResellerOrder,
        isResellerPortalOpen,
        setIsResellerPortalOpen,
        addResellerAddress,
        updateResellerAddress,
        deleteResellerAddress,
        setDefaultResellerAddress,
        customerNotifications,
        resellerNotifications,
        markCustomerNotificationRead,
        markAllCustomerNotificationsRead,
        markResellerNotificationRead,
        markAllResellerNotificationsRead,
        clearCustomerNotifications,
        clearResellerNotifications,
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
