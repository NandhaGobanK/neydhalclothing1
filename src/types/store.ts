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

export interface ProductAttributeDefinition {
  id: string; // Unique attribute ID (e.g. attr-weave, attr-length, or custom id)
  name: string; // Column/Specification title (e.g. "Weave Technique", "Sleeve Cut", "Length (Meters)")
  placeholder?: string;
  isOptional?: boolean; // True if this field is optional
}

export interface Product {
  id: string;
  productCode: string; // Unique SKU code per product and color (e.g. KAN-CRIM-101)
  title: string;
  subtitle: string;
  description: string;
  fabric?: SareeFabric; // Optional fabric type
  color: SareeColor;
  price: number;
  originalPrice?: number;
  stockStatus: 'in_stock' | 'out_of_stock' | 'limited';
  stockCount: number;
  isVisible: boolean; // Admin visibility toggle
  images: string[];
  videoUrl?: string; // YouTube, Instagram reel, or MP4
  instagramShortsUrl?: string; // Dedicated Instagram Shorts / Reel URL
  weaveDetails?: string;
  borderType?: string;
  blousePieceIncluded?: boolean;
  lengthMeters?: number;
  occasion?: string;
  customAttributes?: Record<string, string>; // Dynamic specification key-value pairs
  isFeatured?: boolean;
  createdAt: string;
  skuEditCount?: number; // Count of SKU modifications (maximum 1 allowed)
  isSkuLocked?: boolean; // True once edited one time; locks SKU permanently
  initialSku?: string; // Original SKU stored upon creation for comparison
  category?: string; // Category grouping (e.g. Poontamil Sarees, Foil Print Sarees, etc.)
}

export interface SareeCategory {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  displayOrder?: number;
}

