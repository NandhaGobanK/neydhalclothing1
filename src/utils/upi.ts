import { Order, StoreSettings, Product } from '../types/store';

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Returns the effective public store URL based on:
 * 1. Admin configured custom domain in Store Settings (e.g. https://myboutique.vercel.app)
 * 2. Vercel / environment variable VITE_PUBLIC_STORE_URL
 * 3. Browser origin (window.location.origin)
 */
export function getPublicStoreUrl(settings?: StoreSettings): string {
  if (settings?.customStoreDomain && settings.customStoreDomain.trim()) {
    let domain = settings.customStoreDomain.trim();
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = `https://${domain}`;
    }
    return domain.replace(/\/+$/, '');
  }

  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PUBLIC_STORE_URL) {
    let envDomain = String(import.meta.env.VITE_PUBLIC_STORE_URL).trim();
    if (envDomain) {
      if (!envDomain.startsWith('http://') && !envDomain.startsWith('https://')) {
        envDomain = `https://${envDomain}`;
      }
      return envDomain.replace(/\/+$/, '');
    }
  }

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }

  return '';
}

/**
 * Generates reliable public track order URL that works in all browsers & WhatsApp
 */
export function getTrackingLink(order: Order, settings?: StoreSettings, baseUrl?: string): string {
  const base = baseUrl || getPublicStoreUrl(settings);
  return `${base}/?order=${encodeURIComponent(order.orderNumber)}&phone=${encodeURIComponent(order.customer.phone)}#track`;
}

/**
 * Generates direct product link for public sharing
 */
export function getProductShareUrl(product: Product, settings?: StoreSettings, baseUrl?: string): string {
  const base = baseUrl || getPublicStoreUrl(settings);
  const identifier = product.productCode || product.id;
  return `${base}/?product=${encodeURIComponent(identifier)}`;
}

/**
 * Calculates discount offer details (amount saved & percentage tag)
 */
export function calculateDiscount(price: number, originalPrice?: number): {
  hasDiscount: boolean;
  mrp: number;
  sellingPrice: number;
  discountAmount: number;
  discountPercentage: number;
} {
  const mrp = originalPrice && originalPrice > price ? originalPrice : 0;
  const hasDiscount = mrp > price;
  const discountAmount = hasDiscount ? mrp - price : 0;
  const discountPercentage = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;

  return {
    hasDiscount,
    mrp,
    sellingPrice: price,
    discountAmount,
    discountPercentage,
  };
}

export function generateUpiUri(
  upiId: string,
  payeeName: string,
  amount: number,
  orderNumber?: string,
  note?: string
): string {
  const cleanUpi = encodeURIComponent(upiId.trim());
  const cleanName = encodeURIComponent(payeeName.trim());
  const am = amount.toFixed(2);
  const tn = encodeURIComponent(note || `Saree Order ${orderNumber || ''}`);
  return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${am}&cu=INR&tn=${tn}`;
}

/**
 * Builds standard QR image URL using reliable high-performance QR service
 */
export function getUpiQrCodeImageUrl(upiId: string, payeeName: string, amount: number, orderNumber?: string): string {
  const upiUri = generateUpiUri(upiId, payeeName, amount, orderNumber);
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(upiUri)}&margin=12`;
}

/**
 * Helper to download QR code image to user's device
 */
