import { Order, StoreSettings, Product } from '../types/store';

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Validates whether a UPI transaction reference (UTR / Transaction ID) is exactly 12 numeric digits.
 */
export function isValid12DigitUtr(utr: string | undefined | null): boolean {
  if (!utr) return false;
  const clean = utr.replace(/\D/g, '').trim();
  return clean.length === 12;
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
    // Upgrade legacy domain neydhal-smoky.vercel.app to official neydhalclothing.in
    if (domain.includes('neydhal-smoky') || domain.includes('neydhal-smoky.vercel.app')) {
      domain = 'https://neydhalclothing.in';
    }
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = `https://${domain}`;
    }
    return domain.replace(/\/+$/, '');
  }

  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PUBLIC_STORE_URL) {
    let envDomain = String(import.meta.env.VITE_PUBLIC_STORE_URL).trim();
    if (envDomain) {
      if (envDomain.includes('neydhal-smoky')) {
        envDomain = 'https://neydhalclothing.in';
      }
      if (!envDomain.startsWith('http://') && !envDomain.startsWith('https://')) {
        envDomain = `https://${envDomain}`;
      }
      return envDomain.replace(/\/+$/, '');
    }
  }

  if (typeof window !== 'undefined' && window.location && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('run.app')) {
    return window.location.origin;
  }

  return 'https://neydhalclothing.in';
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

/* =======================================================================
 * EXPANDED AUTOMATED DISPUTE & CANCELLATION LIFECYCLE TEMPLATES
 * ======================================================================= */

/**
 * Cancellation Dispute Stage: Acknowledging cancellation request
 */
export function formatWhatsAppCancellationRequestAck(
  order: Order,
  settings: StoreSettings,
  storeUrl?: string
): string {
  const trackingLink = getTrackingLink(order, settings, storeUrl);
  const staffSignature = order.assignedStaffName
    ? `\n👤 *Attending Concierge:* ${order.assignedStaffName}`
    : '';
  const reasonText = order.cancellationRequest?.reason || order.cancellationReason || 'Customer requested';

  return `Namaste ${order.customer.name},

We have received your *CANCELLATION REQUEST* for order *#${order.orderNumber}*:
• Order Reference: *#${order.orderNumber}*
• Order Value: *${formatPrice(order.totalAmount)}*
• Stated Reason: *${reasonText}*

Our atelier concierge is reviewing the dispatch status with our workshop. If the saree has not left the packaging bay, your order will be cancelled, inventory restored, and refund processed promptly.

You can monitor review status live:
🔗 ${trackingLink}${staffSignature}

Warm regards,
${settings.boutiqueName} Concierge`;
}

/**
 * Cancellation Dispute Stage: Cancellation Approved & Auto-Restock Confirmation
 */
export function formatWhatsAppCancellationApproved(
  order: Order,
  settings: StoreSettings,
  storeUrl?: string
): string {
  const trackingLink = getTrackingLink(order, settings, storeUrl);
  const staffSignature = order.assignedStaffName
    ? `\n👤 *Attending Concierge:* ${order.assignedStaffName}`
    : '';
  const utrText = order.refundDetails?.refundUtr
    ? `\n• *Refund UTR Reference:* *${order.refundDetails.refundUtr}*`
    : '';
  const destinationUpi = order.refundDetails?.refundUpiId
    ? `\n• *Destination UPI ID:* *${order.refundDetails.refundUpiId}*`
    : '';

  return `Namaste ${order.customer.name},

Your cancellation request for order *#${order.orderNumber}* has been *APPROVED* by *${settings.boutiqueName}*.

• Status: *CANCELLED & CLOSED*
• Inventory Action: *Handloom piece auto-restocked to boutique ledger*
• Refund Amount: *${formatPrice(order.totalAmount)}*${utrText}${destinationUpi}

${order.refundDetails?.refundStatus === 'processed' ? 'Your refund has been completed directly to your UPI.' : 'Your refund transaction is being processed by our accounts desk.'}

Order record:
🔗 ${trackingLink}${staffSignature}

Warm regards,
${settings.boutiqueName} Atelier`;
}

/**
 * Cancellation Dispute Stage: Cancellation Declined Notice
 */
