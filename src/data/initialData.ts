import {
  Product,
  StoreSettings,
  Order,
  OrderStatusChatTemplates,
  StaffSectionPermissions,
  SareeCategory,
  ProductAttributeDefinition,
  CustomerLoginDisplaySettings,
  ResellerLoginDisplaySettings,
} from '../types/store';

export const DEFAULT_CHAT_TEMPLATES: OrderStatusChatTemplates = {
  pending: `Namaste {customerName},

Thank you for choosing *{boutiqueName}*.
We have received your saree reservation request:
• Order Reference: *#{orderNumber}*
• Items: {itemsSummary}
• Total Amount: *{totalAmount}*
• Payment UTR: *{upiTransactionId}*

Our atelier team is currently verifying your payment transaction. You can check your order status anytime here:
🔗 {trackingLink}{staffSignature}

Warm regards,
{boutiqueName}`,

  confirmed: `Namaste {customerName},

✨ Great news! Your order *#{orderNumber}* has been *CONFIRMED* by *{boutiqueName}*.

• Order: *#{orderNumber}*
• Items: {itemsSummary}
• Payment UTR: *{upiTransactionId}* (Verified)

Your pure silk heirloom is being inspected and packed in our signature tamper-proof box. We will notify you once dispatched!

Track status:
🔗 {trackingLink}{staffSignature}

Warm regards,
{boutiqueName}`,

  shipped: `Namaste {customerName},

📦 Your handloom saree order *#{orderNumber}* has been *DISPATCHED*!

• Courier Partner: *{courierName}*
• Tracking / Consignment ID: *{trackingNumber}*
• Items: {itemsSummary}

_Please note: As our shipments are insured and artisan-direct, you can monitor your order status on our boutique website using your order number or phone number:_
🔗 {trackingLink}{staffSignature}

Delivery is typically completed within 2–5 business days.
Warm regards,
{boutiqueName}`,

  delivered: `Namaste {customerName},

🎉 Your order *#{orderNumber}* has been *DELIVERED*!

We hope you cherish the craftsmanship and texture of your handloom drape. If you'd like to share photos or tag us on Instagram, find us at *{instagramHandle}*.{staffSignature}

Thank you for supporting authentic Indian weavers.
Warm regards,
{boutiqueName}`,

  cancelled: `Namaste {customerName},

Regarding your order *#{orderNumber}* at *{boutiqueName}*:

Your order has been marked as *CANCELLED*.{reasonNotice}
{refundStatusNotice}
• Refund Amount: *{totalAmount}*{refundUtrText}{refundUpiText}{staffSignature}

If you have any questions, our concierge team is always available here on WhatsApp.
Warm regards,
{boutiqueName}`,

  rejected: `Namaste {customerName},

Regarding your order *#{orderNumber}* at *{boutiqueName}*:

Your order reservation has been *REJECTED*.{reasonNotice}
{refundStatusNotice}
• Refund Amount: *{totalAmount}*{refundUtrText}{refundUpiText}{staffSignature}

If you have any questions, our concierge team is always available here on WhatsApp.
Warm regards,
{boutiqueName}`,

  refunded: `Namaste {customerName},

Regarding your order *#{orderNumber}* at *{boutiqueName}* for {totalAmount}:

Your refund has been successfully completed:{reasonNotice}
• Refund Transaction UTR ID: *{refundUtr}*
• Refund Amount: *{totalAmount}*
• Sent to UPI: *{refundUpi}*

Thank you for your gracious understanding.
Warm regards,
{boutiqueName} Concierge`,
};

export const DEFAULT_STAFF_PERMISSIONS: StaffSectionPermissions = {
  orders: { canView: true, canEdit: true },
  products: { canView: true, canEdit: false },
  analytics: { canView: false },
  staff: { canView: false, canEdit: false },
  settingsStorefront: { canView: false, canEdit: false },
  settingsAnnouncement: { canView: true, canEdit: false },
  settingsPayment: { canView: false, canEdit: false },
  settingsProfile: { canView: true, canEdit: false },
  settingsChatTemplates: { canView: true, canEdit: false },
  settingsDelivery: { canView: true, canEdit: false },
};

