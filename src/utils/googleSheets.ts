import { Order, Product } from '../types/store';
import { getAccessToken, clearCachedToken } from './firebaseAuth';

export interface SheetSyncResult {
  success: boolean;
  spreadsheetId: string;
  spreadsheetUrl: string;
  rowsUpdated: number;
  message?: string;
}

const MASTER_TABS = [
  'Orders',
  'Overview & KPIs',
  'Product Sales Tracker',
  'Fabric Breakdown',
  'Staff Attribution',
];

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
 * Checks if a master spreadsheet exists, or creates one containing all 5 unified tabs
 * to maintain a single point of storage in the admin's Google Sheets.
 */
async function getOrCreateMasterSpreadsheet(
  boutiqueName: string,
  existingSpreadsheetId?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; token: string }> {
  let token = await getAccessToken(true, false);
  if (!token) {
    token = await getAccessToken(true, true);
  }
  if (!token) {
    throw new Error('Google authorization token not found.');
  }

  let spreadsheetId = existingSpreadsheetId;
  let needNewSpreadsheet = !spreadsheetId;

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
        needNewSpreadsheet = true;
      }
    } catch {
      needNewSpreadsheet = true;
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

  return { spreadsheetId: spreadsheetId!, spreadsheetUrl, token: finalToken };
}

/**
 * Creates or updates the Orders tab in the user's unified boutique Google Sheet
 */
export async function syncOrdersToGoogleSheet(
  orders: Order[],
  boutiqueName: string,
  existingSpreadsheetId?: string
): Promise<SheetSyncResult> {
  const { spreadsheetId, spreadsheetUrl } = await getOrCreateMasterSpreadsheet(
    boutiqueName,
    existingSpreadsheetId
  );

  const headers = [
    'Order Number',
    'Date Placed',
    'Customer Name',
    'Phone',
    'Email',
    'Shipping Address',
    'Status',
    'Total Amount (₹)',
    'Payment UTR',
    'Items Summary',
    'Courier Partner',
    'Tracking ID',
    'Refund UPI ID',
    'Refund Status',
    'Refund UTR',
    'Customer Comments / Instructions',
  ];

  const orderRows =
    orders.length > 0
      ? orders.map((o) => [
          o.orderNumber,
          new Date(o.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          o.customer.name,
          o.customer.phone,
          o.customer.email,
          `${o.customer.address}, ${o.customer.city}, ${o.customer.state} - ${o.customer.pincode}`,
          o.status,
          o.totalAmount,
          o.upiTransactionId || 'Pending Verification',
          o.items
            .map(
              (item) =>
                `${item.product.title} (${item.product.fabric} - ${item.product.color}) x${item.quantity}`
            )
            .join('; '),
          o.shippingDetails?.courierName || 'Unassigned',
          o.shippingDetails?.trackingNumber || '',
          o.refundDetails?.refundUpiId || o.refundDetails?.refundUpiPhone || '',
          o.refundDetails?.refundStatus || '',
          o.refundDetails?.refundUtr || '',
          o.notes || '',
        ])
      : [
          [
            'TEMPLATE',
            new Date().toLocaleDateString('en-IN'),
            'Store Ready - No Orders Placed Yet',
            '-',
            '-',
            '-',
            'Ready',
            0,
            '-',
            'Columns configured for incoming orders',
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
  fabricBreakdown: Array<[string, { units: number; revenue: number }]>;
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
    ['Net Confirmed Sales (₹)', `₹${data.kpiStats.netRevenue.toLocaleString('en-IN')}`, 'Confirmed, Shipped & Delivered orders'],
    ['Gross Invoiced Total (₹)', `₹${data.kpiStats.grossRevenue.toLocaleString('en-IN')}`, 'Includes all reservations before refunds'],
    ['Refunded / Cancelled (₹)', `₹${data.kpiStats.refundedRevenue.toLocaleString('en-IN')}`, 'Processed & pending customer refunds'],
    ['Average Order Value (AOV)', `₹${Math.round(data.kpiStats.aov).toLocaleString('en-IN')}`, 'Average ticket size per successful order'],
    ['Total Handloom Sarees Sold', data.kpiStats.totalSareesSold, 'Cumulative units delivered or dispatched'],
    ['Completed Orders Count', data.kpiStats.successfulCount, 'Verified and fulfilled'],
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

  // Tab 3: Fabric Breakdown
  const fabricHeader = ['Fabric Weave Category', 'Total Sarees Sold (Units)', 'Gross Revenue (₹)'];
  const fabricRows = data.fabricBreakdown.map(([fab, metrics]) => [
    fab,
    metrics.units,
    metrics.revenue,
  ]);
  const fabricValues = [fabricHeader, ...fabricRows];

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
    { range: "'Fabric Breakdown'!A1", values: fabricValues },
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

