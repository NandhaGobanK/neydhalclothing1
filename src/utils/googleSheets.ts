import { Order, Product, StaffMember } from '../types/store';
import { getAccessToken, clearCachedToken } from './firebaseAuth';

export interface SheetSyncResult {
  success: boolean;
  spreadsheetId: string;
  spreadsheetUrl: string;
  rowsUpdated: number;
  message?: string;
  isNewlyCreated?: boolean;
}

const MASTER_TABS = [
  'Orders',
  'Overview & KPIs',
  'Product Sales Tracker',
  'Fabric Breakdown',
  'Staff Attribution',
];

function sanitizeSheetCell(val: any): string | number | boolean {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'boolean') return val;
  return String(val).replace(/\r\n/g, ' ').replace(/[\r\n]/g, ' ').trim();
}

/**
 * Robust fetch wrapper for Google Sheets API.
 * Automatically catches 401 / 403 "Request had insufficient authentication scopes",
 * prompts the user for consent with full scopes, and retries the request.
 */
async function fetchSheetsApi(
  url: string,
  options: RequestInit = {},
  retryOnScopeError = true
): Promise<Response> {
  let token = await getAccessToken(true, false);
  if (!token) {
    token = await getAccessToken(true, true);
  }
  if (!token) {
    throw new Error(
      'Google authorization token not found. Please click Sign In with Google to grant spreadsheet access.'
    );
  }

  const exec = async (authToken: string) => {
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${authToken}`,
    };
    return fetch(url, { ...options, headers });
  };

  let res = await exec(token);

  if (res.status === 401 || res.status === 403) {
    const errorJson = await res.clone().json().catch(() => ({}));
    const msg = errorJson?.error?.message || '';

    if (
      retryOnScopeError &&
      (res.status === 401 ||
        msg.toLowerCase().includes('insufficient') ||
        msg.toLowerCase().includes('scope'))
    ) {
      console.warn('Google Sheets token lacked required scopes. Re-prompting user for full consent...');
      clearCachedToken();
      // Force user consent prompt to grant spreadsheets and drive scopes
      const freshToken = await getAccessToken(true, true);
      if (freshToken) {
        res = await exec(freshToken);
      }
    }
  }

  return res;
}

/**
 * Checks if a master spreadsheet exists, or creates one containing all 5 unified tabs.
 * If the synced file was deleted or missing from Google Drive, gracefully recreates a new master file.
 */
async function getOrCreateMasterSpreadsheet(
  boutiqueName: string,
  existingSpreadsheetId?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; token: string; isNewlyCreated: boolean }> {
  let token = await getAccessToken(true, false);
  if (!token) {
    token = await getAccessToken(true, true);
  }
  if (!token) {
    throw new Error('Google authorization token not found.');
  }

  let spreadsheetId = existingSpreadsheetId;
  let needNewSpreadsheet = !spreadsheetId;
  let wasMissingOrDeleted = false;

  if (spreadsheetId) {
    try {
      const checkRes = await fetchSheetsApi(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`
      );
      if (checkRes.ok) {
        const sheetData = await checkRes.json();
        const existingTitles: string[] = (sheetData.sheets || []).map(
          (s: any) => s.properties?.title
        );

        // Check if any of our master tabs are missing; if so, create them
        const missingTabs = MASTER_TABS.filter((t) => !existingTitles.includes(t));
        if (missingTabs.length > 0) {
          await fetchSheetsApi(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                requests: missingTabs.map((title) => ({
                  addSheet: {
                    properties: {
                      title,
                      gridProperties: { frozenRowCount: 1 },
                    },
                  },
                })),
              }),
            }
          ).catch((err) => console.warn('Failed to add missing tabs:', err));
        }

        needNewSpreadsheet = false;
      } else {
        // File was deleted or not found in Google Drive (404/403/400)
        console.warn(`Spreadsheet ID ${spreadsheetId} is missing or deleted from Google Drive. Creating a fresh master spreadsheet.`);
        needNewSpreadsheet = true;
        wasMissingOrDeleted = true;
      }
    } catch {
      needNewSpreadsheet = true;
      wasMissingOrDeleted = true;
    }
  }

  if (needNewSpreadsheet) {
    const title = `${boutiqueName || 'Aara Heritage Saree Boutique'} - Master Store Ledger & Analytics`;
    const createRes = await fetchSheetsApi('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title },
        sheets: MASTER_TABS.map((tabTitle) => ({
          properties: {
            title: tabTitle,
            gridProperties: { frozenRowCount: 1 },
          },
        })),
      }),
    });

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({}));
      throw new Error(errData?.error?.message || 'Failed to create Google Spreadsheet in Google Drive.');
    }

    const created = await createRes.json();
    spreadsheetId = created.spreadsheetId;
  }

  const finalToken = (await getAccessToken(false, false)) || token;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return { spreadsheetId: spreadsheetId!, spreadsheetUrl, token: finalToken, isNewlyCreated: wasMissingOrDeleted || !existingSpreadsheetId };
}