export const DEFAULT_SAREE_CATEGORIES: SareeCategory[] = [
  {
    id: 'cat-kanjivaram',
    name: 'Kanjivaram Silk',
    description: 'Authentic pure mulberry silk sarees with pure gold zari borders handwoven in Kanchipuram.',
    imageUrl: '/assets/images/saree_kanjivaram_crimson_1791651781402.jpg',
    displayOrder: 1,
  },
  {
    id: 'cat-banarasi',
    name: 'Banarasi Brocade',
    description: 'Royal pit-loom kadwa weave drapes with floral jaals from the holy ghats of Varanasi.',
    imageUrl: '/assets/images/saree_banarasi_emerald_1791651794836.jpg',
    displayOrder: 2,
  },
  {
    id: 'cat-chanderi',
    name: 'Chanderi Tissue',
    description: 'Feather-light sheer gossamer silk drapes with shimmering Roopa Kalabattu silver zari.',
    imageUrl: '/assets/images/saree_chanderi_lavender_1791651806313.jpg',
    displayOrder: 3,
  },
  {
    id: 'cat-organza',
    name: 'Organza Silk',
    description: 'Contemporary translucent silk organza with delicate hand embroidery and gota patti borders.',
    imageUrl: '/assets/images/saree_chanderi_lavender_1791651806313.jpg',
    displayOrder: 4,
  },
  {
    id: 'cat-georgette',
    name: 'Pure Georgette',
    description: 'High-twist crinkled pure khaddi georgette with antique tilla and matte gold leaf work.',
    imageUrl: '/assets/images/saree_banarasi_emerald_1791651794836.jpg',
    displayOrder: 5,
  },
  {
    id: 'cat-blouses',
    name: 'Designer Blouses',
    description: 'Handcrafted bespoke zardozi and raw silk blouses curated to pair with heirloom sarees.',
    imageUrl: '/assets/images/designer_silk_blouse_1792785885478.jpg',
    displayOrder: 6,
  },
  {
    id: 'cat-jewelry',
    name: 'Temple Jewelry',
    description: 'Traditional 22k gold plated bridal temple jewelry sets with kundan and pearl detailing.',
    imageUrl: '/assets/images/temple_jewelry_set_1792785897600.jpg',
    displayOrder: 7,
  },
];

export const DEFAULT_PRODUCT_ATTRIBUTES: ProductAttributeDefinition[] = [
  {
    id: 'attr-weave',
    name: 'Weave Technique',
    placeholder: 'e.g. Traditional Jacquard Korvai Handloom',
    isOptional: false,
  },
  {
    id: 'attr-border',
    name: 'Border & Pallu Detail',
    placeholder: 'e.g. Contrast Zari Mayil & Temple Borders',
    isOptional: false,
  },
  {
    id: 'attr-blouse',
    name: 'Blouse Piece',
    placeholder: 'e.g. Included (0.8m Running Silk)',
    isOptional: true,
  },
  {
    id: 'attr-length',
    name: 'Total Length',
    placeholder: 'e.g. 6.3 Meters',
    isOptional: true,
  },
  {
    id: 'attr-occasion',
    name: 'Recommended Occasion',
    placeholder: 'e.g. Bridal, Festive & Temple Occasions',
    isOptional: true,
  },
];

export const DEFAULT_CUSTOMER_LOGIN_DISPLAY: CustomerLoginDisplaySettings = {
  headerSubtitle: 'Handcrafted Silk Atelier',
  headerBadgeText: 'Protected Member Portal',
  badgeText: 'Patron Verification Required',
  headline: 'Exclusive Handloom Catalog Access',
  description:
    'To preserve the authenticity and privacy of our artisan handloom heirlooms, our masterweave catalog, limited weaves, and bespoke reservations are reserved exclusively for verified patrons registered with Google.',
  benefitCards: [
    {
      id: 'benefit-data',
      title: 'Strict Data Isolation',
      description:
        'Your orders, delivery addresses, and purchases are completely private and isolated in dedicated patron storage.',
      iconName: 'lock',
    },
    {
      id: 'benefit-wishlist',
      title: 'Private Wishlist',
      description:
        'Bookmark favorite Kanjivaram and Banarasi weaves across your personal devices.',
      iconName: 'heart',
    },
    {
      id: 'benefit-tracking',
      title: 'Order Tracking & Photos',
      description:
        'Track dispatch milestones and view high-resolution packaging photos of your sarees.',
      iconName: 'package',
    },
    {
      id: 'benefit-chat',
      title: 'Direct Concierge Chat',
      description:
        'Instant live chat directly with our Salem handloom workshop masters.',
      iconName: 'message',
    },
  ],
};

