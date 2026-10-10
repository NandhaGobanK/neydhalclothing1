export type SareeFabric =
  | 'Kanjivaram Silk'
  | 'Banarasi Brocade'
  | 'Chanderi Tissue'
  | 'Organza Silk'
  | 'Pure Georgette'
  | 'Tussar Handloom'
  | 'Cotton Silk';

export type SareeColor =
  | 'Crimson Red'
  | 'Emerald Green'
  | 'Lavender'
  | 'Royal Blue'
  | 'Mustard Gold'
  | 'Rani Pink'
  | 'Midnight Black'
  | 'Ivory Cream';

export interface Product {
  id: string;
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

export interface RefundDetails {
  refundUpiId: string;
  refundUpiPhone: string;
  refundStatus: 'pending' | 'processed' | 'not_required';
  processedAt?: string;
  notes?: string;
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
  status: OrderStatus;
  checkoutMethod: 'submit_order' | 'whatsapp';
  notes?: string;
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

export interface StoreSettings {
  boutiqueName: string;
  tagline: string;
  contactPhone: string;
  contactEmail: string;
  instagramHandle: string;
  storeAddress: string;
  currencySymbol: string;
  theme: StoreTheme;
  announcement: AnnouncementSettings;
  payment: PaymentSettings;
  adminPin: string;
}