/**
 * Creates or updates the Orders tab in the user's unified boutique Google Sheet
 */
export async function syncOrdersToGoogleSheet(
  orders: Order[],
  boutiqueName: string,
  existingSpreadsheetId?: string
): Promise<SheetSyncResult> {
  const { spreadsheetId, spreadsheetUrl, isNewlyCreated } = await getOrCreateMasterSpreadsheet(
    boutiqueName,
    existingSpreadsheetId
  );

  const headers = [
    'Order Number',
    'Date Placed (IST)',
    'Customer Name',
    'Customer Phone',
    'Customer Email',
    'Delivery Address',
    'City',
    'Pincode',
    'Order Status',
    'Lifecycle (Active/Closed)',
    'Assigned Concierge Staff',
    'Total Amount (₹)',
    'Payment Reference / UTR',
    'Ordered Sarees Summary',
    'Courier Partner',
    'Tracking / Consignment ID',
    'Customer Delivery Issue',
    'Refund Status',
    'Refund UTR',
    'Cancellation Reason',
    'Reopened Reason',
    'Customer Comments / Notes',
    'Staff Work Tracking History',
  ];

  const orderRows =
    orders.length > 0
      ? orders.map((o) => [
          sanitizeSheetCell(o.orderNumber),
          sanitizeSheetCell(new Date(o.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })),
          sanitizeSheetCell(o.customer?.name || ''),
          sanitizeSheetCell(o.customer?.phone || ''),
          sanitizeSheetCell(o.customer?.email || ''),
          sanitizeSheetCell(o.customer?.address || ''),
          sanitizeSheetCell(o.customer?.city || ''),
          sanitizeSheetCell(o.customer?.pincode || ''),
          sanitizeSheetCell(o.status || 'Pending'),
          sanitizeSheetCell(o.isClosed ? 'Closed' : 'Active'),
          sanitizeSheetCell(o.assignedStaffName || 'Unassigned'),
          o.totalAmount || 0,
          sanitizeSheetCell(o.upiTransactionId || 'Pending Verification'),
          sanitizeSheetCell(
            (o.items || [])
              .map(
                (item) =>
                  `${item.product?.title || 'Saree'} (${item.product?.fabric || ''} - ${item.product?.color || ''}) x${item.quantity}`
              )
              .join('; ')
          ),
          sanitizeSheetCell(o.shippingDetails?.courierName || 'Unassigned'),
          sanitizeSheetCell(o.shippingDetails?.trackingNumber || ''),
          sanitizeSheetCell(
            o.deliveryIssue?.reported
              ? `Reported: ${o.deliveryIssue.issueDescription}`
              : 'None'
          ),
          sanitizeSheetCell(o.refundDetails?.refundStatus || 'not_required'),
          sanitizeSheetCell(o.refundDetails?.refundUtr || ''),
          sanitizeSheetCell(o.cancellationReason || ''),
          sanitizeSheetCell(o.reopenReason || ''),
          sanitizeSheetCell(o.notes || ''),
          sanitizeSheetCell(
            (o.assignmentHistory || [])
              .map(
                (h) =>
                  `[${new Date(h.timestamp).toLocaleDateString('en-IN')}] ${h.staffName}: ${h.action}${h.note ? ` (${h.note})` : ''}`
              )
              .join('; ')
          ),
        ])
      : [
          [
            'TEMPLATE',
            new Date().toLocaleDateString('en-IN'),
            'Store Ready - No Orders Placed Yet',
            '-',
            '-',
            '-',
            '-',
            '-',
            'Ready',
            'Active',
            '-',
            0,
            '-',
            'Columns configured for incoming orders',
            '-',
            '-',
            '-',
            '-',
            '-',
            '-',
            '-',
            '-',
            'Synced from Boutique Console',
          ],
        ];

  const allValues = [headers, ...orderRows];

  // Clear old rows from Orders sheet to prevent ghost rows
  await fetchSheetsApi(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Orders'!A1:Z5000:clear`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } }
  ).catch(() => {});

  // Write updated rows
  const writeRes = await fetchSheetsApi(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Orders'!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        range: "'Orders'!A1",
        majorDimension: 'ROWS',
        values: allValues,
      }),
    }
  );

  if (!writeRes.ok) {
    const errData = await writeRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'Failed to update Orders in Google Sheet');
  }

  return {
    success: true,
    spreadsheetId,
    spreadsheetUrl,
    rowsUpdated: orderRows.length,
    message: `Successfully synchronized ${orderRows.length} orders to your Google Sheets document.`,
  };
}

