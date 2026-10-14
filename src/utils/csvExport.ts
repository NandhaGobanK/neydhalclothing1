import { Order } from '../types/store';

/**
 * Universal RFC 4180-compliant CSV cell sanitizer.
 * Guarantees zero column shifting, zero row wrapping splits, and zero crossed data points.
 */
function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) {
    return '""';
  }

  if (typeof value === 'number') {
    return isNaN(value) ? '0' : String(value);
  }

  if (typeof value === 'boolean') {
    return value ? '"Yes"' : '"No"';
  }

  // Convert to string and sanitize linebreaks & quotes
  const str = String(value)
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n]/g, ' ')
    .replace(/"/g, '""')
    .trim();

  return `"${str}"`;
}

/**
 * Exports an array of orders to a clean, perfectly aligned CSV file.
 * Uses UTF-8 BOM so Microsoft Excel, Google Sheets, Numbers, and LibreOffice
 * render all rupee symbols, Indian addresses, and unicode characters correctly.
 */
export function exportOrdersToCleanCsv(ordersList: Order[], fileSuffix: string): void {
  const headers = [
    'Order Number',
    'Date Placed (IST)',
    'Customer Name',
    'Customer Phone',
    'Customer Email',
    'Delivery Address',
    'City',
    'State',
    'Pincode',
    'Order Stage / Status',
    'Lifecycle Status',
    'Total Amount (₹)',
    'Payment Reference / UTR',
    'Ordered Sarees Summary',
    'Assigned Staff Concierge',
    'Courier Partner',
    'Tracking / Consignment ID',
    'Customer Delivery Issue Status',
    'Delivery Issue Statement',
    'Refund Status',
    'Refund UTR',
    'Cancellation Reason',
    'Reopened Reason',
    'Last Action / Work Audit Log',
  ];

  const rows = ordersList.map((ord) => {
    const lastLog =
      ord.assignmentHistory && ord.assignmentHistory.length > 0
        ? ord.assignmentHistory[ord.assignmentHistory.length - 1]
        : null;

    const lastLogText = lastLog
      ? `[${new Date(lastLog.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}] ${lastLog.staffName}: ${lastLog.action}${lastLog.note ? ` - ${lastLog.note}` : ''}`
      : 'Initial order placement';

    const itemsSummary = (ord.items || [])
      .map((it) => `${it.product?.title || 'Saree'} (${it.product?.fabric || ''}) x${it.quantity}`)
      .join('; ');

    const dateStr = ord.createdAt
      ? new Date(ord.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      : '';

    return [
      sanitizeCsvCell(ord.orderNumber),
      sanitizeCsvCell(dateStr),
      sanitizeCsvCell(ord.customer?.name || ''),
      sanitizeCsvCell(ord.customer?.phone || ''),
      sanitizeCsvCell(ord.customer?.email || ''),
      sanitizeCsvCell(ord.customer?.address || ''),
      sanitizeCsvCell(ord.customer?.city || ''),
      sanitizeCsvCell(ord.customer?.state || ''),
      sanitizeCsvCell(ord.customer?.pincode || ''),
      sanitizeCsvCell(ord.status || 'Pending'),
      sanitizeCsvCell(ord.isClosed ? 'Closed' : 'Active'),
      sanitizeCsvCell(ord.totalAmount || 0),
      sanitizeCsvCell(ord.upiTransactionId || 'Pending Verification'),
      sanitizeCsvCell(itemsSummary),
      sanitizeCsvCell(ord.assignedStaffName || 'Unassigned'),
      sanitizeCsvCell(ord.shippingDetails?.courierName || 'Unassigned'),
      sanitizeCsvCell(ord.shippingDetails?.trackingNumber || ''),
      sanitizeCsvCell(
        ord.deliveryIssue?.reported
          ? `Dispute: ${ord.deliveryIssue.status.toUpperCase()}`
          : 'Normal'
      ),
      sanitizeCsvCell(ord.deliveryIssue?.issueDescription || ''),
      sanitizeCsvCell(ord.refundDetails?.refundStatus || 'not_required'),
      sanitizeCsvCell(ord.refundDetails?.refundUtr || ''),
      sanitizeCsvCell(ord.cancellationReason || ''),
      sanitizeCsvCell(ord.reopenReason || ''),
      sanitizeCsvCell(lastLogText),
    ].join(',');
  });

  // \uFEFF Byte Order Mark for Excel UTF-8 compatibility
  const csvString = '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n');

  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `orders_report_${fileSuffix}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