export async function downloadQrCode(imageUrl: string, filename = 'boutique-upi-qr.png') {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.target = '_blank';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * Generates structured WhatsApp message for initial customer order submission
 */
export function formatWhatsAppOrderMessage(order: Order, settings: StoreSettings): string {
  const itemsText = order.items
    .map(
      (item, index) =>
        `${index + 1}. *${item.product.title}* [SKU: ${item.product.productCode}] (${item.product.fabric} - ${item.product.color}) - Qty: ${item.quantity} × ${formatPrice(item.product.price)}`
    )
    .join('\n');

  const refundInfo = order.refundDetails?.refundUpiId
    ? `\n🔁 *CUSTOMER REFUND UPI DETAILS:*\nUPI ID: *${order.refundDetails.refundUpiId}*\nUPI Mobile: *${order.refundDetails.refundUpiPhone || order.customer.phone}*`
    : '';

  const customerComments = order.notes?.trim()
    ? `\n💬 *Customer Comments / Instructions:*\n"${order.notes.trim()}"\n`
    : '';

  const shippingText = order.shippingFee === 0
    ? 'Delivery Charges: *Free*'
    : `Delivery Charges: *${formatPrice(order.shippingFee)}*`;

  const message = `🛍️ *NEW HANDLOOM ORDER*
Boutique: *${settings.boutiqueName}*
Order Reference: *#${order.orderNumber}*
Date: ${new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}

*ORDER ITEMS:*
${itemsText}

Subtotal: *${formatPrice(order.subtotal)}*
${shippingText}
💰 *TOTAL PAYABLE AMOUNT:* ${formatPrice(order.totalAmount)}
💳 *PAYMENT TRANSACTION ID (UTR):* ${order.upiTransactionId}
Store UPI: ${settings.payment.upiId}

📦 *SHIPPING ADDRESS:*
Name: *${order.customer.name}*
Phone: *${order.customer.phone}*
Email: ${order.customer.email}
Address: ${order.customer.address}, ${order.customer.city}, ${order.customer.state} - ${order.customer.pincode}
${customerComments}${refundInfo}

_Kindly verify the payment transaction and dispatch my order._`;

  return message;
}

export interface DynamicVariableItem {
  token: string;
  label: string;
  value: string;
  category: 'essential' | 'customer' | 'shipping' | 'refund' | 'store';
}

export function getOrderDynamicVariables(
  order: Order,
  settings: StoreSettings,
  storeUrl?: string
): DynamicVariableItem[] {
  const effectiveBaseUrl = storeUrl || getPublicStoreUrl(settings);
  const itemsSummary = order.items
    .map((item) => `${item.product.title} [${item.product.productCode}] (Qty: ${item.quantity})`)
    .join(', ');
  const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const trackingLink = getTrackingLink(order, settings, effectiveBaseUrl);
  const courier = order.shippingDetails?.courierName || 'DTDC Express';
  const trackingId = order.shippingDetails?.trackingNumber || 'Pending';
  const deliveryAddress = `${order.customer.address}, ${order.customer.city}, ${order.customer.state} - ${order.customer.pincode}`;
  const staffName = order.assignedStaffName || (order.lastUpdatedBy && order.lastUpdatedBy !== 'system' ? `@${order.lastUpdatedBy}` : 'Concierge Desk');
  const staffSignature = order.assignedStaffName
    ? `\n👤 *Attending Concierge:* ${order.assignedStaffName}${order.lastUpdatedBy ? ` (@${order.lastUpdatedBy})` : ''}`
    : order.lastUpdatedBy && order.lastUpdatedBy !== 'system'
    ? `\n👤 *Handled by Staff:* @${order.lastUpdatedBy}`
    : '';
  const reason = order.cancellationReason || '';
  const reasonNotice = reason ? `\n• *Reason for ${order.status}:* ${reason}` : '';
  const refundStatusNotice =
    order.refundDetails?.refundStatus === 'processed'
      ? 'Your refund has been processed:'
      : 'Your refund is initiated:';
  const refundUtr = order.refundDetails?.refundUtr || '';
  const refundUtrText = refundUtr ? `\n• *Refund Transaction UTR ID:* *${refundUtr}*` : '';
  const refundUpi = order.refundDetails?.refundUpiId || order.customer.phone;
  const refundUpiText = order.refundDetails?.refundUpiId
    ? `\n• Refunded to UPI: *${order.refundDetails.refundUpiId}*`
    : '';
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const orderTime = new Date(order.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return [
    // Essential order variables
    { token: '{orderNumber}', label: 'Order Number', value: order.orderNumber, category: 'essential' },
    { token: '{totalAmount}', label: 'Total Amount', value: formatPrice(order.totalAmount), category: 'essential' },
    { token: '{subtotal}', label: 'Subtotal', value: formatPrice(order.subtotal), category: 'essential' },
    { token: '{shippingFee}', label: 'Delivery Fee', value: order.shippingFee === 0 ? 'Free' : formatPrice(order.shippingFee), category: 'essential' },
    { token: '{upiTransactionId}', label: 'Payment UTR (Transaction ID)', value: order.upiTransactionId, category: 'essential' },
    { token: '{trackingLink}', label: 'Live Tracking Link', value: trackingLink, category: 'essential' },
    { token: '{orderStatus}', label: 'Order Status', value: order.status, category: 'essential' },
    { token: '{orderDate}', label: 'Order Date', value: orderDate, category: 'essential' },
    { token: '{orderTime}', label: 'Order Time', value: orderTime, category: 'essential' },
    { token: '{itemsSummary}', label: 'Items & SKU List', value: itemsSummary, category: 'essential' },
    { token: '{itemsCount}', label: 'Total Saree Pieces', value: `${itemsCount}`, category: 'essential' },

    // Customer variables
    { token: '{customerName}', label: 'Customer Name', value: order.customer.name, category: 'customer' },
    { token: '{customerPhone}', label: 'Customer Phone', value: order.customer.phone, category: 'customer' },
    { token: '{customerEmail}', label: 'Customer Email', value: order.customer.email, category: 'customer' },
    { token: '{deliveryAddress}', label: 'Full Delivery Address', value: deliveryAddress, category: 'customer' },
    { token: '{city}', label: 'City', value: order.customer.city, category: 'customer' },
    { token: '{state}', label: 'State', value: order.customer.state, category: 'customer' },
    { token: '{pincode}', label: 'Pincode', value: order.customer.pincode, category: 'customer' },
    { token: '{customerNotes}', label: 'Customer Comments / Notes', value: order.notes?.trim() || 'None', category: 'customer' },

    // Shipping variables
    { token: '{courierName}', label: 'Courier Partner', value: courier, category: 'shipping' },
    { token: '{trackingNumber}', label: 'Tracking / AWB Number', value: trackingId, category: 'shipping' },
    { token: '{shippingNotes}', label: 'Courier Notes', value: order.shippingDetails?.notes || '', category: 'shipping' },

    // Refund / Cancellation variables
    { token: '{reason}', label: 'Cancellation / Rejection Reason', value: reason, category: 'refund' },
    { token: '{reasonNotice}', label: 'Reason Notice Block', value: reasonNotice, category: 'refund' },
    { token: '{refundStatus}', label: 'Refund Status', value: order.refundDetails?.refundStatus || 'N/A', category: 'refund' },
    { token: '{refundStatusNotice}', label: 'Refund Status Notice', value: refundStatusNotice, category: 'refund' },
    { token: '{refundUtr}', label: 'Refund UTR ID', value: refundUtr, category: 'refund' },
    { token: '{refundUtrText}', label: 'Refund UTR Text Block', value: refundUtrText, category: 'refund' },
    { token: '{refundUpi}', label: 'Customer Refund UPI ID', value: refundUpi, category: 'refund' },
    { token: '{refundUpiText}', label: 'Refund UPI Text Block', value: refundUpiText, category: 'refund' },
    { token: '{refundPhone}', label: 'Refund Phone', value: order.refundDetails?.refundUpiPhone || order.customer.phone, category: 'refund' },

    // Store & Staff variables
    { token: '{boutiqueName}', label: 'Boutique Name', value: settings.boutiqueName, category: 'store' },
    { token: '{boutiquePhone}', label: 'Boutique Phone', value: settings.contactPhone, category: 'store' },
    { token: '{boutiqueEmail}', label: 'Boutique Email', value: settings.contactEmail, category: 'store' },
    { token: '{instagramHandle}', label: 'Instagram Handle', value: settings.instagramHandle, category: 'store' },
    { token: '{staffName}', label: 'Assigned Staff Name', value: staffName, category: 'store' },
    { token: '{staffSignature}', label: 'Staff Signature Block', value: staffSignature, category: 'store' },
  ];
}

export function applyTemplateTokens(
  template: string,
  order: Order,
  settings: StoreSettings,
  storeUrl?: string
): string {
  const effectiveBaseUrl = storeUrl || getPublicStoreUrl(settings);
  const dynamicVars = getOrderDynamicVariables(order, settings, effectiveBaseUrl);

  let result = template;
  for (const item of dynamicVars) {
    // Replace all occurrences of {token}
    const escapedToken = item.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escapedToken, 'g'), item.value);
  }

  // Also support legacy or alias tokens
  result = result
    .replace(/\{customerComments\}/g, order.notes?.trim() || 'None')
    .replace(/\{cancellationReason\}/g, order.cancellationReason || '');

  return result;
}