export interface AnalyticsSyncInput {
  kpiStats: {
    totalOrders: number;
    grossRevenue: number;
    netRevenue: number;
    refundedRevenue: number;
    cancelledCount: number;
    totalSareesSold: number;
    aov: number;
    successfulCount: number;
  };
  productSales: Array<{
    title: string;
    productCode: string;
    fabric: string;
    color: string;
    price: number;
    unitsSold: number;
    revenue: number;
    rating: number;
    stockCount: number;
    stockStatus: string;
  }>;
  categoryBreakdown?: Array<{
    categoryName: string;
    unitsSold: number;
    revenue: number;
    orderCount: number;
    rank: number;
    revenueSharePct: number;
  }>;
  fabricBreakdown?: Array<[string, { units: number; revenue: number }]>;
  staffAttribution: Array<{
    name: string;
    username: string;
    handledCount: number;
    revenue: number;
  }>;
}

/**
 * Creates or updates the Analytics report tabs in the user's unified boutique Google Sheet
 */
export async function syncAnalyticsToGoogleSheet(
  data: AnalyticsSyncInput,
  boutiqueName: string,
  existingSpreadsheetId?: string
): Promise<SheetSyncResult> {
  const { spreadsheetId, spreadsheetUrl } = await getOrCreateMasterSpreadsheet(
    boutiqueName,
    existingSpreadsheetId
  );

  const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // Tab 1: Overview & KPIs
  const kpiValues = [
    ['Metric', 'Value', 'Notes / Description'],
    ['Last Report Generation', nowStr, 'Auto-synced from Boutique Console'],
    ['Total Orders', data.kpiStats.totalOrders, 'All orders recorded in store'],
    ['Net Realized Sales (₹)', `₹${data.kpiStats.netRevenue.toLocaleString('en-IN')}`, 'Finalized sales from Delivered & Closed orders only'],
    ['Gross Invoiced Total (₹)', `₹${data.kpiStats.grossRevenue.toLocaleString('en-IN')}`, 'Includes all reservations before refunds'],
    ['Refunded / Cancelled (₹)', `₹${data.kpiStats.refundedRevenue.toLocaleString('en-IN')}`, 'Deducted customer refunds and cancellations'],
    ['Average Order Value (AOV)', `₹${Math.round(data.kpiStats.aov).toLocaleString('en-IN')}`, 'Average ticket size per Delivered & Closed order'],
    ['Total Handloom Sarees Sold', data.kpiStats.totalSareesSold, 'Cumulative units from Delivered & Closed orders only'],
    ['Delivered & Closed Orders Count', data.kpiStats.successfulCount, 'Verified delivered and closed orders'],
    ['Cancelled / Rejected Count', data.kpiStats.cancelledCount, 'Refund initiated or completed'],
  ];

  // Tab 2: Product Performance
  const productHeader = [
    'Saree Name',
    'SKU Code',
    'Fabric Family',
    'Color Palette',
    'Price (₹)',
    'Units Sold',
    'Total Revenue (₹)',
    'Performance Rating (★)',
    'Stock Remaining',
    'Stock Status',
  ];
  const productRows = data.productSales.map((p) => [
    p.title,
    p.productCode,
    p.fabric,
    p.color,
    p.price,
    p.unitsSold,
    p.revenue,
    p.rating.toFixed(1),
    p.stockCount,
    p.stockStatus,
  ]);
  const productValues = [productHeader, ...productRows];

  // Tab 3: Category-Based Sales & Performance Ranking
  let tab3Values: any[][];
  if (data.categoryBreakdown && data.categoryBreakdown.length > 0) {
    const categoryHeader = [
      'Rank',
      'Store Category',
      'Units Sold (Pieces)',
      'Gross Revenue (₹)',
      'Orders Count',
      'Revenue Share (%)',
    ];
    const categoryRows = data.categoryBreakdown.map((cat) => [
      `#${cat.rank}`,
      cat.categoryName,
      cat.unitsSold,
      cat.revenue,
      cat.orderCount,
      `${cat.revenueSharePct}%`,
    ]);
    tab3Values = [categoryHeader, ...categoryRows];
  } else {
    const fabricHeader = ['Fabric Weave Category', 'Total Sarees Sold (Units)', 'Gross Revenue (₹)'];
    const fabricRows = (data.fabricBreakdown || []).map(([fab, metrics]) => [
      fab,
      metrics.units,
      metrics.revenue,
    ]);
    tab3Values = [fabricHeader, ...fabricRows];
  }

  // Tab 4: Staff Attribution
  const staffHeader = ['Staff Member Name', 'Username', 'Orders Handled', 'Total Order Value (₹)'];
  const staffRows = data.staffAttribution.map((s) => [
    s.name,
    `@${s.username}`,
    s.handledCount,
    s.revenue,
  ]);
  const staffValues = [staffHeader, ...staffRows];

  // Clear old values in tabs
  await Promise.all([
    fetchSheetsApi(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Overview & KPIs'!A1:Z500:clear`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    ).catch(() => {}),
    fetchSheetsApi(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Product Sales Tracker'!A1:Z1000:clear`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    ).catch(() => {}),
    fetchSheetsApi(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Fabric Breakdown'!A1:Z500:clear`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    ).catch(() => {}),
    fetchSheetsApi(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Staff Attribution'!A1:Z500:clear`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    ).catch(() => {}),
  ]);

  // Batch update all 4 analytics tabs
  const batchData = [
    { range: "'Overview & KPIs'!A1", values: kpiValues },
    { range: "'Product Sales Tracker'!A1", values: productValues },
    { range: "'Fabric Breakdown'!A1", values: tab3Values },
    { range: "'Staff Attribution'!A1", values: staffValues },
  ];

  const batchWriteRes = await fetchSheetsApi(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: batchData,
      }),
    }
  );

  if (!batchWriteRes.ok) {
    const errData = await batchWriteRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'Failed to update Analytics in Google Sheet');
  }

  return {
    success: true,
    spreadsheetId,
    spreadsheetUrl,
    rowsUpdated: productRows.length,
    message: `Successfully synchronized boutique analytics to your Google Sheets document.`,
  };
}

