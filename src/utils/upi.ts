import { Order, StoreSettings } from '../types/store';

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
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

export function applyTemplateTokens(
  template: string,
  order: Order,
  settings: StoreSettings,
  storeUrl = window.location.origin
): string {
  const itemsSummary = order.items
    .map((item) => `${item.product.title} [${item.product.productCode}] (Qty: ${item.quantity})`)
    .join(', ');

  const trackingLink = `${storeUrl}/#track?order=${encodeURIComponent(order.orderNumber)}&phone=${encodeURIComponent(order.customer.phone)}`;

  const staffSignature = order.assignedStaffName
    ? `\n👤 *Attending Concierge:* ${order.assignedStaffName}${order.lastUpdatedBy ? ` (@${order.lastUpdatedBy})` : ''}`
    : order.lastUpdatedBy && order.lastUpdatedBy !== 'system'
    ? `\n👤 *Handled by Staff:* @${order.lastUpdatedBy}`
    : '';

  const courier = order.shippingDetails?.courierName || 'DTDC Express';
  const trackingId = order.shippingDetails?.trackingNumber || 'Pending';
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

  return template
    .replace(/\{customerName\}/g, order.customer.name)
    .replace(/\{boutiqueName\}/g, settings.boutiqueName)
    .replace(/\{orderNumber\}/g, order.orderNumber)
    .replace(/\{itemsSummary\}/g, itemsSummary)
    .replace(/\{totalAmount\}/g, formatPrice(order.totalAmount))
    .replace(/\{upiTransactionId\}/g, order.upiTransactionId)
    .replace(/\{trackingLink\}/g, trackingLink)
    .replace(/\{courierName\}/g, courier)
    .replace(/\{trackingNumber\}/g, trackingId)
    .replace(/\{reasonNotice\}/g, reasonNotice)
    .replace(/\{reason\}/g, reason)
    .replace(/\{refundStatusNotice\}/g, refundStatusNotice)
    .replace(/\{refundUtrText\}/g, refundUtrText)
    .replace(/\{refundUtr\}/g, refundUtr)
    .replace(/\{refundUpiText\}/g, refundUpiText)
    .replace(/\{refundUpi\}/g, refundUpi)
    .replace(/\{staffSignature\}/g, staffSignature)
    .replace(/\{instagramHandle\}/g, settings.instagramHandle);
}

/**
 * Generates stage-specific WhatsApp notification messages for customers
 */
export function formatWhatsAppStageUpdateMessage(
  order: Order,
  settings: StoreSettings,
  storeUrl = window.location.origin
): string {
  const statusKey = order.status.toLowerCase() as keyof typeof settings.chatTemplates;
  const customTemplate = settings.chatTemplates?.[statusKey];

  if (customTemplate && customTemplate.trim()) {
    return applyTemplateTokens(customTemplate, order, settings, storeUrl);
  }

  const itemsSummary = order.items
    .map((item) => `${item.product.title} [${item.product.productCode}] (Qty: ${item.quantity})`)
    .join(', ');

  const trackingLink = `${storeUrl}/#track?order=${encodeURIComponent(order.orderNumber)}&phone=${encodeURIComponent(order.customer.phone)}`;

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
