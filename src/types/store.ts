export type StandardSareeFabric =
  | 'Kanjivaram Silk'
  | 'Banarasi Brocade'
  | 'Chanderi Tissue'
  | 'Organza Silk'
  | 'Pure Georgette'
  | 'Tussar Handloom'
  | 'Cotton Silk';

export type SareeFabric = StandardSareeFabric | 'Other' | (string & {});

export type StandardSareeColor =
  | 'Crimson Red'
  | 'Emerald Green'
  | 'Lavender'
  | 'Royal Blue'
  | 'Mustard Gold'
  | 'Rani Pink'
  | 'Midnight Black'
  | 'Ivory Cream';

export type SareeColor = StandardSareeColor | (string & {});

export interface DeliverySettings {
  shippingFee: number; // Standard delivery charge (e.g. ₹150)
  freeDeliveryEnabled: boolean; // Option if customer buys more than some amount to enable free delivery
  freeDeliveryThreshold: number; // Limit fixed by admin (e.g. ₹20000)
}

export interface Product {
  id: string;
  productCode: string; // Unique SKU code per product and color (e.g. KAN-CRIM-101)
  title: string;
  subtitle: string;
  description: string;
  fabric: SareeFabric;
  color: SareeColor;
  price: number;
  originalPrice?: number;
  stockStatus: 'in_stock' | 'out_of_stock' | 'limited';
  stockCount: number;
  isVisible: boolean; // Admin visibility toggle
  images: string[];
  videoUrl?: string; // YouTube, Instagram reel, or MP4
  weaveDetails: string;
  borderType: string;
  blousePieceIncluded: boolean;
  lengthMeters: number;
  occasion: string;
  isFeatured?: boolean;
  createdAt: string;
}

export interface ProductReview {
  id: string;
  productId: string;
  customerName: string;
  rating: number; // 1 to 5 stars
  title?: string;
  comment: string;
  city?: string;
  verifiedBuyer?: boolean;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Rejected';

export interface CustomerDetails {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface ShippingDetails {
  courierName: string;
  trackingNumber: string;
  shippedAt?: string;
  estimatedDelivery?: string;
  notes?: string;
}

export interface RefundDetails {
  refundUpiId?: string;
  refundUpiPhone?: string;
  refundStatus: 'pending' | 'processed' | 'not_required';
  refundUtr?: string; // UTR reference generated upon refund
  processedAt?: string;
  notes?: string;
}

export interface CancellationRequest {
  requested: boolean;
  requestedAt: string;
  reason: string;
  customerPhone: string;
  status: 'pending' | 'approved' | 'rejected';
  adminDecisionNotes?: string;
}

export interface StaffSectionPermissions {
  orders: { canView: boolean; canEdit: boolean };
  products: { canView: boolean; canEdit: boolean };
  analytics: { canView: boolean };
  staff: { canView: boolean; canEdit: boolean };
  settingsStorefront: { canView: boolean; canEdit: boolean };
  settingsAnnouncement: { canView: boolean; canEdit: boolean };
  settingsPayment: { canView: boolean; canEdit: boolean };
  settingsProfile: { canView: boolean; canEdit: boolean };
  settingsChatTemplates: { canView: boolean; canEdit: boolean };
  settingsDelivery?: { canView: boolean; canEdit: boolean };
}

export interface StaffMember {
  id: string;
  name: string;
  username: string;
  password?: string;
  email?: string; // Google account / Gmail ID for Google Authentication
  authMethod?: 'google' | 'password' | 'both';
  role: 'manager' | 'concierge' | 'fulfillment';
  isLocked: boolean;
  phone: string;
  createdAt: string;
  permissions?: StaffSectionPermissions;
}

export interface OrderStatusChatTemplates {
  pending: string;
  confirmed: string;
  shipped: string;
  delivered: string;
  cancelled: string;
  rejected: string;
  refunded: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  customer: CustomerDetails;
  items: CartItem[];
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  upiTransactionId: string;
  refundDetails: RefundDetails;
  shippingDetails?: ShippingDetails;
  status: OrderStatus;
  checkoutMethod: 'submit_order' | 'whatsapp';
  notes?: string;
  cancellationReason?: string; // Explanation when cancelled or rejected
  cancellationRequest?: CancellationRequest; // Customer requested cancellation
  assignedStaffId?: string; // Staff member assigned to handle this order
  assignedStaffName?: string;
  lastUpdatedBy?: string; // Staff username who made the last change
}

export type StoreTheme = 'maroon' | 'emerald' | 'sapphire' | 'rosewood' | 'gold';

export interface AnnouncementSettings {
  enabled: boolean;
  text: string;
  badgeLabel: string;
}

export interface PaymentSettings {
  upiId: string;
  payeeName: string;
  qrCodeUrl: string;
  instructions: string;
}

export interface StorefrontDisplaySettings {
  heroHeadline: string;
  heroSubheadline: string;
  showHeroBanner: boolean;
  heroBannerImageUrl?: string; // Optional custom uploaded hero banner
  showTrustBadges: boolean;
  showCraftsmanshipStory: boolean;
  storyTitle: string;
  storyContent: string;
  showTrackOrder: boolean;
  allowPublicCancellation: boolean;
  freeShippingText: string;
  footerAboutText?: string;
  footerCertifications?: string[];
  footerPolicies?: string[];
  heroKickerTags?: string[];
}

export interface StoreSettings {
  boutiqueName: string;
  logoUrl?: string; // Optional custom uploaded brand logo
  tagline: string;
  contactPhone: string;
  contactEmail: string;
  instagramHandle: string;
  storeAddress: string;
  currencySymbol: string;
  theme: StoreTheme;
  announcement: AnnouncementSettings;
  payment: PaymentSettings;
  delivery: DeliverySettings;
  storefrontDisplay: StorefrontDisplaySettings;
  adminPin: string; // 6-digit access PIN
  adminGoogleEmail?: string; // Designated Google Account email for Owner/Admin
  customStoreDomain?: string; // Custom domain or Vercel URL (e.g. https://aara-heritage.vercel.app)
  ordersSpreadsheetId?: string;
  ordersSpreadsheetUrl?: string;
  analyticsSpreadsheetId?: string;
  analyticsSpreadsheetUrl?: string;
  staffMembers: StaffMember[];
  chatTemplates: OrderStatusChatTemplates;
  defaultStaffPermissions?: StaffSectionPermissions;
}