export const DEFAULT_RESELLER_LOGIN_DISPLAY: ResellerLoginDisplaySettings = {
  headerBadgeText: 'B2B Wholesale Portal',
  headerSubtitle:
    'Exclusive partner channel for boutiques, WhatsApp resellers & catalog dropshippers',
  programBadge: 'Wholesale Partner Program',
  headline: 'Empowering Resellers & Boutiques',
  description:
    'Join our enterprise network to source pure handcrafted silk sarees at direct weaver wholesale prices with guaranteed high margins and zero dead-stock risk.',
  perks: [
    {
      id: 'perk-margin',
      title: '20% Flat Wholesale Margin',
      description:
        'Instant discount applied to all Kanjivaram, Banarasi, and Chanderi sarees.',
      iconName: 'dollar',
    },
    {
      id: 'perk-dropship',
      title: 'White-Label Blind Dropshipping',
      description:
        'We dispatch directly to your end buyers with unbranded packaging and no invoices.',
      iconName: 'truck',
    },
    {
      id: 'perk-media',
      title: '1-Click High-Res Media Packs',
      description:
        'Download unwatermarked ZIP packs and single photos for WhatsApp & Instagram.',
      iconName: 'download',
    },
    {
      id: 'perk-support',
      title: 'Dedicated Dispatch & Support',
      description:
        'Express DTDC & Blue Dart courier with real-time tracking links for your customers.',
      iconName: 'shield',
    },
  ],
  adminNote:
    'Resellers cannot log in without administrator authorization. Once your access request is approved on the admin Reseller Ledger, your account is saved in the database for instant authentication.',
};

