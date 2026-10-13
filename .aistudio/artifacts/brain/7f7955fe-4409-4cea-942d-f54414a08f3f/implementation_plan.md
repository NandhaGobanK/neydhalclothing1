# Order Routing, Multi-Line Navigation, Whole-Store Sync, Order Closure & Review Toggle Plan

Focused operational and workflow plan delivering unassigned triage order routing, multi-line flex navigation wrapping, whole-store and bucket-level Google Sheets & CSV sync, delivered order closing with mandatory reopen reasons, interactive saree inventory order tracking, and a storefront customer reviews display toggle (Supabase migration deferred to a future phase per user request).

> [!IMPORTANT]
> **Confirmed Product Decisions:**
> - **Supabase Migration Deferred**: The active Firebase Firestore database and auth implementation remain completely intact and active. Supabase migration is postponed to a future phase.
> - **Orders Section Visibility**: The main Orders tab strictly displays unassigned intake orders. Once an order is assigned to any staff member or admin, it immediately leaves the Orders queue and moves into their bucket.
> - **Orders Header Declutter**: Remove "Open in Google Sheets", "Sync with Google Sheets", and "Export CSV" buttons from the Orders tab header.
> - **Whole-Store & Individual Sync in Buckets**: Staff Buckets will feature dual sync and export capabilities:
>   - *Whole Store Combined*: Syncs all staff and admin orders to Google Sheets and exports a complete unified CSV to analyze overall staff throughput and reward hard work.
>   - *Individual Bucket*: Syncs or exports only the active selected staff or admin's orders.
> - **Multi-Line Navigation & Bucket Switcher**: Both the top admin navigation strip and the staff bucket selector wrap cleanly across lines (`flex-wrap`) so no entries are hidden off-screen or require horizontal scrolling.
> - **Delivered Order Closure & Reason-Gated Reopen**: Delivered orders feature a "Close Order" button moving them to a dedicated "Closed Orders" view. Reopening requires a mandatory explanation prompt that is permanently logged to the order's history.
> - **Clickable Saree Inventory**: Saree inventory counts in the catalog are interactive buttons that open an inspection modal showing all customer orders for that specific saree.
> - **Storefront Reviews Display Toggle**: A toggle in Store Settings enables or disables customer reviews across the public storefront.

---

## 1. Overview & Core Concept

### Key Capabilities Delivered
1. **Unassigned Triage Queue (Orders Tab)**: Orders tab functions as an unassigned triage queue. Once an order is assigned, it moves immediately to the assignee's bucket.
2. **Clean Orders Header**: Removes Google Sheets and CSV export buttons from the Orders tab.
3. **Dual Whole-Store & Individual Sync/Export in Staff Buckets**:
   - **Whole-Store Mode**: Syncs all orders across all staff and admin into a unified Google Sheet or downloads a full CSV for staff productivity analysis.
   - **Bucket Mode**: Syncs or exports only the currently selected staff/admin bucket.
4. **Responsive Multi-Line Navigation**:
   - Bucket switcher wraps items onto new lines (`flex-wrap`) without horizontal scrolling.
   - Main header tab scroller wraps items onto new lines (`flex-wrap`) without horizontal scrolling.
5. **Delivered Order Closure & Reason-Gated Reopen**:
   - `Close Order` button available on delivered orders, shifting them to a `Closed Orders` view.
   - `Reopen Order` button opens a modal requiring a mandatory reason, logging the event before unclosing.
6. **Clickable Saree Inventory with Linked Orders Modal**: Clicking any saree's inventory count opens a detailed list of all orders containing that saree.
7. **Storefront Review Display Toggle**: A switch in Admin Settings to enable or disable the public reviews section on the storefront.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ORDER TRIAGE & BUCKET FLOW                      │
└────────────────────────────────────────────────────────────────────────┘

  [New Customer Order] ──▶ [Main Orders Tab (Strictly Unassigned)]
                                  │
                                  ▼
                         [Assign to Staff / Admin]
                                  │
                                  ├────────────────────────┐
                                  ▼                        ▼
                       [Admin Bucket Tab]         [Staff Bucket Tab]
                                  │                        │
                       [Fulfill: Shipped/Refund]  [Fulfill: Shipped/Refund]
                                  │                        │
                                  ▼                        ▼
                             [Delivered]              [Delivered]
                                  │                        │
                                  ▼                        ▼
                            [Close Order]            [Close Order]
                                  │                        │
                                  ▼                        ▼
                         [Closed Orders View]    [Closed Orders View]
                                  │
                        [Reopen (Mandatory Reason)]
                                  │
                                  ▼
                         [Active Bucket Queue]
