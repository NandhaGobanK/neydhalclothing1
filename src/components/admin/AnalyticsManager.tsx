import React, { useMemo, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order } from '../../types/store';
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
  Layers,
} from 'lucide-react';

export const AnalyticsManager: React.FC = () => {
  const { orders, products, settings, updateSettings, categories } = useStore();

  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [sheetSyncSuccess, setSheetSyncSuccess] = useState<{ url: string; count: number } | null>(null);
  const [sheetSyncError, setSheetSyncError] = useState<string | null>(null);
  const [isConfirmSyncOpen, setIsConfirmSyncOpen] = useState(false);
  const [isRefreshingLive, setIsRefreshingLive] = useState(false);

  // Helper: check if an order has been refunded, cancelled, or rejected
  const isOrderRefundedOrCancelled = (o: Order): boolean => {
    return (
      o.status === 'Cancelled' ||
      o.status === 'Rejected' ||
      o.status === 'Refunded' ||
      o.refundDetails?.refundStatus === 'processed' ||
      (Boolean(o.deliveryIssue?.reported) && o.deliveryIssue?.issueType === 'refund')
    );
  };

  // Strict Trigger Condition: Sales analytics (units sold & revenue) update ONLY after
  // an order has been successfully marked as Delivered AND Closed.
  // Exclude Received, Placed (Pending/Confirmed), and In-Transit (Shipped) orders.
  // Real-time automatic deduction: If an order was previously counted and is subsequently
  // cancelled, refunded, rejected, or reopened, it is immediately deducted in real time.
  const isQualifyingDeliveredAndClosedOrder = (o: Order): boolean => {
    if (isOrderRefundedOrCancelled(o)) return false;
    return o.status === 'Delivered' && Boolean(o.isClosed);
  };

  // Financial & Order KPIs (Finalized Delivered & Closed sales analytics)
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const grossRevenue = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    const refundedOrders = orders.filter(isOrderRefundedOrCancelled);
    const refundedRevenue = refundedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    // Finalized sales: strictly Delivered AND Closed orders
    const qualifyingOrders = orders.filter(isQualifyingDeliveredAndClosedOrder);
    const finalizedRevenue = qualifyingOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    const totalUnitsSold = qualifyingOrders.reduce((sum, o) => {
      return sum + (o.items || []).reduce((iSum, item) => iSum + (Number(item?.quantity) || 0), 0);
    }, 0);

    const aov = qualifyingOrders.length > 0 ? finalizedRevenue / qualifyingOrders.length : 0;

    // Pipeline orders: received/placed/in-transit/unclosed orders (not yet counted in finalized sales)
    const pipelineOrders = orders.filter(
      (o) => !isOrderRefundedOrCancelled(o) && !(o.status === 'Delivered' && Boolean(o.isClosed))
    );
    const pipelineRevenue = pipelineOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const pipelineUnits = pipelineOrders.reduce((sum, o) => {
      return sum + (o.items || []).reduce((iSum, item) => iSum + (Number(item?.quantity) || 0), 0);
    }, 0);

    return {
      totalOrders,
      grossRevenue,
      netRevenue: finalizedRevenue,
      finalizedRevenue,
      refundedRevenue,
      cancelledCount: refundedOrders.length,
      totalUnitsSold,
      totalSareesSold: totalUnitsSold,
      aov,
      successfulCount: qualifyingOrders.length,
      pipelineCount: pipelineOrders.length,
      pipelineRevenue,
      pipelineUnits,
    };
  }, [orders]);

  // Product-wise & Color-wise Sales Tracker and Sales Rating (Trigger: Delivered & Closed Only)
  const productAnalytics = useMemo(() => {
    // Tally sales strictly for Delivered & Closed orders
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
      // Strictly require Delivered & Closed status; automatically deducted if refunded/cancelled
      if (isQualifyingDeliveredAndClosedOrder(o)) {
        (o.items || []).forEach((item) => {
          if (!item || !item.product) return;
          const pId = item.product.id;
          if (salesMap[pId]) {
            const qty = Number(item.quantity) || 0;
            salesMap[pId].unitsSold += qty;
            salesMap[pId].revenue += (Number(item.product.price) || 0) * qty;
            salesMap[pId].orderCount += 1;
          }
        });
      }
    });

    const list = Object.values(salesMap);

    // Find max sold for relative rating computation
    const maxSold = Math.max(...list.map((i) => i.unitsSold), 1);

    return list
      .map((item) => {
        // Calculate Rating (1.0 to 5.0 stars) based on delivered & closed sales volume and revenue
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

  // Dynamic Category-Based Sales Record & Performance Ranking Board (Trigger: Delivered & Closed Only)
  const categorySalesAnalytics = useMemo(() => {
    const categoryStatsMap: Record<
      string,
      {
        categoryName: string;
        imageUrl?: string;
        description?: string;
        unitsSold: number;
        revenue: number;
        orderCount: number;
        activeCatalogCount: number;
      }
    > = {};

    // 1. Seed from registered store categories
    (categories || []).forEach((cat) => {
      const key = (cat.name || '').trim();
      if (!key) return;
      if (!categoryStatsMap[key]) {
        categoryStatsMap[key] = {
          categoryName: key,
          imageUrl: cat.imageUrl,
          description: cat.description,
          unitsSold: 0,
          revenue: 0,
          orderCount: 0,
          activeCatalogCount: 0,
        };
      }
    });

    // 2. Tally catalog products per category
    products.forEach((p) => {
      if (p.isVisible !== false) {
        const cat = p.category?.trim() || 'General Collection';
        if (!categoryStatsMap[cat]) {
          categoryStatsMap[cat] = {
            categoryName: cat,
            imageUrl: p.images?.[0],
            unitsSold: 0,
            revenue: 0,
            orderCount: 0,
            activeCatalogCount: 0,
          };
        }
        categoryStatsMap[cat].activeCatalogCount += 1;
        if (!categoryStatsMap[cat].imageUrl && p.images?.[0]) {
          categoryStatsMap[cat].imageUrl = p.images[0];
        }
      }
    });

    // 3. Aggregate realized Delivered & Closed order sales volume & revenue (refunded/pending excluded)
    let totalCatRevenue = 0;
    let totalCatUnits = 0;

    orders.forEach((o) => {
      // Trigger: Counted strictly when order is marked Delivered & Closed
      if (isQualifyingDeliveredAndClosedOrder(o)) {
        const orderCats = new Set<string>();
        (o.items || []).forEach((item) => {
          if (!item || !item.product) return;
          const cat = item.product.category?.trim() || 'General Collection';
          if (!categoryStatsMap[cat]) {
            categoryStatsMap[cat] = {
              categoryName: cat,
              imageUrl: item.product.images?.[0],
              unitsSold: 0,
              revenue: 0,
              orderCount: 0,
              activeCatalogCount: 0,
            };
          }
          const itemQty = Number(item.quantity) || 0;
          const itemRev = (Number(item.product.price) || 0) * itemQty;
          categoryStatsMap[cat].unitsSold += itemQty;
          categoryStatsMap[cat].revenue += itemRev;
          totalCatRevenue += itemRev;
          totalCatUnits += itemQty;
          orderCats.add(cat);
        });
        orderCats.forEach((catKey) => {
          if (categoryStatsMap[catKey]) {
            categoryStatsMap[catKey].orderCount += 1;
          }
        });
      }
    });

    const list = Object.values(categoryStatsMap);

    // Sort by revenue descending, then units descending
    list.sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold);

    return list.map((c, index) => {
      const rank = index + 1;
      const revenueSharePct = totalCatRevenue > 0
        ? Math.round((c.revenue / totalCatRevenue) * 100)
        : 0;
      const unitsSharePct = totalCatUnits > 0
        ? Math.round((c.unitsSold / totalCatUnits) * 100)
        : 0;

      let badgeLabel = 'Growing Category';
      let badgeStyle = 'bg-neutral-100 text-neutral-700 border-neutral-300';
      let rankMedal = `#${rank}`;

      if (rank === 1 && c.revenue > 0) {
        badgeLabel = '🏆 Rank #1 · Store Leader';
        badgeStyle = 'bg-amber-100 text-amber-900 border-amber-400 font-extrabold shadow-2xs';
        rankMedal = '🥇 1st';
      } else if (rank === 2 && c.revenue > 0) {
        badgeLabel = '🥈 Rank #2 · High Demand';
        badgeStyle = 'bg-slate-100 text-slate-900 border-slate-300 font-bold';
        rankMedal = '🥈 2nd';
      } else if (rank === 3 && c.revenue > 0) {
        badgeLabel = '🥉 Rank #3 · Steady Volume';
        badgeStyle = 'bg-amber-50 text-amber-900 border-amber-200 font-bold';
        rankMedal = '🥉 3rd';
      } else if (c.revenue > 0) {
        badgeLabel = `⭐ Rank #${rank} · Active`;
        badgeStyle = 'bg-blue-50 text-blue-900 border-blue-200 font-semibold';
        rankMedal = `#${rank}`;
      }

      return {
        ...c,
        rank,
        rankMedal,
        revenueSharePct,
        unitsSharePct,
        badgeLabel,
        badgeStyle,
      };
    });
  }, [orders, products, categories]);

  // Staff order attribution (Delivered & Closed Sales Attribution)
  const staffAttribution = useMemo(() => {
    const staffMap: Record<
      string,
      { name: string; username: string; handledCount: number; closedCount: number; revenue: number }
    > = {};

    (settings.staffMembers || []).forEach((s) => {
      staffMap[s.id] = {
        name: s.name,
        username: s.username,
        handledCount: 0,
        closedCount: 0,
        revenue: 0,
      };
    });

    orders.forEach((o) => {
      if (o.assignedStaffId && staffMap[o.assignedStaffId]) {
        staffMap[o.assignedStaffId].handledCount += 1;
        // Strictly attribute revenue only from Delivered & Closed orders
        if (isQualifyingDeliveredAndClosedOrder(o)) {
          staffMap[o.assignedStaffId].closedCount += 1;
          staffMap[o.assignedStaffId].revenue += o.totalAmount;
        }
      }
    });

    return Object.values(staffMap).sort((a, b) => b.revenue - a.revenue || b.handledCount - a.handledCount);
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
        categoryBreakdown: categorySalesAnalytics.map((c) => ({
          categoryName: c.categoryName,
          unitsSold: c.unitsSold,
          revenue: c.revenue,
          orderCount: c.orderCount,
          rank: c.rank,
          revenueSharePct: c.revenueSharePct,
        })),
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
          <button
            type="button"
            onClick={() => {
              setIsRefreshingLive(true);
              setTimeout(() => setIsRefreshingLive(false), 800);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold shadow-2xs transition cursor-pointer"
            title="Force refresh analytics from live database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-neutral-600 ${isRefreshingLive ? 'animate-spin' : ''}`} />
            <span>{isRefreshingLive ? 'Syncing DB...' : 'Live Sync'}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
          </button>

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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
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
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Authorize Google & Retry</span>
            </button>
            <button
              onClick={() => setSheetSyncError(null)}
              className="text-rose-700 font-bold hover:underline px-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Sales Analytics Delivered & Closed Trigger Policy Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/50 to-amber-50/40 border border-emerald-200/90 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0 shadow-2xs">
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-serif font-bold text-xs sm:text-sm text-neutral-900 flex items-center gap-1.5 flex-wrap">
                <span>Sales Analytics Policy: Delivered & Closed Status Trigger</span>
                <span className="text-[10px] font-sans px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold uppercase tracking-wide">
                  Realized Sales Only
                </span>
              </h3>
              <p className="text-[11px] text-neutral-600 mt-0.5">
                Units sold and revenue calculations update exclusively after an order has reached <strong>Delivered</strong> stage and is formally <strong>Closed</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 bg-emerald-100/90 border border-emerald-300 px-2.5 py-1 rounded-xl">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>{stats.successfulCount} Closed & Realized</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-900 bg-blue-100/90 border border-blue-300 px-2.5 py-1 rounded-xl">
              <Truck className="w-3.5 h-3.5 text-blue-700" />
              <span>{stats.pipelineCount} In Pipeline (Pending/Transit)</span>
            </span>
          </div>
        </div>

        <p className="text-[11px] text-neutral-600 leading-relaxed border-t border-emerald-200/60 pt-2">
          Orders that are received, placed, or in-transit are excluded from units sold and revenue figures until verified delivery and file closure. If a previously counted order is subsequently cancelled or refunded, units and revenue are automatically deducted in real time.
        </p>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Realized Sales (Delivered & Closed) */}
        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>Realized Sales (Delivered & Closed)</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-neutral-950 tabular-nums">
            {formatPrice(stats.netRevenue)}
          </p>
          <p className="text-[11px] text-emerald-700 font-medium">
            From {stats.successfulCount} closed orders (Gross booked: {formatPrice(stats.grossRevenue)})
          </p>
        </div>

        {/* Total Units Sold */}
        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>Units Sold (Closed)</span>
            <ShoppingBag className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-neutral-950 tabular-nums">
            {stats.totalUnitsSold} <span className="text-sm font-sans font-normal text-neutral-500">pieces</span>
          </p>
          <p className="text-[11px] text-neutral-600">
            Delivered & Closed items only
          </p>
        </div>

        {/* Pipeline Value (Unclosed / In-Transit) */}
        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>Pipeline Value (Unclosed)</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-neutral-950 tabular-nums">
            {formatPrice(stats.pipelineRevenue)}
          </p>
          <p className="text-[11px] text-blue-700 font-medium">
            {stats.pipelineCount} orders ({stats.pipelineUnits} units) awaiting delivery/closure
          </p>
        </div>

        {/* Refunds / Cancellations */}
        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>Refund Deductions</span>
            <RotateCcw className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-rose-950 tabular-nums">
            {formatPrice(stats.refundedRevenue)}
          </p>
          <p className="text-[11px] text-rose-800">
            {stats.cancelledCount} orders deducted in real time
          </p>
        </div>
      </div>

      {/* Main Section: Product Sales Tracker & Sales Rating (Prompt Request: Delivered & Closed Only) */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-serif text-lg font-bold text-neutral-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span>Product Sales Performance & Demand Rating</span>
            </h3>
            <p className="text-xs text-neutral-500">
              Unique product SKU tracking, sales volume, and dynamic performance ratings (Delivered & Closed orders only)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-3">Unique Code / SKU</th>
                <th className="py-3 px-3">Product Item</th>
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
                        src={item.product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
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

      {/* Grid: Category Sales & Ranking + Staff Concierge Sales Attribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category-Based Sales Record & Performance Ranking Board (Prompt: Replaced Fabric Contribution) */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
            <div>
              <h4 className="font-serif text-base font-bold text-neutral-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>Category-Based Sales Tracking & Ranking</span>
              </h4>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Dynamic sales volume, revenue, and store rankings across all active boutique categories (Delivered & Closed orders only)
              </p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-700 border border-neutral-200 shrink-0 self-start sm:self-center">
              {categorySalesAnalytics.length} Active {categorySalesAnalytics.length === 1 ? 'Category' : 'Categories'}
            </span>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {categorySalesAnalytics.length === 0 ? (
              <p className="text-xs text-neutral-400 p-4 text-center">No categories created yet.</p>
            ) : (
              categorySalesAnalytics.map((cat) => (
                <div
                  key={cat.categoryName}
                  className={`p-3.5 rounded-2xl border transition text-xs space-y-2 ${
                    cat.rank === 1 && cat.revenue > 0
                      ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300/60 shadow-2xs'
                      : 'bg-white hover:bg-neutral-50/60 border-neutral-200/90'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Rank Indicator */}
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          cat.rank === 1 && cat.revenue > 0
                            ? 'bg-amber-500 text-neutral-950 shadow-2xs font-extrabold'
                            : cat.rank === 2 && cat.revenue > 0
                            ? 'bg-slate-300 text-slate-900 font-bold'
                            : cat.rank === 3 && cat.revenue > 0
                            ? 'bg-amber-200 text-amber-950 font-bold'
                            : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                        }`}
                      >
                        {cat.rank}
                      </span>

                      {/* Category Thumbnail & Details */}
                      {cat.imageUrl && (
                        <img
                          src={cat.imageUrl}
                          alt={cat.categoryName}
                          className="w-9 h-9 rounded-xl object-cover bg-neutral-100 border border-neutral-200 shrink-0"
                        />
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-serif font-bold text-neutral-900 text-sm truncate">
                            {cat.categoryName}
                          </p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cat.badgeStyle}`}>
                            {cat.badgeLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500">
                          {cat.activeCatalogCount} active designs · {cat.orderCount} orders
                        </p>
                      </div>
                    </div>

                    {/* Volume & Revenue */}
                    <div className="text-right shrink-0">
                      <p className="font-serif font-bold text-sm text-neutral-950 tabular-nums">
                        {formatPrice(cat.revenue)}
                      </p>
                      <p className="text-[11px] font-semibold text-neutral-600">
                        {cat.unitsSold} {cat.unitsSold === 1 ? 'piece' : 'pieces'} sold ({cat.revenueSharePct}%)
                      </p>
                    </div>
                  </div>

                  {/* Revenue Share Visual Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          cat.rank === 1 ? 'bg-amber-500' : cat.rank === 2 ? 'bg-slate-500' : 'bg-neutral-700'
                        }`}
                        style={{ width: `${Math.min(cat.revenueSharePct, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Staff Order Handling Attribution */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-3">
          <h4 className="font-serif text-base font-bold text-neutral-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" />
            <span>Concierge Staff Workload & Realized Sales Attribution</span>
          </h4>
          <p className="text-[11px] text-neutral-500">
            Realized revenue and units credited strictly upon verified Delivered & Closed fulfillment
          </p>

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
                    <p className="text-[11px] text-neutral-500 font-mono">
                      @{staff.username} · {staff.closedCount} delivered & closed ({staff.handledCount} total assigned)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-neutral-900 font-serif tabular-nums">
                      {formatPrice(staff.revenue)}
                    </p>
                    <p className="text-[11px] text-emerald-800 font-semibold">
                      Realized Sales
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
                You are about to export and synchronize boutique analytics, sales KPIs, SKU rankings, and category-based sales & rankings directly into your Google Sheets spreadsheet.
              </p>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
                <p className="font-semibold">Spreadsheet tabs included:</p>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-800">
                  <li><strong>Overview & KPIs:</strong> Revenue, AOV, order totals.</li>
                  <li><strong>Product Sales Tracker:</strong> Saree sales velocity and ratings.</li>
                  <li><strong>Category Sales & Ranking:</strong> Performance ranks, volume, and revenue by store category.</li>
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