/**
 * Single Point of Storage: Syncs BOTH Orders and Sales Analytics to the Master Spreadsheet
 * in a single unified operation, keeping all 5 tabs completely up-to-date.
 */
export async function syncAllToGoogleSheet(
  orders: Order[],
  analyticsData: AnalyticsSyncInput,
  boutiqueName: string,
  existingSpreadsheetId?: string
): Promise<SheetSyncResult> {
  // 1. Sync orders tab
  const ordersResult = await syncOrdersToGoogleSheet(orders, boutiqueName, existingSpreadsheetId);

  // 2. Sync analytics tabs to the exact same master spreadsheet ID
  const analyticsResult = await syncAnalyticsToGoogleSheet(
    analyticsData,
    boutiqueName,
    ordersResult.spreadsheetId
  );

  return {
    success: true,
    spreadsheetId: ordersResult.spreadsheetId,
    spreadsheetUrl: ordersResult.spreadsheetUrl,
    rowsUpdated: ordersResult.rowsUpdated + analyticsResult.rowsUpdated,
    message: `Successfully synchronized all ${orders.length} orders and complete sales analytics to your Master Google Sheets document!`,
  };
}

/**
 * Synchronizes the Staff Order Assignments Ledger to the admin's Master Google Sheet
 * under the dedicated 'Staff Attribution' tab, capturing all assignments and live tracking logs.
 */