export function formatWhatsAppCancellationDeclined(
  order: Order,
  settings: StoreSettings,
  declineReason?: string,
  storeUrl?: string
): string {
  const trackingLink = getTrackingLink(order, settings, storeUrl);
  const staffSignature = order.assignedStaffName
    ? `\n👤 *Attending Concierge:* ${order.assignedStaffName}`
    : '';
  const reason = declineReason || 'Parcel has already been dispatched with courier partner.';
  const courier = order.shippingDetails?.courierName;
  const trackingId = order.shippingDetails?.trackingNumber;

  return `Namaste ${order.customer.name},

Regarding your cancellation request for order *#${order.orderNumber}* at *${settings.boutiqueName}*:

We are unable to approve cancellation at this stage:
• *Notice:* ${reason}
• Current Order Status: *${order.status}*
${courier ? `• Courier Partner: *${courier}*` : ''}
${trackingId ? `• Consignment ID: *${trackingId}*` : ''}

Your authentic handloom saree remains safely on its way to your destination. Track live delivery:
🔗 ${trackingLink}${staffSignature}

Warm regards,
${settings.boutiqueName} Concierge`;
}

/**
 * Delivery Dispute Stage: Acknowledging non-receipt reports
 */
export function formatWhatsAppDeliveryIssueAck(
  order: Order,
  settings: StoreSettings,
  storeUrl?: string
): string {
  const trackingLink = getTrackingLink(order, settings, storeUrl);
  const staffSignature = order.assignedStaffName
    ? `\n👤 *Assigned Concierge:* ${order.assignedStaffName}`
    : '';
  const courier = order.shippingDetails?.courierName || 'Registered Express Courier';
  const trackingId = order.shippingDetails?.trackingNumber || 'Assigned';
  const issueText = order.deliveryIssue?.issueDescription || 'Parcel not received at doorstep';

  return `Namaste ${order.customer.name},

We have received your *DELIVERY DISPUTE REPORT* for order *#${order.orderNumber}*:
• Reported Issue: *"${issueText}"*
• Carrier Partner: *${courier}*
• Consignment / Tracking ID: *${trackingId}*

Our senior atelier concierge has escalated this case directly with the local ${courier} delivery hub manager to verify runner delivery sheets and pod signature records.

We will keep you updated in real-time on live chat and WhatsApp:
🔗 ${trackingLink}${staffSignature}

Warm regards,
${settings.boutiqueName} Logistics Support`;
}

/**
 * Delivery Dispute Stage: Courier investigation update
 */
