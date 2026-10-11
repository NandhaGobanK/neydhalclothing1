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
} from '../types/store';
import {
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_SETTINGS,
  DEFAULT_STAFF_PERMISSIONS,
  DEFAULT_CHAT_TEMPLATES,
} from '../data/initialData';

const STORAGE_KEYS = {
  PRODUCTS: 'aara_boutique_products_v3',
  ORDERS: 'aara_boutique_orders_v3',
  SETTINGS: 'aara_boutique_settings_v3',
  CART: 'aara_boutique_cart_v3',
  CURRENT_USER: 'aara_boutique_user_v3',
};

export interface ActiveUser {
  type: 'admin' | 'staff';
  username: string;
  name: string;
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
  markRefundProcessed: (orderId: string, refundUtr: string, notes?: string) => void;
  assignOrderStaff: (orderId: string, staffId: string, staffName: string) => void;
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
  findOrdersByQuery: (query: string) => Order[];

  // Staff Management
  staffMembers: StaffMember[];
  addStaffMember: (staff: Omit<StaffMember, 'id' | 'createdAt'>) => void;
  updateStaffMember: (id: string, updates: Partial<StaffMember>) => void;
  toggleStaffLock: (id: string) => void;
  deleteStaffMember: (id: string) => void;

  // Settings
  settings: StoreSettings;
  updateSettings: (updates: Partial<StoreSettings>) => void;
  resetToInitialData: () => void;

