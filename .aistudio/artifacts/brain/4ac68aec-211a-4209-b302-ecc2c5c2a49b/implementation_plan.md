# Storefront Evolution: Dynamic Homepage, Advanced Catalog Filters & Order Management

Transform the boutique application with a high-fidelity 5-tier **Homepage**, interactive multi-select **Dropdown Filter System** on the product catalog, streamlined **Order Stages Filtering & Search**, and policy/privacy cleanup.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design choices were confirmed during Phase 1 clarification:
> - **Reels & Shorts Strategy**: Supported with admin-manageable video reel configurations in store settings, pre-seeded with high-definition Salem silk handloom artisan reels that play in an interactive video modal.
> - **Bottom Navigation**: "Home" is positioned as the first tab on the left and set as the default landing view.
> - **Dropdown Filtering**: Multi-select dropdown menus with active filter count badges and clean click-outside dismissal.

---

## 1. Overview & Core Concept

### What It Delivers
1. **Interactive 5-Tier Homepage**:
   - **Tier 1 (Auto Carousel)**: Rich hero promotional banners highlighting Salem handloom heritage and bridal launches.
   - **Tier 2 (Auto Carousel)**: "Neydhal Clothing Featured Categories" showcasing authentic weaves with item counts and quick-browse actions.
   - **Tier 3 (Manual Carousel)**: "Experience Neydhal Clothing: Shorts & Reels" featuring 9:16 vertical video cards with direct playback modal.
   - **Tier 4 (Manual Carousel)**: "New Arrivals" carousel showcasing the latest loom releases.
   - **Tier 5 (Manual Carousel)**: "Best Selling Products" carousel showcasing timeless master weaves.
2. **Catalog Dropdown Filtering (`ProductGrid.tsx`)**:
   - Refactored filter bar with 4 clean dropdown buttons: **Stock**, **Price Range**, **Colour**, and **Size**.
   - Multi-select option checkboxes with instant count badges (e.g., `Stock (2)`).
   - Dynamic colors and sizes reflecting current catalog inventory and category attributes.
3. **Boxed & Color-Coded Order Stage Filter Bar (`CustomerOrdersPage.tsx`)**:
   - Stage filter boxes: **All Orders**, **Pending** (amber), **Confirmed** (blue), **Shipped** (purple), **Delivered** (emerald), **Cancelled** (rose), and **Refunded** (teal).
   - Compact search bar aligned to the bottom-right corner for quick lookup by Order #, UTR, or product SKU.
4. **Targeted Policy & Account Cleanup**:
   - Removal of "Profile Privacy & Data Isolation" card from `CustomerAccountPage.tsx`.
   - Removal of "No cancellation once the order is shipped" notice banner from Category, Product Detail, and Search pages—restricting its display exclusively to checkout confirmation modals where legally relevant.

---

## 2. User Experience & Visual Design

### Visual Identity & Theme
- **Color Discipline**: Warm heritage neutrals (ivory `#fafafa`, deep charcoal `#18181b`, royal maroon/amber `#831843` & `#d97706`).
- **Typography Pairing**: Elegant Cormorant Garamond for editorial headings; Plus Jakarta Sans with tabular figures for pricing and product specs.
- **Micro-Interactions**: Smooth CSS transform animations for carousel navigation, hover elevation on product cards, and instant dropdown transitions with outside-click dismissal.

### Component Layout & Hierarchy
```
┌────────────────────────────────────────────────────────┐
│                   Top Storefront Header                │
├────────────────────────────────────────────────────────┤
│                    Active Tab Content                  │
│                                                        │
│  [Home Page]                                           │
│   ├── 1. Auto Banner Carousel                          │
│   ├── 2. Auto Categories Carousel                      │
│   ├── 3. Manual Shorts & Reels (9:16 Video Cards)      │
│   ├── 4. Manual New Arrivals Carousel                  │
│   └── 5. Manual Best Selling Products Carousel         │
│                                                        │
│  [Catalog / Search Page]                               │
│   └── Dropdown Filter Bar: [Stock] [Price] [Color] [Size]
│                                                        │
│  [My Orders Page]                                      │
│   ├── Stage Boxes: [All] [Pending] [Confirmed] ...     │
│   └── Compact Search Bar (Bottom-Right)                │
├────────────────────────────────────────────────────────┤
│  Bottom Nav: [🏠 Home] [📁 Categories] [🔍 Search] ... │
└────────────────────────────────────────────────────────┘
```

---

## 3. Key Product Decisions & Trade-Offs

1. **Homepage Architecture**:
   - *Decision*: Create a dedicated `HomePage.tsx` modular component and place `Home` at index 0 of `BottomNavBar.tsx`.
   - *Rationale*: Elevates brand storytelling and discovery while preserving fast mobile navigation between collections, search, wishlist, and orders.
2. **Carousel Autoplay vs. Manual Separation**:
   - *Decision*: Tiers 1 & 2 autoplay with pause-on-hover; Tiers 3, 4 & 5 remain manual scroll/arrow navigation.
   - *Rationale*: Adheres to user prompt specifications while preventing distracting motion overload.
3. **Filter UI Modernization**:
   - *Decision*: Move from wide horizontal pill chips to floating dropdown menus with sticky popovers.
   - *Rationale*: Keeps the top of the product catalog compact, scalable to 50+ colors, and avoids vertical layout clutter on mobile devices.
4. **Order Cancellation Notice Placement**:
   - *Decision*: Scoped strictly to `CheckoutModal.tsx` and `PrepaidCheckoutPage.tsx`.
   - *Rationale*: Eliminates redundant warning banners across casual browsing while keeping clear terms at the final payment step.

---

## 4. Technical Architecture & Component Mapping

### Key Components to Create & Modify
- **`src/components/storefront/HomePage.tsx`**: New component containing the 5 carousel tiers, autoplay intervals, video reel trigger modal, and direct product detail/category routing.
- **`src/components/storefront/BottomNavBar.tsx`**: Add `home` tab at index 0 with active highlight.
- **`src/components/storefront/ProductGrid.tsx`**: Replace existing inline buttons with dropdown components for **Stock**, **Price Range**, **Colour**, and **Size** with multi-select state.
- **`src/components/customer/CustomerOrdersPage.tsx`**: Add boxed, color-coded stage filter buttons and reposition search bar below to the right.
- **`src/components/customer/CustomerAccountPage.tsx`**: Remove the Profile Privacy & Data Isolation block.
- **`src/components/storefront/CategoryBrowser.tsx` & `src/components/storefront/ProductDetailPage.tsx`**: Remove the boutique policy notice banner.
- **`src/context/StoreContext.tsx` & `src/data/initialData.ts`**: Update initial settings to support customizable video reel items with thumbnails and video URLs.

---

## 5. Verification Plan

1. **Compilation & Linting**: Run `compile_applet` and `lint_applet` to ensure zero TypeScript or build errors.
2. **Navigation Flow**: Verify clicking "Home" in the bottom navigation loads the 5 carousels smoothly.
3. **Carousel Validation**: Verify auto-cycling for banners and categories, and smooth manual arrow/swipe browsing for reels, new arrivals, and bestsellers.
4. **Filter Verification**: Verify multi-select behavior in Stock, Price, Colour, and Size dropdowns with active count indicators and accurate grid updates.
5. **Orders Verification**: Verify clicking any colored stage box (Pending, Confirmed, Shipped, Delivered, Cancelled, Refunded) filters the orders accurately, and the search input functions correctly.