/**
 * Generates stage-specific WhatsApp notification messages for customers
 */
export function formatWhatsAppStageUpdateMessage(
  order: Order,
  settings: StoreSettings,
  storeUrl?: string
): string {
  const effectiveBaseUrl = storeUrl || getPublicStoreUrl(settings);
  const statusKey = order.status.toLowerCase() as keyof typeof settings.chatTemplates;
  const customTemplate = settings.chatTemplates?.[statusKey];

  if (customTemplate && customTemplate.trim()) {
    return applyTemplateTokens(customTemplate, order, settings, effectiveBaseUrl);
  }

  const itemsSummary = order.items
    .map((item) => `${item.product.title} [${item.product.productCode}] (Qty: ${item.quantity})`)
    .join(', ');

  const trackingLink = getTrackingLink(order, settings, effectiveBaseUrl);

  const staffSignature = order.assignedStaffName
    ? `\n👤 *Attending Concierge:* ${order.assignedStaffName}${order.lastUpdatedBy ? ` (@${order.lastUpdatedBy})` : ''}`
    : order.lastUpdatedBy && order.lastUpdatedBy !== 'system'
    ? `\n👤 *Handled by Staff:* @${order.lastUpdatedBy}`
    : '';

  switch (order.status) {
    case 'Pending':
      return `Namaste ${order.customer.name},

Thank you for choosing *${settings.boutiqueName}*.
We have received your saree reservation request:
• Order Reference: *#${order.orderNumber}*
• Items: ${itemsSummary}
• Total Amount: *${formatPrice(order.totalAmount)}*
• Payment UTR: *${order.upiTransactionId}*

Our atelier team is currently verifying your payment transaction. You can check your order status anytime here:
🔗 ${trackingLink}${staffSignature}

Warm regards,
${settings.boutiqueName}`;

    case 'Confirmed':
      return `Namaste ${order.customer.name},

✨ Great news! Your order *#${order.orderNumber}* has been *CONFIRMED* by *${settings.boutiqueName}*.

• Order: *#${order.orderNumber}*
• Items: ${itemsSummary}
• Payment UTR: *${order.upiTransactionId}* (Verified)

Your pure silk heirloom is being inspected and packed in our signature tamper-proof box. We will notify you once dispatched!

Track status:
🔗 ${trackingLink}${staffSignature}

Warm regards,
${settings.boutiqueName}`;

    case 'Shipped':
      const courier = order.shippingDetails?.courierName || 'Registered Express Courier';
      const trackingId = order.shippingDetails?.trackingNumber || 'Tracking ID Assigned';

      return `Namaste ${order.customer.name},

📦 Your handloom saree order *#${order.orderNumber}* has been *DISPATCHED*!

• Courier Partner: *${courier}*
• Tracking / Consignment ID: *${trackingId}*
• Items: ${itemsSummary}

_Please note: As our shipments are insured and artisan-direct, you can monitor your order status on our boutique website using your order number or phone number:_
🔗 ${trackingLink}${staffSignature}

Delivery is typically completed within 2–5 business days.
Warm regards,
${settings.boutiqueName}`;

    case 'Delivered':
      return `Namaste ${order.customer.name},

🎉 Your order *#${order.orderNumber}* has been *DELIVERED*!

We hope you cherish the craftsmanship and texture of your handloom drape. If you'd like to share photos or tag us on Instagram, find us at *${settings.instagramHandle}*.${staffSignature}

Thank you for supporting authentic Indian weavers.
Warm regards,
${settings.boutiqueName}`;

    case 'Cancelled':
    case 'Rejected':
      const reasonNotice = order.cancellationReason
        ? `\n• *Reason for ${order.status}:* ${order.cancellationReason}`
        : '';
      const refundUtrText = order.refundDetails?.refundUtr
        ? `\n• *Refund Transaction UTR ID:* *${order.refundDetails.refundUtr}*`
        : '';
      const refundUpi = order.refundDetails?.refundUpiId ? `\n• Refunded to UPI: *${order.refundDetails.refundUpiId}*` : '';
      const refundPhone = order.refundDetails?.refundUpiPhone ? ` (Phone: ${order.refundDetails.refundUpiPhone})` : '';

      return `Namaste ${order.customer.name},

Regarding your order *#${order.orderNumber}* at *${settings.boutiqueName}*:

Your order has been marked as *${order.status.toUpperCase()}*.${reasonNotice}
${order.refundDetails?.refundStatus === 'processed' ? `Your refund has been processed:` : `Your refund is initiated:`}
• Refund Amount: *${formatPrice(order.totalAmount)}*${refundUtrText}${refundUpi}${refundPhone}${staffSignature}

If you have any questions, our concierge team is always available here on WhatsApp.
Warm regards,
${settings.boutiqueName}`;

    default:
      return `Namaste ${order.customer.name}, Update on your order #${order.orderNumber} at ${settings.boutiqueName}. Current Status: ${order.status}. Track: ${trackingLink}${staffSignature}`;
  }
}

