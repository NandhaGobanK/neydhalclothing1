import React, { useMemo, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { formatPrice } from '../../utils/upi';
import { syncAnalyticsToGoogleSheet } from '../../utils/googleSheets';
import { getAccessToken } from '../../utils/firebaseAuth';
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Star,
  Users,
  Award,
  BarChart3,
  CheckCircle2,
  XCircle,
  Truck,
  RotateCcw,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Check,
  X,
  AlertOctagon,
} from 'lucide-react';

export const AnalyticsManager: React.FC = () => {
  const { orders, products, settings, updateSettings } = useStore();

  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [sheetSyncSuccess, setSheetSyncSuccess] = useState<{ url: string; count: number } | null>(null);
  const [sheetSyncError, setSheetSyncError] = useState<string | null>(null);
  const [isConfirmSyncOpen, setIsConfirmSyncOpen] = useState(false);

  // Financial & Order KPIs
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const grossRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

    const successfulOrders = orders.filter(
      (o) => o.status === 'Confirmed' || o.status === 'Shipped' || o.status === 'Delivered'
    );
    const netRevenue = successfulOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    const cancelledOrders = orders.filter(
      (o) => o.status === 'Cancelled' || o.status === 'Rejected'
    );
    const refundedRevenue = cancelledOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    const totalSareesSold = orders.reduce((sum, o) => {
      if (o.status !== 'Cancelled' && o.status !== 'Rejected') {
        return sum + o.items.reduce((iSum, item) => iSum + item.quantity, 0);
      }
      return sum;
    }, 0);

    const aov = successfulOrders.length > 0 ? netRevenue / successfulOrders.length : 0;

    return {
      totalOrders,
      grossRevenue,
      netRevenue,
      refundedRevenue,
      cancelledCount: cancelledOrders.length,
      totalSareesSold,
      aov,
      successfulCount: successfulOrders.length,
    };
  }, [orders]);

  // Product-wise & Color-wise Sales Tracker and Sales Rating
  const productAnalytics = useMemo(() => {
    // Tally sales by product and color
    const salesMap: Record<
      string,
      {
        product: typeof products[0];
        unitsSold: number;
        revenue: number;
        orderCount: number;
      }
    > = {};

    products
      .filter((p) => p.isVisible !== false)
      .forEach((p) => {
        salesMap[p.id] = {
          product: p,
          unitsSold: 0,
          revenue: 0,
          orderCount: 0,
        };
      });

    orders.forEach((o) => {
      if (o.status !== 'Cancelled' && o.status !== 'Rejected') {
        o.items.forEach((item) => {
          if (salesMap[item.product.id]) {
            salesMap[item.product.id].unitsSold += item.quantity;
            salesMap[item.product.id].revenue += item.product.price * item.quantity;
            salesMap[item.product.id].orderCount += 1;
          }
        });
      }
    });

    const list = Object.values(salesMap);

    // Find max sold for relative rating computation
    const maxSold = Math.max(...list.map((i) => i.unitsSold), 1);

    return list
      .map((item) => {
        // Calculate Rating (1.0 to 5.0 stars) based on sales volume and revenue
        const salesScore = item.unitsSold / maxSold;
        let rating = 1.0 + salesScore * 4.0;
        rating = Math.round(rating * 10) / 10;
        if (item.unitsSold === 0) rating = 1.0;

        let ratingBadge = 'Low Volume';
        let ratingColor = 'text-neutral-500 bg-neutral-100';

        if (rating >= 4.5) {
          ratingBadge = '★★★★★ 5.0 Best Seller';
          ratingColor = 'text-amber-800 bg-amber-100 border-amber-300';
        } else if (rating >= 3.8) {
          ratingBadge = '★★★★☆ 4.0 High Demand';
          ratingColor = 'text-emerald-800 bg-emerald-100 border-emerald-300';
        } else if (rating >= 2.5) {
          ratingBadge = '★★★☆☆ 3.0 Steady Mover';
          ratingColor = 'text-blue-800 bg-blue-100 border-blue-300';
        } else if (rating >= 1.5) {
          ratingBadge = '★★☆☆☆ 2.0 Moderate';
          ratingColor = 'text-purple-800 bg-purple-100 border-purple-300';
        }

        return {
          ...item,
          rating,
          ratingBadge,
          ratingColor,
        };
      })
      .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue);
  }, [products, orders]);

  // Fabric breakdown
  const fabricBreakdown = useMemo(() => {
    const map: Record<string, { units: number; revenue: number }> = {};
    orders.forEach((o) => {
      if (o.status !== 'Cancelled' && o.status !== 'Rejected') {
        o.items.forEach((item) => {
          const f = item.product.fabric || 'Other';
          if (!map[f]) map[f] = { units: 0, revenue: 0 };
          map[f].units += item.quantity;
          map[f].revenue += item.product.price * item.quantity;
        });
      }
    });
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [orders]);

  // Staff order attribution
  const staffAttribution = useMemo(() => {
    const staffMap: Record<
      string,
      { name: string; username: string; handledCount: number; revenue: number }
    > = {};

    (settings.staffMembers || []).forEach((s) => {
      staffMap[s.id] = {
        name: s.name,
        username: s.username,
        handledCount: 0,
        revenue: 0,
      };
    });

    orders.forEach((o) => {
      if (o.assignedStaffId && staffMap[o.assignedStaffId]) {
        staffMap[o.assignedStaffId].handledCount += 1;
        if (o.status !== 'Cancelled' && o.status !== 'Rejected') {
          staffMap[o.assignedStaffId].revenue += o.totalAmount;
        }
      }
    });

    return Object.values(staffMap).sort((a, b) => b.handledCount - a.handledCount);
  }, [orders, settings.staffMembers]);

  const handleConfirmSyncSheets = async () => {
    setIsConfirmSyncOpen(false);
    setIsSyncingSheets(true);
    setSheetSyncError(null);
    setSheetSyncSuccess(null);

    try {
      const payload = {
        kpiStats: stats,
        productSales: productAnalytics.map((p) => ({
          title: p.product.title,
          productCode: p.product.productCode,
          fabric: p.product.fabric || 'Unspecified',
          color: p.product.color,
          price: p.product.price,
          unitsSold: p.unitsSold,
          revenue: p.revenue,
          rating: p.rating,
          stockCount: p.product.stockCount,
          stockStatus: p.product.stockStatus,
        })),
        fabricBreakdown,
        staffAttribution,
      };

      // Single point of storage: reuse master spreadsheet if created from orders
      const masterSpreadsheetId =
        settings.ordersSpreadsheetId || settings.analyticsSpreadsheetId;

      const res = await syncAnalyticsToGoogleSheet(
        payload,
        settings.boutiqueName,
        masterSpreadsheetId
      );

      if (res.success) {
        setSheetSyncSuccess({ url: res.spreadsheetUrl, count: res.rowsUpdated });
        updateSettings({
          ordersSpreadsheetId: res.spreadsheetId,
          ordersSpreadsheetUrl: res.spreadsheetUrl,
          analyticsSpreadsheetId: res.spreadsheetId,
          analyticsSpreadsheetUrl: res.spreadsheetUrl,
        });
      }
    } catch (err: any) {
      console.error('Failed to sync analytics to Google Sheets:', err);
      setSheetSyncError(err.message || 'Failed to synchronize analytics with Google Sheets.');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleAuthorizeAndSync = async () => {
    setIsSyncingSheets(true);
    setSheetSyncError(null);
    try {
      await getAccessToken(true, true);
      await handleConfirmSyncSheets();
    } catch (err: any) {
      setSheetSyncError(err?.message || 'Google authorization failed. Please try again.');
      setIsSyncingSheets(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-amber-600" />
            <span>Sales Analytics & Product Performance</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Track revenue, product sales velocity, SKU ratings, and concierge fulfillment workloads
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {settings.analyticsSpreadsheetUrl && (
            <a
              href={settings.analyticsSpreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold shadow-xs transition"
              title="Open Google Sheet in new tab"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Open Analytics Sheet</span>
              <ExternalLink className="w-3 h-3 text-emerald-600" />
            </a>
          )}

          <button
            onClick={() => setIsConfirmSyncOpen(true)}
            disabled={isSyncingSheets}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
          >
            {isSyncingSheets ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
            )}
            <span>{isSyncingSheets ? 'Syncing...' : 'Sync with Google Sheets'}</span>
          </button>
        </div>
      </div>

      {/* Google Sheets Sync Alert Notifications */}
      {sheetSyncSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Successfully synchronized boutique KPIs, product performance, and sales breakdown to Google Sheets!
            </span>
          </div>
          <a
            href={sheetSyncSuccess.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-bold text-emerald-700 underline hover:text-emerald-900"
          >
            <span>Open Sheet</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {sheetSyncError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{sheetSyncError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAuthorizeAndSync}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition shadow-xs flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Authorize Google & Retry</span>
            </button>
            <button
              onClick={() => setSheetSyncError(null)}
              className="text-rose-700 font-bold hover:underline px-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Sales */}
        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>Net Confirmed Sales</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-neutral-950 tabular-nums">
            {formatPrice(stats.netRevenue)}
          </p>
          <p className="text-[11px] text-emerald-700 font-medium">
            From {stats.successfulCount} active orders
          </p>
        </div>

        {/* Total Sarees Sold */}
        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>Handlooms Sold</span>
            <ShoppingBag className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-neutral-950 tabular-nums">
            {stats.totalSareesSold} <span className="text-sm font-sans font-normal text-neutral-500">pieces</span>
          </p>
          <p className="text-[11px] text-neutral-600">
            Across {products.length} catalog designs
          </p>
        </div>

        {/* Average Order Value */}
        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>Average Order Value</span>
            <Award className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-neutral-950 tabular-nums">
            {formatPrice(stats.aov)}
          </p>
          <p className="text-[11px] text-neutral-600">Per verified checkout</p>
        </div>

        {/* Refunds / Cancellations */}
        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>Refunded Orders</span>
            <RotateCcw className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-rose-950 tabular-nums">
            {formatPrice(stats.refundedRevenue)}
          </p>
          <p className="text-[11px] text-rose-800">
            {stats.cancelledCount} orders cancelled / rejected
          </p>
        </div>
      </div>

      {/* Main Section: Product Sales Tracker & Sales Rating (Prompt Request) */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-serif text-lg font-bold text-neutral-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span>Product Sales Performance & Demand Rating</span>
            </h3>
            <p className="text-xs text-neutral-500">
              Unique product & color SKU tracking, sales volume, and dynamic performance ratings
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-3">Unique Code / SKU</th>
                <th className="py-3 px-3">Saree Product</th>
                <th className="py-3 px-3">Fabric & Color</th>
                <th className="py-3 px-3 text-right">Units Sold</th>
                <th className="py-3 px-3 text-right">Revenue</th>
                <th className="py-3 px-3">Stock Left</th>
                <th className="py-3 px-3 text-right">Sales Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {productAnalytics.map((item, idx) => (
                <tr key={item.product.id} className="hover:bg-neutral-50/60 transition">
                  {/* SKU Code */}
                  <td className="py-3 px-3">
                    <span className="font-mono text-xs font-bold text-rose-950 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      {item.product.productCode}
                    </span>
                  </td>

                  {/* Saree Info */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={item.product.images[0] || '/src/assets/images/hero_saree_atelier_1791651761357.jpg'}
                        alt={item.product.title}
                        className="w-9 h-11 object-cover rounded-md bg-neutral-100 border border-neutral-200 shrink-0"
                      />
                      <div className="min-w-0 max-w-xs">
                        <p className="font-serif font-bold text-xs text-neutral-900 truncate">
                          {item.product.title}
                        </p>
                        <p className="text-[11px] text-neutral-500 tabular-nums">
                          {formatPrice(item.product.price)}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Fabric & Color */}
                  <td className="py-3 px-3">
                    <p className="font-semibold text-neutral-800">{item.product.fabric}</p>
                    <p className="text-neutral-500 text-[11px]">{item.product.color}</p>
                  </td>

                  {/* Units Sold */}
                  <td className="py-3 px-3 text-right font-bold text-sm text-neutral-900 tabular-nums">
                    {item.unitsSold}
                  </td>

                  {/* Total Revenue */}
                  <td className="py-3 px-3 text-right font-bold text-neutral-900 tabular-nums font-serif">
                    {formatPrice(item.revenue)}
                  </td>

                  {/* Stock Left */}
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.product.stockStatus === 'in_stock'
                          ? 'bg-emerald-50 text-emerald-800'
                          : item.product.stockStatus === 'limited'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-rose-50 text-rose-800'
                      }`}
                    >
                      {item.product.stockCount} left
                    </span>
                  </td>

                  {/* Product Sales Rating (Prompt Request) */}
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${item.ratingColor}`}
                    >
                      {item.ratingBadge}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: Fabric Breakdown + Staff Concierge Sales Attribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fabric Breakdown */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-3">
          <h4 className="font-serif text-base font-bold text-neutral-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-600" />
            <span>Fabric Category Contribution</span>
          </h4>

          <div className="space-y-2.5 pt-1">
            {fabricBreakdown.map(([fabric, data]) => {
              const pct = stats.netRevenue > 0 ? Math.round((data.revenue / stats.netRevenue) * 100) : 0;
              return (
                <div key={fabric} className="text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-neutral-800">{fabric}</span>
                    <span className="font-bold tabular-nums text-neutral-900">
                      {formatPrice(data.revenue)} ({data.units} pcs · {pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Staff Order Handling Attribution */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-3">
          <h4 className="font-serif text-base font-bold text-neutral-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" />
            <span>Concierge Staff Workload & Order Attribution</span>
          </h4>

          <div className="space-y-2.5 pt-1">
            {staffAttribution.length === 0 ? (
              <p className="text-xs text-neutral-400">No staff members created yet.</p>
            ) : (
              staffAttribution.map((staff) => (
                <div
                  key={staff.username}
                  className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-neutral-900">{staff.name}</p>
                    <p className="text-[11px] text-neutral-500 font-mono">@{staff.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-neutral-900">{staff.handledCount} orders handled</p>
                    <p className="text-[11px] text-emerald-800 font-medium">
                      {formatPrice(staff.revenue)} gross
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Google Sheets Sync Confirmation Dialog */}
      {isConfirmSyncOpen && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-emerald-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Sync Boutique Analytics to Google Sheets
                  </h3>
                  <p className="text-[11px] text-emerald-300">
                    Export multi-tab performance reporting to Google Drive
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmSyncOpen(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-neutral-700">
              <p className="leading-relaxed">
                You are about to export and synchronize boutique analytics, sales KPIs, SKU rankings, and fabric category statistics directly into your Google Sheets spreadsheet.
              </p>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
                <p className="font-semibold">Spreadsheet tabs included:</p>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-800">
                  <li><strong>Overview & KPIs:</strong> Revenue, AOV, order totals.</li>
                  <li><strong>Product Sales Tracker:</strong> Saree sales velocity and ratings.</li>
                  <li><strong>Fabric Breakdown:</strong> Kanjivaram, Banarasi, and Chanderi splits.</li>
                  <li><strong>Staff Attribution:</strong> Orders and gross workload per staff.</li>
                </ul>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsConfirmSyncOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSyncSheets}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Confirm & Sync</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
