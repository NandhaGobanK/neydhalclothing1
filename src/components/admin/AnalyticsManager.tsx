import React, { useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { formatPrice } from '../../utils/upi';
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
} from 'lucide-react';

export const AnalyticsManager: React.FC = () => {
  const { orders, products, settings } = useStore();

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

    products.forEach((p) => {
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
          const f = item.product.fabric;
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-amber-600" />
          <span>Sales Analytics & Product Performance</span>
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Track revenue, product sales velocity, SKU ratings, and concierge fulfillment workloads
        </p>
      </div>

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
    </div>
  );
};
