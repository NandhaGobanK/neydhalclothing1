export interface PolicySection {
  id: string;
  title: string;
  shortDescription: string;
  lastUpdated: string;
  badge?: string;
  highlightNote?: string;
  clauses: {
    heading: string;
    content: string;
    bullets?: string[];
  }[];
}

export const STORE_CONTACT_DETAILS = {
  businessName: 'Neydhal Clothing',
  natureOfBusiness: 'Online Retail Boutique for Women\'s Sarees, Kurtis, Blouses & Imitation Jewellery',
  email: 'neydhalclothing247@gmail.com',
  phone: '8807392520',
  formattedPhone: '+91 88073 92520',
  whatsappNumber: '8807392520',
  whatsappUrl: 'https://wa.me/918807392520',
  website: 'https://neydhalclothing.in',
  operatingHours: 'Monday – Saturday: 9:30 AM to 8:30 PM IST',
};

export const LEGAL_POLICIES: Record<string, PolicySection> = {
  terms: {
    id: 'terms',
    title: 'Terms of Service',
    shortDescription: 'Operating guidelines, product purchases, and online catalog terms for Neydhal Clothing.',
    lastUpdated: 'October 2026',
    badge: 'Standard E-Commerce Terms',
    highlightNote: 'Neydhal Clothing is an online retail boutique offering women\'s sarees, designer kurtis, ready-to-wear blouses, and imitation jewellery.',
    clauses: [
      {
        heading: '1. Store Identity & Scope of Catalog',
        content:
          'Neydhal Clothing operates as an online retail store specializing in women\'s ethnic fashion, including sarees, kurtis, readymade and designer blouses, and handcrafted imitation jewelry. By accessing our website, creating an account, or placing an order, you agree to comply with these terms.',
      },
      {
        heading: '2. Product Representation & Color Calibration',
        content:
          'We make every reasonable effort to display product colors, fabrics, and jewelry finishes as accurately as possible. However, due to variations in mobile screens, monitors, and photography lighting, the actual product shade or brightness may vary slightly (within 5%) from the photograph.',
        bullets: [
          'All measurements, lengths, and jewelry specifications are provided to standard commercial tolerances.',
          'Imitation jewelry pieces are fashioned from alloy and synthetic stones; handle with care and keep away from water and perfume.',
        ],
      },
      {
        heading: '3. Pricing, Orders & Digital Payments',
        content:
          'All prices are listed in Indian Rupees (₹). Orders are confirmed upon receipt of authorized payment processed securely via our direct Merchant UPI (supporting Google Pay, PhonePe, BHIM, and banking UPI apps).',
        bullets: [
          'Prices are subject to revision without prior notice prior to order confirmation.',
          'Neydhal Clothing reserves the right to decline or cancel any order in case of stock unavailability, in which case full payment will be refunded immediately.',
        ],
      },
      {
        heading: '4. Order Cancellation Before Shipping',
        content:
          'Customers are entitled to cancel any order free of charge at any time prior to shipment. Once an order has been handed over to our partner couriers and a tracking identifier is assigned, cancellation is no longer possible.',
      },
      {
        heading: '5. Governing Law & Dispute Redressal',
        content:
          'These Terms are governed by and construed in accordance with the laws of India. Any disputes arising in connection with orders or services shall be subject to the exclusive jurisdiction of the competent courts in Salem / Tamil Nadu.',
      },
    ],
  },

  refund: {
    id: 'refund',
    title: 'Refund & Return Policy',
    shortDescription: 'Strict no-returns policy on received products with staff concierge assistance for transit damage.',
    lastUpdated: 'October 2026',
    badge: 'No Returns Once Received',
    highlightNote:
      'Clear Declaration: We enforce a strict No Returns and No Refunds policy on all products once the customer has received the parcel. In rare cases of transit defect or damage, customers must contact store staff directly on WhatsApp with an unboxing video.',
    clauses: [
      {
        heading: '1. Strict No Returns Policy Once Delivered',
        content:
          'To ensure hygiene, product integrity, and competitive pricing for all patrons, Neydhal Clothing follows a strict NO RETURNS and NO REFUNDS policy on all products (including sarees, kurtis, blouses, and imitation jewelry) once the order has been delivered and received by the customer. We do not accept returns or exchanges for change of mind or personal preference.',
      },
      {
        heading: '2. Order Cancellation Policy (Before Shipping)',
        content:
          'Any order can be cancelled freely before it is shipped. To cancel an order before shipping, patrons can use the self-service cancellation button in the tracking portal or contact our store staff immediately. If the order is cancelled before courier handover, 100% of the paid amount will be refunded back to the original payment source within 3–5 working days.',
      },
      {
        heading: '3. Damaged or Defective Items Received (Store Staff Contact Required)',
        content:
          'If a product arrives damaged in courier transit or an incorrect item was delivered by mistake, patrons must contact our store staff within 24–48 hours of delivery.',
        bullets: [
          'Mandatory Evidence: An uncut, continuous WhatsApp video of opening the courier package (from initial sealed state to inspection) is required for courier claims.',
          'Send the unboxing video and order number directly to our WhatsApp support at 8807392520 or email us at neydhalclothing247@gmail.com.',
          'Our store staff will promptly review the video evidence and assist you with an appropriate replacement or case-by-case resolution.',
        ],
      },
      {
        heading: '4. Refund Processing Timeline',
        content:
          'For eligible pre-shipping cancellations or staff-authorized damage claims, refunds are credited back to the original bank account or UPI ID used during checkout. Standard bank crediting takes 5 to 7 business days depending on your issuing bank.',
      },
    ],
  },

  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    shortDescription: 'How your patron account information, delivery address, and digital payments are protected.',
    lastUpdated: 'October 2026',
    badge: '100% Data Protection',
    highlightNote:
      'We treat your personal and order data with strict confidentiality. Payment card and UPI details are never stored on our servers and are processed securely through direct verified UPI settlement channels.',
    clauses: [
      {
        heading: '1. Information We Collect',
        content:
          'When you place an order or register as a patron, we collect your name, phone number, email address, and delivery shipping addresses solely for order confirmation, invoice generation, courier delivery, and customer care.',
      },
      {
        heading: '2. Payment Security & Zero Card Storage',
        content:
          'Neydhal Clothing does not capture, store, or process any card numbers, CVVs, net banking credentials, or UPI PINs. All payment transactions are executed via 256-bit encrypted direct UPI protocols.',
      },
      {
        heading: '3. Data Privacy & No Third-Party Resale',
        content:
          'Your mobile number, email, and address are strictly used for your purchases. We never sell, rent, or trade customer contact information to third-party telemarketers or advertising networks.',
      },
      {
        heading: '4. Contact for Privacy Inquiries',
        content:
          'For any questions regarding your saved data, profile deletion, or privacy queries, contact our support team at neydhalclothing247@gmail.com or call 8807392520.',
      },
    ],
  },
};