export function formatWhatsAppDeliveryInvestigating(
  order: Order,
  settings: StoreSettings,
  storeUrl?: string
): string {
  const trackingLink = getTrackingLink(order, settings, storeUrl);
  const staffSignature = order.assignedStaffName
    ? `\n👤 *Assigned Concierge:* ${order.assignedStaffName}`
    : '';
  const courier = order.shippingDetails?.courierName || 'the courier partner';
  const trackingId = order.shippingDetails?.trackingNumber || '';

  return `Namaste ${order.customer.name},

Investigation Update on Order *#${order.orderNumber}*:

Our concierge team is actively coordinating with the ${courier} dispatch desk${trackingId ? ` (Consignment: #${trackingId})` : ''}.
• Action: *Field verification with local route executive & physical proof-of-delivery audit*
• Investigation Status: *In Progress (High Priority)*

We assure you of safe resolution. You may reply to this message or check updates here:
🔗 ${trackingLink}${staffSignature}

Warm regards,
${settings.boutiqueName} Concierge Desk`;
}

/**
 * Delivery Dispute Stage: Resolution Notice
 */
export function formatWhatsAppDeliveryResolved(
  order: Order,
  settings: StoreSettings,
  resolutionNote?: string,
  storeUrl?: string
): string {
  const trackingLink = getTrackingLink(order, settings, storeUrl);
  const staffSignature = order.assignedStaffName
    ? `\n👤 *Assigned Concierge:* ${order.assignedStaffName}`
    : '';
  const note = resolutionNote || order.deliveryIssue?.resolutionNotes || 'Dispute investigated and successfully resolved with customer.';

  return `Namaste ${order.customer.name},

Your delivery issue for order *#${order.orderNumber}* has been *OFFICIALLY RESOLVED* by *${settings.boutiqueName}*.

• *Resolution Summary:* ${note}
• Order Reference: *#${order.orderNumber}*

We thank you for your patience and gracious cooperation. Please let us know if you need any styling or saree care guidance:
🔗 ${trackingLink}${staffSignature}

Warm regards,
${settings.boutiqueName}`;
}

/**
 * Refund Dispute Stage: Acknowledging refund report issues
 */
export function formatWhatsAppRefundReportAck(
  order: Order,
  settings: StoreSettings,
  storeUrl?: string
): string {
  const trackingLink = getTrackingLink(order, settings, storeUrl);
  const staffSignature = order.assignedStaffName
    ? `\n👤 *Finance Concierge:* ${order.assignedStaffName}`
    : '';
  const desc = order.deliveryIssue?.issueDescription || 'Customer submitted inquiry regarding refund settlement.';

  return `Namaste ${order.customer.name},

We have logged your *REFUND INQUIRY TICKET* for order *#${order.orderNumber}*:
• Total Order Value: *${formatPrice(order.totalAmount)}*
• Inquiry Detail: *"${desc}"*
• Registered UPI ID: *${order.refundDetails?.refundUpiId || order.customer.phone}*

Our finance concierge has initiated an audit of the bank transaction log and payment gateway records to confirm settlement.

Track ticket status:
🔗 ${trackingLink}${staffSignature}

Warm regards,
${settings.boutiqueName} Accounts Desk`;
}

/**
 * Refund Dispute Stage: UTR verification status
 */
export function formatWhatsAppRefundInvestigating(
  order: Order,
  settings: StoreSettings,
  storeUrl?: string
): string {
  const trackingLink = getTrackingLink(order, settings, storeUrl);
  const staffSignature = order.assignedStaffName
    ? `\n👤 *Finance Concierge:* ${order.assignedStaffName}`
    : '';

  return `Namaste ${order.customer.name},

Refund Audit Update on Order *#${order.orderNumber}*:

Our banking desk is verifying the payment settlement batch and 12-digit UTR reference with our nodal bank.
• Amount: *${formatPrice(order.totalAmount)}*
• Destination Account / UPI: *${order.refundDetails?.refundUpiId || order.customer.phone}*
• Audit Status: *UTR Banking Verification In-Flight*

We will post your verified bank UTR number as soon as the ledger cycle completes.
🔗 ${trackingLink}${staffSignature}

Warm regards,
${settings.boutiqueName} Accounts`;
}

/**
 * Refund Dispute Stage: Refund settlement confirmation
 */
export function formatWhatsAppRefundSettled(
  order: Order,
  settings: StoreSettings,
  storeUrl?: string
): string {
  const trackingLink = getTrackingLink(order, settings, storeUrl);
  const staffSignature = order.assignedStaffName
    ? `\n👤 *Finance Concierge:* ${order.assignedStaffName}`
    : '';
  const utr = order.refundDetails?.refundUtr || order.upiTransactionId || 'Verified';

  return `Namaste ${order.customer.name},

✨ Your refund for order *#${order.orderNumber}* has been *SETTLED & CONFIRMED*!

• Refund Amount: *${formatPrice(order.totalAmount)}*
• *Verified Bank UTR ID:* *${utr}*
• Transferred To: *${order.refundDetails?.refundUpiId || 'Customer UPI'}* (${order.refundDetails?.refundUpiPhone || order.customer.phone})
• Settlement Status: *Completed*

The funds are credited to your UPI account. Please verify with your UPI / banking app.
🔗 ${trackingLink}${staffSignature}

Thank you for your understanding.
Warm regards,
${settings.boutiqueName} Atelier`;
}

/* =======================================================================
 * MASTER CONTEXTUAL TEMPLATE RESOLVER FOR LIVE CHAT & WHATSAPP
 * ======================================================================= */

export interface OrderChatTemplate {
  id: string;
  title: string;
  category: 'cancellation_dispute' | 'delivery_dispute' | 'refund_dispute' | 'order_milestone';
  categoryLabel: string;
  text: string;
  isContextualMatch: boolean;
  matchReason?: string;
  badge?: string;
}

/**
 * Returns all available templates for an order, dynamically prefilled with real order variables,
 * with the exact stage-matching template flagged as top suggested.
 */
export function getOrderContextualTemplates(
  order: Order,
  settings: StoreSettings,
  storeUrl?: string
): {
  templates: OrderChatTemplate[];
  topSuggestedTemplate: OrderChatTemplate | null;
} {
  const isDeliveryIssue =
    order.deliveryIssue?.reported === true &&
    (order.deliveryIssue?.issueType === 'delivery' || (!order.deliveryIssue?.issueType && order.status === 'Delivered'));

  const isRefundIssue =
    order.deliveryIssue?.reported === true && order.deliveryIssue?.issueType === 'refund';

  const isCancellationIssue =
    (order.cancellationRequest?.requested === true && order.cancellationRequest?.status === 'pending') ||
    order.deliveryIssue?.issueType === 'cancellation';

  const isCancelledOrRejected = order.status === 'Cancelled' || order.status === 'Rejected';
  const isRefundedStatus = order.status === 'Refunded' || order.refundDetails?.refundStatus === 'processed';

  const templates: OrderChatTemplate[] = [
    // -------------------------------------------------------------
    // Cancellation Dispute Templates
    // -------------------------------------------------------------
    {
      id: 'cancel_ack',
      title: 'Cancellation Request Acknowledged',
      category: 'cancellation_dispute',
      categoryLabel: 'Cancellation Dispute',
      badge: 'Ack Request',
      text: formatWhatsAppCancellationRequestAck(order, settings, storeUrl),
      isContextualMatch: Boolean(isCancellationIssue && order.cancellationRequest?.status === 'pending'),
      matchReason: 'Customer submitted a pending cancellation request.',
    },
    {
      id: 'cancel_approved',
      title: 'Cancellation Approved & Restocked',
      category: 'cancellation_dispute',
      categoryLabel: 'Cancellation Dispute',
      badge: 'Approved',
      text: formatWhatsAppCancellationApproved(order, settings, storeUrl),
      isContextualMatch: Boolean(
        (isCancelledOrRejected || order.cancellationRequest?.status === 'approved') && !isRefundedStatus
      ),
      matchReason: 'Order is cancelled and stock auto-restored.',
    },
    {
      id: 'cancel_declined',
      title: 'Cancellation Declined Notice',
      category: 'cancellation_dispute',
      categoryLabel: 'Cancellation Dispute',
      badge: 'Declined',
      text: formatWhatsAppCancellationDeclined(
        order,
        settings,
        order.cancellationRequest?.adminDecisionNotes || 'Saree already dispatched with express courier',
        storeUrl
      ),
      isContextualMatch: Boolean(order.cancellationRequest?.status === 'rejected'),
      matchReason: 'Cancellation request was declined by concierge.',
    },

    // -------------------------------------------------------------
    // Delivery Dispute Templates
    // -------------------------------------------------------------
    {
      id: 'delivery_ack',
      title: 'Delivery Dispute Acknowledged',
      category: 'delivery_dispute',
      categoryLabel: 'Delivery Dispute',
      badge: 'Ack Non-Receipt',
      text: formatWhatsAppDeliveryIssueAck(order, settings, storeUrl),
      isContextualMatch: Boolean(isDeliveryIssue && order.deliveryIssue?.status === 'open'),
      matchReason: 'Active customer delivery issue reported (open).',
    },
    {
      id: 'delivery_investigating',
      title: 'Courier Hub Investigation In-Flight',
      category: 'delivery_dispute',
      categoryLabel: 'Delivery Dispute',
      badge: 'Investigating',
      text: formatWhatsAppDeliveryInvestigating(order, settings, storeUrl),
      isContextualMatch: Boolean(isDeliveryIssue && order.deliveryIssue?.status === 'investigating'),
      matchReason: 'Concierge is actively investigating with courier hub.',
    },
    {
      id: 'delivery_resolved',
      title: 'Delivery Dispute Resolved Notice',
      category: 'delivery_dispute',
      categoryLabel: 'Delivery Dispute',
      badge: 'Resolved',
      text: formatWhatsAppDeliveryResolved(order, settings, undefined, storeUrl),
      isContextualMatch: Boolean(isDeliveryIssue && order.deliveryIssue?.status === 'resolved'),
      matchReason: 'Delivery dispute is resolved and closed.',
    },

    // -------------------------------------------------------------
    // Refund Dispute Templates
    // -------------------------------------------------------------
    {
      id: 'refund_ack',
      title: 'Refund Issue Report Acknowledged',
      category: 'refund_dispute',
      categoryLabel: 'Refund Dispute',
      badge: 'Ack Refund',
      text: formatWhatsAppRefundReportAck(order, settings, storeUrl),
      isContextualMatch: Boolean(isRefundIssue && order.deliveryIssue?.status === 'open'),
      matchReason: 'Customer submitted a refund inquiry / ticket.',
    },
    {
      id: 'refund_investigating',
      title: 'Refund UTR Banking Verification',
      category: 'refund_dispute',
      categoryLabel: 'Refund Dispute',
      badge: 'UTR Verification',
      text: formatWhatsAppRefundInvestigating(order, settings, storeUrl),
      isContextualMatch: Boolean(
        isRefundIssue && (order.deliveryIssue?.status === 'investigating' || order.refundDetails?.refundStatus === 'pending')
      ),
      matchReason: 'UTR banking verification in progress.',
    },
    {
      id: 'refund_settled',
      title: 'Refund Settled Confirmation',
      category: 'refund_dispute',
      categoryLabel: 'Refund Dispute',
      badge: 'Settled',
      text: formatWhatsAppRefundSettled(order, settings, storeUrl),
      isContextualMatch: Boolean(isRefundedStatus || (isRefundIssue && order.deliveryIssue?.status === 'resolved')),
      matchReason: 'Refund has been verified and settled to customer UPI.',
    },

    // -------------------------------------------------------------
    // Standard Order Lifecycle Milestones
    // -------------------------------------------------------------
    {
      id: 'stage_pending',
      title: 'Order Received & UTR Verification',
      category: 'order_milestone',
      categoryLabel: 'Order Milestones',
      badge: 'Pending',
      text: formatWhatsAppStageUpdateMessage({ ...order, status: 'Pending' }, settings, storeUrl),
      isContextualMatch: order.status === 'Pending' && !isCancellationIssue && !isDeliveryIssue && !isRefundIssue,
      matchReason: 'Order is awaiting payment verification.',
    },
    {
      id: 'stage_confirmed',
      title: 'Order Confirmed & Atelier Inspection',
      category: 'order_milestone',
      categoryLabel: 'Order Milestones',
      badge: 'Confirmed',
      text: formatWhatsAppStageUpdateMessage({ ...order, status: 'Confirmed' }, settings, storeUrl),
      isContextualMatch: order.status === 'Confirmed' && !isCancellationIssue && !isDeliveryIssue && !isRefundIssue,
      matchReason: 'Order confirmed and handloom drape being prepared.',
    },
    {
      id: 'stage_shipped',
      title: 'Order Dispatched with Consignment ID',
      category: 'order_milestone',
      categoryLabel: 'Order Milestones',
      badge: 'Shipped',
      text: formatWhatsAppStageUpdateMessage({ ...order, status: 'Shipped' }, settings, storeUrl),
      isContextualMatch: order.status === 'Shipped' && !isCancellationIssue && !isDeliveryIssue && !isRefundIssue,
      matchReason: 'Order is in transit with courier partner.',
    },
    {
      id: 'stage_delivered',
      title: 'Order Delivered & Drape Appreciation',
      category: 'order_milestone',
      categoryLabel: 'Order Milestones',
      badge: 'Delivered',
      text: formatWhatsAppStageUpdateMessage({ ...order, status: 'Delivered' }, settings, storeUrl),
      isContextualMatch: order.status === 'Delivered' && !isDeliveryIssue && !isRefundIssue,
      matchReason: 'Order delivered to doorstep.',
    },
  ];

  // Find top suggested template: first look for exact dispute contextual match, then milestone match
  const topSuggestedTemplate =
    templates.find(
      (t) =>
        t.isContextualMatch &&
        (t.category === 'cancellation_dispute' ||
          t.category === 'delivery_dispute' ||
          t.category === 'refund_dispute')
    ) ||
    templates.find((t) => t.isContextualMatch) ||
    null;

  return {
    templates,
    topSuggestedTemplate,
  };
}

export function openWhatsApp(phone: string, text: string) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

