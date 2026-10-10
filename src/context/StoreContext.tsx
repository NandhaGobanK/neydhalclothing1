import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  Product,
  Order,
  StoreSettings,
  CartItem,
  OrderStatus,
  ShippingDetails,
  StaffMember,
} from '../types/store';
import { INITIAL_PRODUCTS, INITIAL_ORDERS, INITIAL_SETTINGS } from '../data/initialData';

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

  const [settings, setSettings] = useState<StoreSettings>(() =>
    loadFromStorage(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS)
  );

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

  // Product management with auto SKU generation
  const addProduct = (productData: Omit<Product, 'id' | 'createdAt'>): Product => {
    const prefix = productData.fabric.substring(0, 3).toUpperCase();
    const colPrefix = productData.color.substring(0, 4).toUpperCase();
    const randomCode = Math.floor(100 + Math.random() * 900);
    const generatedSku = productData.productCode?.trim() || `${prefix}-${colPrefix}-${randomCode}`;

    const newProduct: Product = {
      ...productData,
      productCode: generatedSku,
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
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setCart((prev) => prev.filter((item) => item.product.id !== id));
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
    setSettings((prev) => ({
      ...prev,
      staffMembers: (prev.staffMembers || []).map((s) => s).filter((s) => s.id !== id),
    }));
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
      shippingFee: 0,
      totalAmount: subtotal,
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

    if (targetOrder.status === 'Cancelled' || targetOrder.status === 'Rejected') {
      return {
        success: false,
        message: `Order #${targetOrder.orderNumber} is already ${targetOrder.status.toLowerCase()}.`,
        order: targetOrder,
      };
    }

    if (targetOrder.status === 'Delivered') {
      return {
        success: false,
        message: 'Order has already been delivered. Please contact our concierge directly on WhatsApp for returns.',
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
            status: 'pending',
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
          status: 'pending',
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
    setSettings((prev) => ({
      ...prev,
      ...updates,
      announcement: {
        ...prev.announcement,
        ...(updates.announcement || {}),
      },
      payment: {
        ...prev.payment,
        ...(updates.payment || {}),
      },
      storefrontDisplay: {
        ...prev.storefrontDisplay,
        ...(updates.storefrontDisplay || {}),
      },
    }));
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
    if (cleanPin.length === 6 && cleanPin === settings.adminPin.trim()) {
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
      return { success: false, error: 'Staff account not found' };
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
        settings,
        updateSettings,
        resetToInitialData,
        currentUser,
        isAdminLoggedIn,
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