```

```
┌────────────────────────────────────────────────────────────────────────┐
│                   STOREFRONT REVIEW VISIBILITY TOGGLE                  │
└────────────────────────────────────────────────────────────────────────┘

  [Admin Settings] ──▶ [Reviews Section: Enable / Disable Toggle]
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
        [Enabled (Default)]             [Disabled]
               │                             │
    Show Star Ratings, Reviews     Hide Entire Review Section
    & Feedback Form on Storefront  from Product Details & Catalog
```

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale & Trade-off |
| :--- | :--- | :--- |
| **Orders Tab Filter** | Strictly unassigned orders only (`!assignedStaffId \|\| assignedStaffId === 'unassigned'`) | Eliminates duplicate work; cleanly separates intake triage from bucket execution. |
| **Navigation Wrapping** | `flex-wrap` with responsive gaps instead of forced single-line scrollbar | Directly addresses user feedback: all staff names and tabs visible at a glance without side-scrolling. |
| **Sheets/CSV Placement** | Removed from Orders tab, placed in Staff Buckets with dual modes (Whole Store vs. Bucket) | Centralizes analytics where staff performance is assessed and rewarded. |
| **Storefront Reviews** | Global toggle in Store Settings (`showCustomerReviews: boolean`) | Gives the owner total control over storefront presentation while preserving collected reviews in Firestore. |
| **Order Closure Model** | `isClosed: boolean`, `closedAt`, `closedBy`, `reopenedAt`, `reopenedBy`, `reopenReason` | Lightweight metadata on existing order schema without breaking compatibility with external exports. |

---

## 4. Technical Architecture & Component Mapping

```
┌────────────────────────────────────────────────────────────────────────┐
│                          ADMIN APPLICATION UI                          │
├──────────────────┬──────────────────┬──────────────────┬───────────────┤
│    AdminLayout   │   OrderManager   │StaffBucketManager│ ProductManager│
│  (Wrapping Nav)  │(Unassigned Queue)│ (Dual Sync/Close)│(Clickable Stk)│
└────────┬─────────┴────────┬─────────┴────────┬─────────┴───────┬───────┘
         │                  │                  │                 │
         ▼                  ▼                  ▼                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       STATE & STORE MANAGEMENT                         │
│                    (StoreContext / Store Types)                        │
│   - assignOrderToStaff(orderId, staffId, staffName, reason)            │
│   - closeOrder(orderId, closedBy)                                      │
│   - reopenOrder(orderId, reopenedBy, reason)                           │
│   - updateStock / getOrdersForProduct(productId)                       │
│   - updateSettings({ showCustomerReviews })                            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
                       Firebase Firestore DB
```

---

## 5. Implementation Phases & Verification Steps

1. **Step 1: Orders Triage Filtering & Header Decluttering**:
   - In `OrderManager.tsx`: filter `filteredOrders` strictly to unassigned orders (`!o.assignedStaffId || o.assignedStaffId === 'unassigned'`).
   - Remove "Open in Google Sheets", "Sync with Google Sheets", and "Export CSV" buttons from the `OrderManager` header.
2. **Step 2: Dual Whole-Store & Bucket Sync/Export with Multi-Line Navigation**:
   - In `StaffBucketManager.tsx`: Add "Whole Store Sync" & "Whole Store Export CSV" alongside individual bucket sync & export.
   - Update bucket switcher pills and top tabs in `AdminLayout.tsx` to `flex-wrap` so all entries cleanly wrap across lines without horizontal scrollbars.
3. **Step 3: Delivered Order Closing & Reason-Gated Reopen**:
   - In `StaffBucketManager.tsx`: For `Delivered` orders, provide a "Close Order" action.
   - Closed orders move into a dedicated "Closed Orders" tab/filter.
   - Clicking "Reopen Order" prompts a modal with a mandatory reason field, logging the event to `assignmentHistory` / audit notes.
4. **Step 4: Clickable Saree Inventory Orders Modal**:
   - In `ProductManager.tsx`: Make the stock/inventory column an interactive badge.
   - Clicking opens an "Inventory Orders" modal displaying all orders containing that saree with quantities, customer info, and status.
5. **Step 5: Storefront Customer Reviews Display Toggle**:
   - In `StoreSettings`: Add `showCustomerReviews: boolean` toggle.
   - In `SettingsManager.tsx`: Add toggle control with live description.
   - In Storefront (`ProductDetailModal.tsx` & Storefront views): Conditionally render the customer reviews section and rating submission based on `settings.showCustomerReviews`.
6. **Step 6: Compilation & End-to-End Verification**:
   - Run `compile_applet` to verify zero TypeScript or Vite compilation errors.