export const INITIAL_SETTINGS: StoreSettings = {
  boutiqueName: 'Neydhal',
  logoUrl: '/logo.png',
  sareeCategories: DEFAULT_SAREE_CATEGORIES,
  productAttributes: DEFAULT_PRODUCT_ATTRIBUTES,
  isFabricOptional: true,
  autoConfirmationMode: false,
  tagline: 'Pure Handloom Silk & Heirloom Sarees',
  contactPhone: '+91 98765 43210',
  contactEmail: 'nandhagoban21@gmail.com',
  instagramHandle: '@neydhal',
  youtubeHandle: '@neydhal',
  storeAddress: '12 Temple Street, Kanchipuram & Salem Silk Bazaar, Tamil Nadu',
  gstNumber: '33AAAAA0000A1Z5',
  googleMaps: {
    enabled: true,
    mapUrl: 'https://maps.google.com/?q=Salem+Silk+Sarees',
    placeName: 'Neydhal Atelier, Salem, Tamil Nadu',
  },
  currencySymbol: '₹',
  theme: 'royal_crimson',
  themeMode: 'light',
  announcement: {
    enabled: true,
    text: 'Festive Handloom Showcase — Free insured nationwide shipping on pure silk sarees above ₹20,000',
    badgeLabel: 'ATELIER SPECIAL',
  },
  payment: {
    upiId: 'nandhagoban21@okhdfcbank',
    payeeName: 'Neydhal',
    qrCodeUrl: '',
    instructions: 'Scan using any UPI app (Google Pay, PhonePe, Paytm, BHIM) and enter the 12-digit UTR/Transaction ID below to verify your order.',
  },
  delivery: {
    shippingFee: 250,
    freeDeliveryEnabled: true,
    freeDeliveryThreshold: 20000,
  },
  storefrontDisplay: {
    heroHeadline: 'Handcrafted Heritage Sarees',
    heroSubheadline: 'Authentic pure silk drapes woven by master artisans across Kanchipuram, Varanasi & Chanderi',
    showHeroBanner: true,
    heroBannerImageUrl: '/assets/images/hero_saree_atelier_1791651761357.jpg',
    showTrustBadges: true,
    showCraftsmanshipStory: true,
    storyTitle: 'The Neydhal Weaving Legacy',
    storyContent: 'Every Neydhal saree is woven with certified pure Mulberry silk and tested zari, honoring centuries-old interlocking pit-loom techniques passed down through generations of Indian master weavers.',
    showTrackOrder: true,
    allowPublicCancellation: true,
    allowPublicRefunds: true,
    showCustomerReviews: true,
    allowCustomerDeliveryDisputes: true,
    allowCustomerRefundDisputes: true,
    allowLiveChat: true,
    freeShippingText: 'Complimentary Insured Delivery on orders above ₹20,000',
  },
  customerLoginDisplay: DEFAULT_CUSTOMER_LOGIN_DISPLAY,
  resellerLoginDisplay: DEFAULT_RESELLER_LOGIN_DISPLAY,
  adminPin: '889988', // 6-digit access PIN
  adminGoogleEmail: 'nandhagoban21@gmail.com',
  customStoreDomain: '', // Custom domain or Vercel URL
  courierServices: [
    {
      id: 'courier-dtdc-salem',
      name: 'DTDC Express',
      code: 'DTDC',
      addressLine1: 'No. 14/B, Junction Main Road, Meyyanur',
      addressLine2: 'Near New Bus Stand',
      city: 'Salem',
      pincode: '636004',
      phone: '+91 427 244 8899',
      supportEmail: 'salem.dtdc@express.in',
      mapsUrl: 'https://maps.google.com/?q=DTDC+Express+Salem+New+Bus+Stand',
      trackingUrl: 'https://www.dtdc.in/tracking.asp',
      trackingUrlTemplate: 'https://www.dtdc.in/tracking/shipment-tracking.asp?strCnno=',
      isActive: true,
    },
    {
      id: 'courier-tpc-salem',
      name: 'The Professional Couriers',
      code: 'TPC',
      addressLine1: '45, Fort Main Road, Shevapet',
      addressLine2: 'Silk Bazaar Hub',
      city: 'Salem',
      pincode: '636002',
      phone: '+91 427 221 4455',
      supportEmail: 'salem@tpcglobe.com',
      mapsUrl: 'https://maps.google.com/?q=The+Professional+Couriers+Salem+Shevapet',
      trackingUrl: 'https://www.tpcglobe.com/tracking',
      trackingUrlTemplate: 'https://www.tpcglobe.com/track/',
      isActive: true,
    },
    {
      id: 'courier-bluedart-salem',
      name: 'Blue Dart Express',
      code: 'BLUEDART',
      addressLine1: '2nd Floor, Saradha College Road, Alagapuram',
      city: 'Salem',
      pincode: '636016',
      phone: '+91 427 233 1122',
      supportEmail: 'bluedart.salem@bluedart.com',
      mapsUrl: 'https://maps.google.com/?q=Blue+Dart+Salem+Saradha+College+Road',
      trackingUrl: 'https://www.bluedart.com/tracking',
      trackingUrlTemplate: 'https://www.bluedart.com/tracking',
      isActive: true,
    },
    {
      id: 'courier-speedpost-salem',
      name: 'India Post (Speed Post)',
      code: 'SPEEDPOST',
      addressLine1: 'Salem Head Post Office, Cherry Road, Hasthampatti',
      city: 'Salem',
      pincode: '636001',
      phone: '+91 427 241 5500',
      supportEmail: 'salemhpo@indiapost.gov.in',
      mapsUrl: 'https://maps.google.com/?q=Head+Post+Office+Salem+Cherry+Road',
      trackingUrl: 'https://www.indiapost.gov.in/_layouts/15/dpt.ptc.track/track.aspx',
      trackingUrlTemplate: 'https://www.indiapost.gov.in/_layouts/15/dpt.ptc.track/track.aspx',
      isActive: true,
    },
  ],
  staffMembers: [],
  chatTemplates: DEFAULT_CHAT_TEMPLATES,
  defaultStaffPermissions: DEFAULT_STAFF_PERMISSIONS,
  staffIdleAlert: {
    enabled: true,
    idleThresholdMinutes: 15,
  },
  enableOrderDeletion: false,
};