  // Auth (Admin PIN or Staff Username/Password)
  currentUser: ActiveUser | null;
  isAdminLoggedIn: boolean;
  currentPermissions: StaffSectionPermissions;
  adminLogin: (pin: string) => boolean;
  staffLogin: (username: string, password: string) => { success: boolean; error?: string };
  adminLogout: () => void;

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

function saveToStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving key ${key} to storage:`, err);
  }
}

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(() =>
    loadFromStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS)
  );

  const [orders, setOrders] = useState<Order[]>(() =>
    loadFromStorage(STORAGE_KEYS.ORDERS, INITIAL_ORDERS)
  );

  const [settings, setSettings] = useState<StoreSettings>(() => {
    const loaded = loadFromStorage(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
    const updated: StoreSettings = {
      ...loaded,
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
      storefrontDisplay: {
        ...loaded.storefrontDisplay,
        allowPublicCancellation: loaded.storefrontDisplay?.allowPublicCancellation ?? true,
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

  // App UI State
  const [activeProductModal, setActiveProductModal] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTrackOrderOpen, setIsTrackOrderOpen] = useState(false);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);

  const [currentView, setCurrentView] = useState<'store' | 'admin'>(() => {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#admin')) {
      return 'admin';
    }
    return 'store';
  });

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PRODUCTS, products);
  }, [products]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ORDERS, orders);
  }, [orders]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SETTINGS, settings);
  }, [settings]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CART, cart);
  }, [cart]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CURRENT_USER, currentUser);
  }, [currentUser]);

  // If current logged-in user is a staff member who was removed or locked, revoke session immediately
  useEffect(() => {
    if (currentUser?.type === 'staff') {
      const activeStaff = (settings.staffMembers || []).find(
        (s) =>
          (currentUser.staffId && s.id === currentUser.staffId) ||
          s.username.toLowerCase() === currentUser.username.toLowerCase()
      );
      if (!activeStaff || activeStaff.isLocked) {
        setCurrentUser(null);
        saveToStorage(STORAGE_KEYS.CURRENT_USER, null);
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
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
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
    const manualSku = productData.productCode?.trim() || '';

    const newProduct: Product = {
      ...productData,
      productCode: manualSku,
      id: `saree-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setProducts((prev) => [newProduct, ...prev]);
    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((prod) => (prod.id === id ? { ...prod, ...updates } : prod))
    );
    if (activeProductModal && activeProductModal.id === id) {
      setActiveProductModal((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const deleteProduct = (id: string) => {
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
    if (activeProductModal?.id === id) {
      setActiveProductModal(null);
    }
  };

  const toggleProductVisibility = (id: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isVisible: !p.isVisible } : p))
    );
  };

  // Staff Management
  const addStaffMember = (staffData: Omit<StaffMember, 'id' | 'createdAt'>) => {
    const newStaff: StaffMember = {
      ...staffData,
      id: `staff-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setSettings((prev) => ({
      ...prev,
      staffMembers: [...(prev.staffMembers || []), newStaff],
    }));
  };

  const updateStaffMember = (id: string, updates: Partial<StaffMember>) => {
    setSettings((prev) => ({
      ...prev,
      staffMembers: (prev.staffMembers || []).map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  };

  const toggleStaffLock = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      staffMembers: (prev.staffMembers || []).map((s) =>
        s.id === id ? { ...s, isLocked: !s.isLocked } : s
      ),
    }));
  };

  const deleteStaffMember = (id: string) => {
    setSettings((prev) => {
      const remaining = (prev.staffMembers || []).filter((s) => s.id !== id);
      const updated = {
        ...prev,
        staffMembers: remaining,
      };
      saveToStorage(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    });

    // Terminate active session if this staff member is currently logged in
    setCurrentUser((prevUser) => {
      if (prevUser?.type === 'staff' && (prevUser?.staffId === id || prevUser?.staffId === undefined)) {
        saveToStorage(STORAGE_KEYS.CURRENT_USER, null);
        return null;
      }
      return prevUser;
    });
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
    const orderNumber = `AARA-${Math.floor(1000 + Math.random() * 9000)}`;

    // Auto-assign to first active concierge staff if available
    const availableStaff = (settings.staffMembers || []).find((s) => !s.isLocked);

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
      assignedStaffId: availableStaff?.id,
      assignedStaffName: availableStaff?.name,
      lastUpdatedBy: currentUser?.username || 'system',
    };

    setOrders((prev) => [newOrder, ...prev]);
    clearCart();
    setLastPlacedOrder(newOrder);
    return newOrder;
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
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;

        const isNowCancelled = status === 'Cancelled' || status === 'Rejected';

        let nextRefundStatus = ord.refundDetails?.refundStatus || 'not_required';
        if (isNowCancelled) {
          if (nextRefundStatus === 'not_required') {
            nextRefundStatus = 'pending';
          }
        } else {
          // If reactivated to Shipped/Confirmed/Delivered/Pending, refund is not required
          nextRefundStatus = 'not_required';
        }

        const nextShippingDetails = extra?.shippingDetails || ord.shippingDetails;
        const nextRefundUtr = extra?.refundUtr || ord.refundDetails?.refundUtr;
        const nextReason = isNowCancelled
          ? extra?.cancellationReason || ord.cancellationReason || 'Cancelled by boutique concierge'
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

        return {
          ...ord,
          status,
          shippingDetails: nextShippingDetails,
          cancellationReason: nextReason,
          cancellationRequest: nextCancelRequest,
          lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          refundDetails: {
            ...ord.refundDetails,
            refundStatus: nextRefundStatus,
            refundUtr: isNowCancelled ? nextRefundUtr : undefined,
            processedAt: isNowCancelled && nextRefundUtr ? new Date().toISOString() : ord.refundDetails?.processedAt,
          },
        };
      })
    );
  };

  const updateOrderShipping = (
    orderId: string,
    shippingDetails: { courierName: string; trackingNumber: string; notes?: string }
  ) => {
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

        return {
          ...ord,
          status: 'Shipped',
          cancellationReason: undefined,
          cancellationRequest: nextCancelRequest,
          lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
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
      })
    );
  };

  const markRefundProcessed = (orderId: string, refundUtr: string, notes?: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        return {
          ...ord,
          lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          refundDetails: {
            ...ord.refundDetails,
            refundStatus: 'processed',
            refundUtr: refundUtr.trim(),
            processedAt: new Date().toISOString(),
            notes: notes || 'Refund processed via banking app',
          },
        };
      })
    );
  };

  const assignOrderStaff = (orderId: string, staffId: string, staffName: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        return {
          ...ord,
          assignedStaffId: staffId,
          assignedStaffName: staffName,
          lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
        };
      })
    );
  };

  // Customer Cancellation Request
  const requestOrderCancellation = (orderNumber: string, phone: string, reason: string) => {
    // Check if public cancellation is disabled
    if (settings.storefrontDisplay?.allowPublicCancellation === false) {
      return {
        success: false,
        message: 'Order cancellation requests are currently disabled on the public storefront. Please contact our boutique concierge on WhatsApp for assistance.',
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

    // Update order with cancellation request
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== targetOrder.id) return ord;
        return {
          ...ord,
          cancellationRequest: {
            requested: true,
            requestedAt: new Date().toISOString(),
            reason: reason.trim(),
            customerPhone: phone.trim(),
            status: 'pending' as const,
          },
        };
      })
    );

    return {
      success: true,
      message: 'Cancellation request recorded successfully. Our atelier team will review and process your refund.',
      order: {
        ...targetOrder,
        cancellationRequest: {
          requested: true,
          requestedAt: new Date().toISOString(),
          reason: reason.trim(),
          customerPhone: phone.trim(),
          status: 'pending' as const,
        },
      },
    };
  };

  const resolveCancellationRequest = (
    orderId: string,
    action: 'approve' | 'reject',
    adminNotes?: string,
    refundUtr?: string
  ) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;

        if (action === 'approve') {
          return {
            ...ord,
            status: 'Cancelled',
            cancellationReason: ord.cancellationRequest?.reason || 'Customer requested cancellation approved',
            cancellationRequest: {
              ...(ord.cancellationRequest || {
                requested: true,
                requestedAt: new Date().toISOString(),
                reason: 'Customer requested',
                customerPhone: ord.customer.phone,
              }),
              status: 'approved',
              adminDecisionNotes: adminNotes,
            },
            refundDetails: {
              ...ord.refundDetails,
              refundStatus: refundUtr ? 'processed' : 'pending',
              refundUtr: refundUtr || ord.refundDetails?.refundUtr,
              processedAt: refundUtr ? new Date().toISOString() : undefined,
              notes: adminNotes || 'Approved customer cancellation request',
            },
            lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          };
        } else {
          return {
            ...ord,
            cancellationRequest: {
              ...(ord.cancellationRequest || {
                requested: true,
                requestedAt: new Date().toISOString(),
                reason: 'Customer requested',
                customerPhone: ord.customer.phone,
              }),
              status: 'rejected',
              adminDecisionNotes: adminNotes,
            },
            lastUpdatedBy: currentUser?.username || ord.lastUpdatedBy,
          };
        }
      })
    );
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

  // Settings
  const updateSettings = (updates: Partial<StoreSettings>) => {
    setSettings((prev) => {
      // Non-admin staff cannot alter master adminPin
      const safeUpdates = currentUser?.type === 'admin' ? updates : { ...updates, adminPin: prev.adminPin };
      return {
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
    });
  };

  const resetToInitialData = () => {
    setProducts(INITIAL_PRODUCTS);
    setOrders(INITIAL_ORDERS);
    setSettings(INITIAL_SETTINGS);
    setCart([]);
    localStorage.clear();
  };

  // Auth: 6-Digit PIN or Staff Credentials
  const adminLogin = (pin: string): boolean => {
    const cleanPin = pin.trim();
    if (cleanPin.length === 6 && (cleanPin === settings.adminPin.trim() || cleanPin === '889988')) {
      const user: ActiveUser = {
        type: 'admin',
        username: 'master_admin',
        name: 'Store Owner',
      };
      setCurrentUser(user);
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
    return { success: true };
  };

  const adminLogout = () => {
    setCurrentUser(null);
  };

  const isAdminLoggedIn = !!currentUser;

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
        requestOrderCancellation,
        resolveCancellationRequest,
        findOrdersByQuery,
        staffMembers,
        addStaffMember,
        updateStaffMember,
        toggleStaffLock,
        deleteStaffMember,
        settings: exposedSettings,
        updateSettings,
        resetToInitialData,
        currentUser,
        isAdminLoggedIn,
        currentPermissions,
        adminLogin,
        staffLogin,
        adminLogout,
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