export async function syncStaffLedgerToGoogleSheet(
  orders: Order[],
  staffMembers: StaffMember[],
  boutiqueName: string,
  existingSpreadsheetId?: string
): Promise<SheetSyncResult> {
  const { spreadsheetId, spreadsheetUrl } = await getOrCreateMasterSpreadsheet(
    boutiqueName,
    existingSpreadsheetId
  );

  const ledgerHeader = [
    'Order Number',
    'Customer Name',
    'Customer Phone',
    'Order Status',
    'Total Amount (₹)',
    'Assigned Boutique Staff',
    'Staff Username',
    'Staff Role',
    'Courier Partner',
    'Tracking ID / Consignment',
    'Refund Status',
    'Refund UTR',
    'Cancellation Reason',
    'Last Action / Work Tracking Log',
  ];

  const ledgerRows = orders.length > 0
    ? orders.map((ord) => {
        const staff = staffMembers.find((s) => s.id === ord.assignedStaffId);
        const lastLog = ord.assignmentHistory && ord.assignmentHistory.length > 0
          ? ord.assignmentHistory[ord.assignmentHistory.length - 1]
          : null;
        const lastLogText = lastLog
          ? `[${new Date(lastLog.timestamp).toLocaleTimeString('en-IN')}] ${lastLog.staffName}: ${lastLog.action}${lastLog.note ? ` (${lastLog.note})` : ''}`
          : 'No work update logged yet';

        return [
          sanitizeSheetCell(ord.orderNumber),
          sanitizeSheetCell(ord.customer?.name || ''),
          sanitizeSheetCell(ord.customer?.phone || ''),
          sanitizeSheetCell(ord.status || 'Pending'),
          ord.totalAmount || 0,
          sanitizeSheetCell(ord.assignedStaffName || 'Unassigned'),
          sanitizeSheetCell(staff ? `@${staff.username}` : (ord.assignedStaffId === 'admin' ? '@owner' : '-')),
          sanitizeSheetCell(staff ? staff.role : (ord.assignedStaffId === 'admin' ? 'Store Owner' : '-')),
          sanitizeSheetCell(ord.shippingDetails?.courierName || '-'),
          sanitizeSheetCell(ord.shippingDetails?.trackingNumber || '-'),
          sanitizeSheetCell(ord.refundDetails?.refundStatus || '-'),
          sanitizeSheetCell(ord.refundDetails?.refundUtr || '-'),
          sanitizeSheetCell(ord.cancellationReason || '-'),
          sanitizeSheetCell(lastLogText),
        ];
      })
    : [
        [
          'TEMPLATE',
          'Demo Customer',
          '+919876543210',
          'Pending',
          0,
          'Unassigned',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          'Ledger initialized',
        ],
      ];

  const staffValues = [ledgerHeader, ...ledgerRows];

  // Clear and update Staff Attribution sheet tab
  await fetchSheetsApi(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Staff Attribution'!A1:Z5000:clear`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } }
  ).catch(() => {});

  const writeRes = await fetchSheetsApi(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Staff Attribution'!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        range: "'Staff Attribution'!A1",
        majorDimension: 'ROWS',
        values: staffValues,
      }),
    }
  );

  if (!writeRes.ok) {
    const errData = await writeRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'Failed to update Staff Attribution tab in Google Sheet');
  }

  return {
    success: true,
    spreadsheetId,
    spreadsheetUrl,
    rowsUpdated: ledgerRows.length,
    message: `Successfully synchronized ${ledgerRows.length} staff order assignment records to your Google Sheets document!`,
  };
}