/**
 * Generates structured WhatsApp message for Customer Cancellation Request
 */
export function formatWhatsAppCustomerCancellationRequest(
  order: Order,
  reason: string,
  settings: StoreSettings
): string {
  return `Namaste ${settings.boutiqueName},

I would like to request *CANCELLATION* for my saree order:
• Order Number: *#${order.orderNumber}*
• Registered Phone: *${order.customer.phone}*
• Customer Name: *${order.customer.name}*
• Total Order Value: *${formatPrice(order.totalAmount)}*
• Reason for Cancellation: *${reason}*

${order.refundDetails?.refundUpiId ? `Refund to my UPI: *${order.refundDetails.refundUpiId}*` : ''}

Kindly process the cancellation and refund at your earliest convenience. Thank you.`;
}

/**
 * Generates structured WhatsApp refund message for store owner with mandatory Refund UTR
 */
export function formatWhatsAppRefundMessage(order: Order, settings: StoreSettings): string {
  if (settings.chatTemplates?.refunded && settings.chatTemplates.refunded.trim()) {
    return applyTemplateTokens(settings.chatTemplates.refunded, order, settings);
  }

  const utrNotice = order.refundDetails?.refundUtr
    ? `\n• *Refund Transaction UTR ID:* *${order.refundDetails.refundUtr}*`
    : '';
  const reasonText = order.cancellationReason
    ? `\n• Reason: ${order.cancellationReason}`
    : '';

  return `Namaste ${order.customer.name},

Regarding your order *#${order.orderNumber}* at *${settings.boutiqueName}* for ${formatPrice(order.totalAmount)}:

Your refund has been successfully completed:${reasonText}${utrNotice}
• Refund Amount: *${formatPrice(order.totalAmount)}*
• Sent to UPI: *${order.refundDetails?.refundUpiId || 'Customer UPI'}*
• Phone: *${order.refundDetails?.refundUpiPhone || order.customer.phone}*

Thank you for your gracious understanding.
Warm regards,
${settings.boutiqueName} Concierge`;
}

export function openWhatsApp(phone: string, text: string) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