export interface SkuRecord {
  code: string; // Uppercase SKU code, acts as primary key in /skus collection
  productId: string;
  productTitle: string;
  category?: string;
  createdAt: string;
  updatedAt?: string;
  isLocked: boolean;
  editCount: number;
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

export interface InvestigationComment {
  id: string;
  timestamp: string;
  author: string;
  authorId?: string;
  comment: string;
}

export interface CustomerDeliveryIssue {
  reported: boolean;
  reportedAt: string;
  customerPhone: string;
  issueType?: 'delivery' | 'refund' | 'general'; // Delivery issue vs Refund issue
  issueDescription: string;
  status: 'open' | 'investigating' | 'resolved';
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  investigationComments?: InvestigationComment[];
}

export interface CourierService {
  id: string;
  name: string; // e.g. DTDC Express, Salem Professional Couriers, Blue Dart
  code: string;
  addressLine1: string;
  addressLine2?: string;
  city: string; // e.g. Salem, Chennai, Coimbatore
  pincode: string;
  phone: string;
  supportEmail: string;
  mapsUrl: string; // Sharable Google Maps Link
  trackingUrl?: string; // Official courier tracking website URL (e.g. https://www.dtdc.in/tracking.asp)
  trackingUrlTemplate?: string;
  isActive: boolean;
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

export interface LoginPunchRecord {
  id: string;
  punchedAt: string; // Device time ISO string
  authMethod: 'google' | 'password' | 'admin_switch';
  deviceTimeFormatted?: string;
  deviceTimezone?: string;
}

export interface StaffIdleAlertSettings {
  enabled: boolean; // Enable or disable idle alerts to admin
  idleThresholdMinutes: number; // Idle threshold in minutes (default 15)
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
  isLoggedIn?: boolean; // Live login status
  lastLoginAt?: string;
  lastLogoutAt?: string;
  loginPunchAt?: string; // Latest login punch timestamp synced with staff device
  loginPunchHistory?: LoginPunchRecord[]; // Punch-in attendance ledger
  isIdle?: boolean; // True if staff was idle for 15+ minutes
  idleSince?: string; // Timestamp when idle threshold reached
  lastActiveAt?: string; // Timestamp of latest staff activity on their device
  sessionRevokedAt?: string; // Set when admin remotely logs out user
  permissions?: StaffSectionPermissions;
}

export interface StaffAssignmentLog {
  id: string;
  timestamp: string;
  staffId: string;
  staffName: string;
  assignedBy?: string;
  action: string; // e.g. "Assigned order", "Reassigned from Nandha to Gugan due to emergency leave", "Started working on order"
  note?: string;
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

export interface OrderChatMessage {
  id: string;
  sender: 'customer' | 'staff' | 'admin';
  senderName: string;
  senderId?: string;
  message: string;
  timestamp: string;
  readByCustomer?: boolean;
  readByStaff?: boolean;
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
  assignmentHistory?: StaffAssignmentLog[]; // Work and assignment tracking history
  isClosed?: boolean; // Order closed after delivery completion
  closedAt?: string;
  closedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string; // Mandatory explanation required upon reopening a closed order
  deliveredAt?: string; // Dedicated timestamp when status changed to Delivered
  completedAt?: string; // Dedicated timestamp when order fully closed/delivered
  disputeResolvedAt?: string; // Dedicated timestamp when delivery dispute officially resolved
  disputeResolvedBy?: string;
  assignedAt?: string; // Dedicated timestamp when order claimed/assigned to staff
  claimedAt?: string;
  deliveryIssue?: CustomerDeliveryIssue; // Customer delivery non-receipt report / dispute
  chatMessages?: OrderChatMessage[]; // Direct real-time chat between customer and staff
}

export type ThemeMode = 'light' | 'dark';

export type StoreTheme =
  | 'royal_crimson'
  | 'midnight_obsidian'
  | 'kanjivaram_fuchsia'
  | 'peacock_teal'
  | 'ivory_charcoal'
  | 'terracotta_sand'
  | 'lavender_amethyst'
  | 'emerald_forest'
  | 'maroon'
  | 'emerald'
  | 'sapphire'
  | 'rosewood'
  | 'gold';

export interface GoogleMapsSettings {
  enabled: boolean;
  mapUrl?: string; // Google Maps share URL or Embed link
  placeName?: string; // e.g. "Aara Heritage Boutique, T. Nagar, Chennai"
}

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
  allowPublicRefunds?: boolean; // Refund feature enable/disable toggle option
  showCustomerReviews?: boolean; // Enable or disable review section display on customer front
  allowCustomerDeliveryDisputes?: boolean; // Global toggle: Report delivery issue on customer front
  allowCustomerRefundDisputes?: boolean; // Global toggle: Report refund issue on customer front
  allowLiveChat?: boolean; // Dedicated Enable/Disable toggle switch for customer live chat availability
  freeShippingText: string;
  footerAboutText?: string;
  footerCertifications?: string[];
  footerPolicies?: string[];
  heroKickerTags?: string[];
}

export interface AdminOnlineStatus {
  isLoggedIn: boolean;
  lastLoginAt?: string;
  lastLogoutAt?: string;
}

export interface StoreSettings {
  boutiqueName: string;
  logoUrl?: string; // Optional custom uploaded brand logo
  tagline: string;
  contactPhone: string;
  contactEmail: string;
  instagramHandle: string;
  youtubeHandle?: string; // YouTube Channel or Handle (e.g. @neydhal_heritage)
  storeAddress: string;
  gstNumber?: string; // Shop GST Number (e.g. 33AAAAA0000A1Z5)
  googleMaps?: GoogleMapsSettings; // Google Maps location & toggle
  currencySymbol: string;
  theme: StoreTheme;
  themeMode?: ThemeMode; // Light or Dark theme mode
  announcement: AnnouncementSettings;
  payment: PaymentSettings;
  delivery: DeliverySettings;
  storefrontDisplay: StorefrontDisplaySettings;
  adminPin: string; // 6-digit access PIN
  adminGoogleEmail?: string; // Designated Google Account email for Owner/Admin
  adminOnlineStatus?: AdminOnlineStatus; // Live status of store admin / owner
  customStoreDomain?: string; // Custom domain or Vercel URL (e.g. https://aara-heritage.vercel.app)
  ordersSpreadsheetId?: string;
  ordersSpreadsheetUrl?: string;
  analyticsSpreadsheetId?: string;
  analyticsSpreadsheetUrl?: string;
  courierServices?: CourierService[]; // Configured boutique courier partners with address and maps
  staffMembers: StaffMember[];
  chatTemplates: OrderStatusChatTemplates;
  defaultStaffPermissions?: StaffSectionPermissions;
  staffIdleAlert?: StaffIdleAlertSettings;
  sareeCategories?: SareeCategory[]; // Configured saree and apparel categories
  productAttributes?: ProductAttributeDefinition[]; // Flexible custom specifications / attributes
  isFabricOptional?: boolean; // Admin preference: whether Fabric Type is optional
  isFreshBrandNew?: boolean; // True when reset to clean fresh state
  lastResetAt?: string; // Timestamp of latest fresh reset
}