// Initial state for fresh boutique launch: 6 handcrafted heirloom sarees loaded
export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'saree-kanjivaram-crimson-01',
    productCode: 'KAN-CRIM-101',
    title: 'Maharani Shrimant Kanjivaram Silk Saree',
    subtitle: 'Pure Mulberry Silk with 3G Pure Gold Zari Temple Pallu',
    description: 'Woven over 28 artisan days in Kanchipuram, this heirloom bridal crimson Kanjivaram features majestic elephant and peacock motifs along the double-korvai borders. Handcrafted with authentic mulberry silk and tested 24-karat gold dipped zari.',
    fabric: 'Kanjivaram Silk',
    color: 'Crimson Red',
    price: 34500,
    originalPrice: 42000,
    stockStatus: 'in_stock',
    stockCount: 3,
    isVisible: true,
    images: [
      '/assets/images/saree_kanjivaram_crimson_1791651781402.jpg',
      '/assets/images/hero_saree_atelier_1791651761357.jpg',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=0hW73jL76bY',
    weaveDetails: 'Double-Korvai Interlocking Handloom with 3-ply mulberry warp',
    borderType: 'Contrast 9-inch Temple Gopuram Border in pure gold zari',
    blousePieceIncluded: true,
    lengthMeters: 6.3,
    occasion: 'Bridal & Grand Wedding Muhurtham',
    isFeatured: true,
    createdAt: '2026-03-01T10:00:00Z',
    category: 'Kanjivaram Silk',
    initialSku: 'KAN-CRIM-101',
    skuEditCount: 0,
    isSkuLocked: false,
    crossSellProductIds: ['prod-blouse-zardozi-01', 'prod-jewelry-choker-02'],
    crossSellCategoryNames: ['Designer Blouses', 'Temple Jewelry'],
  },
  {
    id: 'saree-banarasi-emerald-02',
    productCode: 'BAN-EMER-202',
    title: 'Varanasi Royal Kadwa Emerald Brocade',
    subtitle: 'Fine Katan Silk with Meenakari Floral Jaal',
    description: 'An extraordinary Banarasi drape crafted on authentic wooden pit looms along the banks of Varanasi. Features intricate antique gold zari hunting motifs, interlocking lotus floral vine (jaal), and contrasting gulab butas.',
    fabric: 'Banarasi Brocade',
    color: 'Emerald Green',
    price: 28900,
    originalPrice: 35000,
    stockStatus: 'in_stock',
    stockCount: 4,
    isVisible: true,
    images: [
      '/assets/images/saree_banarasi_emerald_1791651794836.jpg',
      '/assets/images/hero_saree_atelier_1791651761357.jpg',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=0hW73jL76bY',
    weaveDetails: 'Kadwa Hand-Woven with individual meena threads on Katan silk',
    borderType: 'Intricate Shikargah Border with scalloped edges',
    blousePieceIncluded: true,
    lengthMeters: 6.25,
    occasion: 'Royal Reception & Festive Gala',
    isFeatured: true,
    createdAt: '2026-03-02T11:00:00Z',
    category: 'Banarasi Brocade',
    initialSku: 'BAN-EMER-202',
    skuEditCount: 0,
    isSkuLocked: false,
    crossSellProductIds: ['prod-blouse-zardozi-01', 'prod-jewelry-choker-02'],
    crossSellCategoryNames: ['Designer Blouses', 'Temple Jewelry'],
  },
  {
    id: 'saree-chanderi-lavender-03',
    productCode: 'CHA-LAV-303',
    title: 'Lilac Gossamer Chanderi Tissue Silk',
    subtitle: 'Feather-Light Mulberry with Roopa Kalabattu Silver Zari',
    description: 'Subtle, gossamer sheen that glistens softly under evening light. Handspun in Madhya Pradesh using heritage gossamer tissue techniques with miniature silver ashrafi buttis and an ethereal sheer pallu.',
    fabric: 'Chanderi Tissue',
    color: 'Lavender',
    price: 18500,
    originalPrice: 22000,
    stockStatus: 'in_stock',
    stockCount: 5,
    isVisible: true,
    images: [
      '/assets/images/saree_chanderi_lavender_1791651806313.jpg',
      '/assets/images/hero_saree_atelier_1791651761357.jpg',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=0hW73jL76bY',
    weaveDetails: 'Traditional pit-loom extra weft hand-interlace with silver zari',
    borderType: 'Delicate 3-inch Zari Pasa Border',
    blousePieceIncluded: true,
    lengthMeters: 6.4,
    occasion: 'Cocktails, Sangeet & Summer Soiree',
    isFeatured: true,
    createdAt: '2026-03-03T12:00:00Z',
    category: 'Chanderi Tissue',
    initialSku: 'CHA-LAV-303',
    skuEditCount: 0,
    isSkuLocked: false,
  },
  {
    id: 'saree-organza-ivory-04',
    productCode: 'ORG-IVOR-404',
    title: 'Noor Hand-Painted Ivory Organza Silk',
    subtitle: 'Translucent Silk Organza with Gold Gota Patti Work',
    description: 'Elegance personified in sheer ivory silk organza, embellished with hand-cut gota patti appliqué and delicate zardozi detailing along the fluid perimeter. Ideal for contemporary cocktail celebrations.',
    fabric: 'Organza Silk',
    color: 'Ivory Cream',
    price: 16200,
    originalPrice: 19500,
    stockStatus: 'limited',
    stockCount: 2,
    isVisible: true,
    images: [
      '/assets/images/saree_chanderi_lavender_1791651806313.jpg',
      '/assets/images/hero_saree_atelier_1791651761357.jpg',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=0hW73jL76bY',
    weaveDetails: 'Crisp hand-twisted organza yarns with artisan hand needle embroidery',
    borderType: 'Hand-scalloped floral gota patti lace border',
    blousePieceIncluded: true,
    lengthMeters: 6.3,
    occasion: 'Daytime Mehendi & Intimate Dinners',
    isFeatured: false,
    createdAt: '2026-03-04T13:00:00Z',
    category: 'Organza Silk',
    initialSku: 'ORG-IVOR-404',
    skuEditCount: 0,
    isSkuLocked: false,
  },
  {
    id: 'saree-georgette-royal-05',
    productCode: 'GEO-ROY-505',
    title: 'Surya Mukhi Pure Banarasi Khaddi Georgette',
    subtitle: 'Flowing Crinkled Silk with Antique Matte Gold Jaal',
    description: 'Fluid, body-hugging pure khaddi georgette saree steeped in royal indigo blue with all-over antique gold leaf bootas and a sweeping zari pallu that drapes like liquid silk.',
    fabric: 'Pure Georgette',
    color: 'Royal Blue',
    price: 24500,
    originalPrice: 29000,
    stockStatus: 'in_stock',
    stockCount: 6,
    isVisible: true,
    images: [
      '/assets/images/saree_banarasi_emerald_1791651794836.jpg',
      '/assets/images/hero_saree_atelier_1791651761357.jpg',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=0hW73jL76bY',
    weaveDetails: 'Khaddi Georgette high-twist silk warp with antique tilla motifs',
    borderType: 'Broad paisley border with gold fringe hem',
    blousePieceIncluded: true,
    lengthMeters: 6.5,
    occasion: 'Sangeet, Night Receptions & Grand Festive',
    isFeatured: true,
    createdAt: '2026-03-05T14:00:00Z',
    category: 'Pure Georgette',
    initialSku: 'GEO-ROY-505',
    skuEditCount: 0,
    isSkuLocked: false,
  },
  {
    id: 'saree-kanjivaram-pink-06',
    productCode: 'KAN-PINK-606',
    title: 'Kalyani Dual-Tone Rani Pink Kanjivaram',
    subtitle: 'Korvai Weave with Vanki Motif & Contrast Emerald Border',
    description: 'Vibrant and festive dual-tone shot pink silk with iridescent reflections. The body sparkles with intricate rudraksha beads woven in gold thread, framed by an eye-catching contrast emerald green pallu.',
    fabric: 'Kanjivaram Silk',
    color: 'Rani Pink',
    price: 31000,
    originalPrice: 38000,
    stockStatus: 'in_stock',
    stockCount: 8,
    isVisible: true,
    images: [
      '/assets/images/saree_kanjivaram_crimson_1791651781402.jpg',
      '/assets/images/hero_saree_atelier_1791651761357.jpg',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=0hW73jL76bY',
    weaveDetails: 'Traditional 3-shuttle Korvai interlace with pure silver-gilt zari',
    borderType: 'Contrast Emerald Green Ganga-Jamuna Temple Border',
    blousePieceIncluded: true,
    lengthMeters: 6.3,
    occasion: 'Weddings & Auspicious Rituals',
    isFeatured: false,
    createdAt: '2026-03-06T15:00:00Z',
    category: 'Kanjivaram Silk',
    initialSku: 'KAN-PINK-606',
    skuEditCount: 0,
    isSkuLocked: false,
  },
  {
    id: 'prod-blouse-zardozi-01',
    productCode: 'BLS-CRIM-101',
    title: 'Mayil Maggam Embroidered Bridal Blouse',
    subtitle: 'Pure Crimson Raw Silk with Antique Gold Zardozi & Pearl Motifs',
    description: 'Bespoke hand-embroidered raw silk blouse tailored to elevate traditional bridal and festive Kanjivaram & Banarasi sarees. Embellished with artisanal peacock maggam needlework, dabka threads, and freshwater pearls.',
    fabric: 'Pure Georgette',
    color: 'Crimson Red',
    price: 4800,
    originalPrice: 6500,
    stockStatus: 'in_stock',
    stockCount: 6,
    isVisible: true,
    images: [
      '/assets/images/designer_silk_blouse_1792785885478.jpg',
    ],
    borderType: 'Intricate scalloped elbow-sleeve zardozi border',
    occasion: 'Bridal Muhurtham & Reception Ensemble',
    isFeatured: true,
    createdAt: '2026-03-07T10:00:00Z',
    category: 'Designer Blouses',
    initialSku: 'BLS-CRIM-101',
    skuEditCount: 0,
    isSkuLocked: false,
    crossSellProductIds: ['saree-kanjivaram-crimson-01', 'prod-jewelry-choker-02'],
    crossSellCategoryNames: ['Kanjivaram Silk', 'Temple Jewelry'],
  },
  {
    id: 'prod-jewelry-choker-02',
    productCode: 'JWL-KEMP-202',
    title: 'Heritage Lakshmi Kempu Choker & Jhumka Set',
    subtitle: 'Antique 22k Gold Micron Plating with Royal Ruby Kundan Stones',
    description: 'Mastercrafted temple jewelry choker necklace featuring Goddess Lakshmi center motif flanked by royal peacocks, encircled by ruby kundan cabochons and clustered pearls. Comes with matching handcrafted chandelier jhumkas.',
    fabric: 'Other',
    color: 'Mustard Gold',
    price: 6900,
    originalPrice: 9200,
    stockStatus: 'in_stock',
    stockCount: 5,
    isVisible: true,
    images: [
      '/assets/images/temple_jewelry_set_1792785897600.jpg',
    ],
    borderType: 'Adjustable braided zari dori tassel',
    occasion: 'Temple Weddings, Bharatanatyam & Grand Receptions',
    isFeatured: true,
    createdAt: '2026-03-07T11:00:00Z',
    category: 'Temple Jewelry',
    initialSku: 'JWL-KEMP-202',
    skuEditCount: 0,
    isSkuLocked: false,
    crossSellProductIds: ['saree-kanjivaram-crimson-01', 'prod-blouse-zardozi-01'],
    crossSellCategoryNames: ['Kanjivaram Silk', 'Designer Blouses'],
  },
  {
    id: 'prod-blouse-emerald-03',
    productCode: 'BLS-EMER-303',
    title: 'Emerald Brocade Princess Cut Blouse',
    subtitle: 'Woven Banarasi Silk with Heavy Zari Border',
    description: 'Padded designer princess cut blouse woven with Banarasi antique gold zari flora, styled with deep back dori and latkan pearls.',
    fabric: 'Banarasi Brocade',
    color: 'Emerald Green',
    price: 3950,
    originalPrice: 5200,
    stockStatus: 'in_stock',
    stockCount: 4,
    isVisible: true,
    images: ['/assets/images/designer_silk_blouse_1792785885478.jpg'],
    borderType: 'Golden zari border on sleeve cuffs',
    occasion: 'Weddings & Festive Parties',
    isFeatured: false,
    createdAt: '2026-03-07T12:00:00Z',
    category: 'Designer Blouses',
    initialSku: 'BLS-EMER-303',
    skuEditCount: 0,
    isSkuLocked: false,
    crossSellProductIds: ['saree-banarasi-emerald-02', 'prod-jewelry-choker-02'],
    crossSellCategoryNames: ['Banarasi Brocade', 'Temple Jewelry'],
  },
  {
    id: 'prod-jewelry-jhumka-04',
    productCode: 'JWL-JHM-404',
    title: 'Royal Temple Peacock Jhumka Earrings',
    subtitle: 'Traditional 22k Matte Gold Finish with Kemp Cabochons',
    description: 'Sculpted South Indian antique temple jhumkas adorned with dual dancing peacocks, ruby stone clusters, and dangling mini rice pearls.',
    fabric: 'Other',
    color: 'Antique Gold',
    price: 3200,
    originalPrice: 4500,
    stockStatus: 'in_stock',
    stockCount: 7,
    isVisible: true,
    images: ['/assets/images/temple_jewelry_set_1792785897600.jpg'],
    borderType: 'Handmade filigree bell hanging',
    occasion: 'Bridal Muhurtham & Festive Wear',
    isFeatured: true,
    createdAt: '2026-03-07T13:00:00Z',
    category: 'Temple Jewelry',
    initialSku: 'JWL-JHM-404',
    skuEditCount: 0,
    isSkuLocked: false,
    crossSellProductIds: ['saree-kanjivaram-crimson-01', 'prod-blouse-zardozi-01'],
    crossSellCategoryNames: ['Kanjivaram Silk', 'Designer Blouses'],
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'res-order-9967',
    orderNumber: 'RES-9967',
    createdAt: '2026-10-25T10:55:00.000Z',
    customer: {
      name: 'Priya Sundaram',
      phone: '9952252961',
      email: 'priya.sundaram@example.com',
      address: 'Plot 42, 3rd Cross Street, Gandhinagar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600020',
    },
    dropshipRecipient: {
      name: 'Priya Sundaram',
      phone: '9952252961',
      address: 'Plot 42, 3rd Cross Street, Gandhinagar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600020',
    },
    items: [
      {
        product: INITIAL_PRODUCTS[0],
        quantity: 3,
      },
    ],
    subtotal: 22950,
    shippingFee: 0,
    totalAmount: 22950,
    resellerMargin: 2550,
    orderType: 'reseller',
    resellerId: 'res_meenakshi_demo',
    resellerBusinessName: 'Sri Meenakshi Silks & Sarees',
    resellerName: 'Meenakshi Sundaram',
    upiTransactionId: 'UPI983471029384',
    refundDetails: {
      refundStatus: 'not_required',
    },
    shippingDetails: {
      courierName: 'The Professional Couriers',
      trackingNumber: '1234567',
      shippedAt: '2026-10-25T14:30:00.000Z',
      notes: 'Shipped via Salem Professional Hub. In transit to Chennai sorting hub.',
    },
    status: 'Shipped',
    statusHistory: [
      {
        status: 'Pending',
        timestamp: '2026-10-25T10:55:00.000Z',
        note: 'Wholesale dropship submitted by reseller partner',
      },
      {
        status: 'Confirmed',
        timestamp: '2026-10-25T11:40:00.000Z',
        note: 'Payment verified and sent to boutique inspection & packing',
      },
      {
        status: 'Shipped',
        timestamp: '2026-10-25T14:30:00.000Z',
        note: 'Consignment handed over to The Professional Couriers (AWB: 1234567)',
      },
    ],
    checkoutMethod: 'submit_order',
    assignedStaffName: 'Kavitha M (Atelier Concierge)',
    assignedStaffId: 'staff-kavitha',
  },
];

export const INITIAL_REVIEWS = [
  {
    id: 'rev-01',
    productId: 'saree-kanjivaram-crimson-01',
    customerName: 'Ananya Deshmukh',
    city: 'Bengaluru',
    rating: 5,
    title: 'Heirloom quality bridal silk',
    comment: 'The Korvai weave is simply magnificent. The gold zari has the unmistakable warm weight of pure handloom craftsmanship. Draped like an absolute dream for my wedding reception.',
    verifiedBuyer: true,
    createdAt: '2026-03-08T10:30:00Z',
  },
  {
    id: 'rev-02',
    productId: 'saree-kanjivaram-crimson-01',
    customerName: 'Meenakshi Iyer',
    city: 'Chennai',
    rating: 5,
    title: 'Authentic Kanchipuram silk certified',
    comment: 'Pure mulberry silk with real temple borders. Arrived within 3 days in exquisite satin boutique packaging. Concierge on WhatsApp answered every question promptly.',
    verifiedBuyer: true,
    createdAt: '2026-03-09T14:15:00Z',
  },
  {
    id: 'rev-03',
    productId: 'saree-banarasi-emerald-02',
    customerName: 'Pooja Singhania',
    city: 'Kolkata',
    rating: 5,
    title: 'Mesmerizing Kadwa craftsmanship',
    comment: 'The antique meenakari motifs are raised and tactile. You can feel every single flower hand-woven by the master artisan. Truly a museum piece drape.',
    verifiedBuyer: true,
    createdAt: '2026-03-10T16:45:00Z',
  },
  {
    id: 'rev-04',
    productId: 'saree-chanderi-lavender-03',
    customerName: 'Rhea Sen',
    city: 'Mumbai',
    rating: 5,
    title: 'Feather-light and ethereal drape',
    comment: 'Such a subtle and regal lavender hue with luminous tissue gold reflection. Extremely comfortable to wear through 6 hours of daytime sangeet ceremonies.',
    verifiedBuyer: true,
    createdAt: '2026-03-11T11:20:00Z',
  },
];
