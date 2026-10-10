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
 * Builds standard SVG QR-like matrix visual or fetches direct QR code image URL
 */
export function getUpiQrCodeImageUrl(upiId: string, payeeName: string, amount: number, orderNumber?: string): string {
  const upiUri = generateUpiUri(upiId, payeeName, amount, orderNumber);
  // Uses reliable high-performance QR server API for crisp scan
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(upiUri)}&margin=10`;
}

/**
 * Generates structured WhatsApp message for dual checkout
 */
export function formatWhatsAppOrderMessage(order: Order, settings: StoreSettings): string {
  const itemsText = order.items
    .map((item, index) => `${index + 1}. *${item.product.title}* (${item.product.fabric}) - Qty: ${item.quantity} × ${formatPrice(item.product.price)}`)
    .join('\n');

  const message = `🛍️ *NEW HANDLOOM ORDER RESERVATION*
Boutique: *${settings.boutiqueName}*
Order Reference: *#${order.orderNumber}*
Date: ${new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}

*ORDER ITEMS:*
${itemsText}

💰 *TOTAL AMOUNT:* ${formatPrice(order.totalAmount)}
💳 *PAYMENT TRANSACTION ID (UTR):* ${order.upiTransactionId}
Store UPI Paid To: ${settings.payment.upiId}

📦 *SHIPPING ADDRESS:*
Name: *${order.customer.name}*
Phone: *${order.customer.phone}*
Email: ${order.customer.email}
Address: ${order.customer.address}, ${order.customer.city}, ${order.customer.state} - ${order.customer.pincode}

🔁 *CUSTOMER REFUND UPI DETAILS (In case of order cancellation):*
Refund UPI ID: *${order.refundDetails.refundUpiId}*
Refund UPI Phone: *${order.refundDetails.refundUpiPhone}*

${order.notes ? `📝 *Customer Notes:* ${order.notes}\n` : ''}
_Kindly verify the payment transaction and confirm my boutique dispatch dispatch tracking._`;

  return message;
}

/**
 * Generates structured WhatsApp refund message for store owner
 */
export function formatWhatsAppRefundMessage(order: Order, settings: StoreSettings): string {
  return `Namaste ${order.customer.name},

Regarding your order *#${order.orderNumber}* at *${settings.boutiqueName}* for ${formatPrice(order.totalAmount)}:

We have noted the order status update (${order.status}). Your refund has been initiated to your provided UPI details:
• UPI ID: *${order.refundDetails.refundUpiId}*
• Registered Phone: *${order.refundDetails.refundUpiPhone}*
• Refund Amount: *${formatPrice(order.totalAmount)}*

Thank you for your gracious understanding.
Warm regards,
${settings.boutiqueName} Concierge`;
}

export function openWhatsApp(phone: string, text: string) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
