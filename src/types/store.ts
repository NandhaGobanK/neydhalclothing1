export type SareeFabric =
  | 'Kanjivaram Silk'
  | 'Banarasi Brocade'
  | 'Chanderi Tissue'
  | 'Organza Silk'
  | 'Pure Georgette'
  | 'Tussar Handloom'
  | 'Cotton Silk';

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

export interface StaffMember {
  id: string;
  name: string;
  username: string;
  password: string;
  role: 'manager' | 'concierge' | 'fulfillment';
  isLocked: boolean;
  phone: string;
  createdAt: string;
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
  storefrontDisplay: StorefrontDisplaySettings;
  adminPin: string; // 6-digit access PIN
  staffMembers: StaffMember[];
}
