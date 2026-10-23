# Cross-Selling & Interactive Virtual Try-On Feature (Blouse, Sarees, & Jewelry)

A comprehensive ensemble styling suite combining boutique cross-selling curation with an interactive in-browser **Virtual Try-On** camera experience. Admins link matching sarees, designer blouses, and temple jewelry; shoppers can visualize the assembled look on a mannequin model with their own live selfie or uploaded photo, adjusted in real time with zero-server privacy guarantees, and purchase individual items or the entire ensemble in one click.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product decisions were confirmed during requirements clarification and refined with the Virtual Try-On specification:

- **Confirmed Decision 1 (Admin Mapping Mode)**: Handpicked specific products with category fallback. Admins can explicitly link curated matching items (e.g. emerald blouse, temple jhumkas/necklace to a crimson Kanjivaram), with fallback categories dynamically populating recommendations if items are out of stock.
- **Confirmed Decision 2 (Widget Placement)**:
  - **Product Details Modal**: Displays the editorial **"Complete the Look"** ensemble showcase, paired with the new **"Virtual Try-On"** live camera launcher.
  - **Cart Drawer**: Displays the high-intent **"Complete Your Ensemble"** quick-add strip.
- **Confirmed Decision 3 (Customer Add-to-Bag Flow)**: Hybrid one-click "Add to Cart" on each recommended item alongside a unified "Add Look to Bag" bundle button.
- **Confirmed Decision 4 (Virtual Try-On Architecture & Privacy)**:
  - **100% Client-Side In-Browser Processing**: Uses HTML5 Canvas and WebRTC `navigator.mediaDevices.getUserMedia` for zero-latency camera capture.
  - **Zero Server Uploads**: Photos are processed purely in local browser memory and never uploaded to any server or database, satisfying strict session privacy.
  - **Interactive Face Mapping & Framing**: Shoppers can adjust zoom, rotation, vertical offset, and portrait brightness over the mannequin model wearing the selected saree drape, blouse, and jewelry.

---

## 1. Overview & Core Concept

### What It Does
1. **Admin Product-Category Suggestion Mapping**: Admins can link handpicked items (blouse, saree, jewelry) to any product and configure category fallbacks.
2. **"Complete the Look" Styling Showcase**: Customers viewing a product see matching pieces with live stock indicators and pricing.
3. **Interactive Virtual Try-On**:
   - Customers tap **"✨ Try On This Look (Live Selfie)"** inside the product modal or styling drawer.
   - Customers can switch on their front-facing camera for an instant selfie or upload a photo from their library.
   - The interactive canvas maps the customer's face directly into the boutique mannequin silhouette draped in the assembled saree, designer blouse, and bridal/temple jewelry.
   - Intuitive on-screen controls allow easy fine-tuning (pinch/slider zoom, pan, tilt, and brightness).
   - A clear trust marker reassures the customer: `"🔒 Session-only — Your photo is processed securely in your browser and never saved or uploaded."`
4. **Single-Click Ensemble Purchase**: Customers can immediately add individual pieces or the entire coordinated set directly to their shopping bag.

### Target Audience & Persona
- **South Asian Wedding & Festive Shoppers**: Brides, wedding attendees, and festive shoppers wanting to visualize how rich jewel tones, neckline cuts, and temple ornaments frame their face before buying.
- **Boutique Curators**: Store owners aiming to recreate the high-touch consultation of a luxury saree atelier online.

---

## 2. User Experience & Visual Design

### Key User Flows

#### Flow 1: Admin Suggestion Mapping
1. Admin opens **Product Manager** in the Admin panel and selects a product to edit (or creates a new one).
2. Under the **"Cross-Sell Suggestions & Ensembles"** section:
   - Admin searches and selects 1–4 specific matching products (e.g. selecting "Zari Embroidered Raw Silk Blouse" and "Kundan Temple Choker" for a Kanjivaram saree).
   - Admin checks fallback categories (e.g. `Designer Blouses`, `Temple Jewelry`).
3. Saves the product. Changes persist immediately to Firestore.

#### Flow 2: Storefront Ensemble Viewing & Virtual Try-On
1. Customer clicks on a product card to open the **Product Details Modal**.
2. Below the product gallery and specifications, the **"Complete the Look"** section showcases the curated blouse, saree, and jewelry pieces.
3. Customer clicks **"✨ Virtual Try-On / Live Selfie"**:
   - An elegant full-height styling drawer or modal opens.
   - Customer chooses **"Open Camera"** or **"Upload Photo"**.
   - If camera is selected, a live camera viewfinder opens with a face-guide oval.
   - Upon capture (or photo upload), the face is placed onto the high-resolution ensemble mannequin wearing the exact saree, blouse, and jewelry.
   - Interactive sliders and touch drag controls allow instant alignment (Position X/Y, Scale, Rotation, and Brightness match).
4. Customer can toggle individual ensemble layers (e.g. toggle jewelry on/off, swap blouse shade).
5. Customer clicks **"Add Complete Look to Bag (3 Items - ₹39,500)"** or adds individual pieces.

#### Flow 3: Cart Drawer Quick-Add
1. Opening the shopping bag displays items currently added.
2. If any cart item has cross-sell pairings that are not yet in the cart, a sleek **"Frequently Paired Accessories"** strip displays quick `+ Add to Bag` action cards with instant subtotal and free shipping updates.

### Visual Identity & Domain Design
- **Editorial Luxury**: Follows the boutique's warm neutral aesthetic with deep charcoal text and royal zari/crimson accents (`text-stone-900`, `bg-stone-50`, `border-amber-200`, `text-rose-900`).
- **Zero-Pill Discipline**: Unboxed metadata with typographic separators (`·`).
- **Camera Viewfinder**: Matte obsidian overlay (`bg-stone-950/90`), subtle golden alignment reticle, and tactile capture button with active shutter feedback.
- **Privacy Badge**: Prominent yet tasteful padlock shield with clear statement: `🔒 100% In-Browser Privacy — Photos are never uploaded or saved beyond this session`.

---

## 3. Technical Architecture & Component Structure

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Admin Product Manager                           │
│   src/components/admin/ProductManager.tsx                              │
│   └── CrossSellManager (Product search + Fallback category selector)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Saves crossSellProductIds &
                                    │ crossSellCategoryNames
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             Firestore                                  │
│   /products/{id} -> crossSellProductIds[], crossSellCategoryNames[]    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Realtime sync
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Customer Storefront Touchpoints                   │
│                                                                        │
│   ProductDetailModal.tsx                CartDrawer.tsx                 │
│   ├── CompleteTheLookWidget             └── CartCrossSellStrip         │
│   │   ├── Ensemble Item Cards (+ Add)       └── Quick "+ Add" Actions  │
│   │   └── "Virtual Try-On" Button                                      │
│   │           │                                                        │
│   │           ▼                                                        │
│   │   VirtualTryOnModal.tsx (New Component)                            │
│   │   ├── WebRTC Live Camera Stream & File Upload                      │
│   │   ├── HTML5 Face Mapping Canvas (Mannequin drape overlay)          │
│   │   ├── Interactive Fine-Tuning Controls (Zoom, Pan, Tilt)           │
│   │   ├── Session Privacy Indicator (Zero Server Persistence)          │
│   │   └── One-Click "Add Look to Bag" Bundle Checkout                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

1. **`src/types/store.ts`**:
   - Add `crossSellProductIds?: string[]` and `crossSellCategoryNames?: string[]` to `Product`.
   - Add `TryOnEnsemble` interface for structured try-on styling state.

2. **`src/data/initialData.ts`**:
   - Seed sample **Designer Blouses** (e.g. `Raw Silk Maggam Work Blouse`, `Velvet Embroidered Blouse`) and **Temple Jewelry** (e.g. `Kundan Nakshi Choker Set`, `Antique Matte Temple Jhumkas`).
   - Add `crossSellProductIds` linking between the initial sarees, blouses, and jewelry.

3. **`src/components/common/VirtualTryOnModal.tsx`**:
   - Handles camera stream (`navigator.mediaDevices.getUserMedia`) with graceful fallback to file upload.
   - Dual-layer composite HTML5 canvas:
     - Base Layer / Framing: Mannequin wearing the assembled saree + blouse + jewelry with transparent face aperture.
     - User Layer: Positioned, scaled, and rotated user portrait with soft edge blend.
     - Overlay Accent Layer: Delicate jewelry collar and maang tikka / ear accents positioned naturally.
   - Real-time adjustment controls:
     - Sliders / Drag for Scale (0.5x – 2.0x), Vertical/Horizontal Pan, Rotation (-30° to +30°), and Brightness.
     - "Reset Alignment" and "Retake Photo" buttons.
   - Prominent Session Privacy Card: Reassuring customers that camera feed stays strictly in browser RAM.
   - Bundle action bar: itemized list of try-on items with live prices and a single "Add Complete Look to Bag" CTA.

4. **`src/components/storefront/ProductDetailModal.tsx`**:
   - Integrate `CompleteTheLookWidget` below product specs.
   - Renders matching items with individual "+ Add" buttons and a "✨ Virtual Try-On" button that launches `VirtualTryOnModal`.

5. **`src/components/storefront/CartDrawer.tsx`**:
   - Integrate `CartCrossSellStrip` recommending matching jewelry or blouses for sarees currently in the bag.

6. **`src/components/admin/ProductManager.tsx`**:
   - Add the suggestion editor with searchable product dropdown and category fallback checkboxes.

7. **`firebase-blueprint.json`**:
   - Document `crossSellProductIds` and `crossSellCategoryNames` in the `Product` entity definition.

---

## 4. Verification & Testing Plan

1. **Admin Product Management**:
   - Create or edit a product, link matching items, select fallback categories, and save. Verify fields update in store state.
2. **Storefront Complete the Look**:
   - Open a saree product; verify linked blouses and jewelry appear with correct title, price, and stock.
   - Test adding an individual item to cart.
   - Test "Add Complete Look to Bag" bundle button.
3. **Virtual Try-On Experience**:
   - Open Virtual Try-On modal.
   - Test camera permissions and live selfie capture.
   - Test file upload fallback with existing portrait image.
   - Test alignment controls (drag, scale, rotate, brightness).
   - Test adding the entire look to the bag directly from the Try-On modal.
   - Verify camera stream stops cleanly upon modal close (no orphaned video tracks).
4. **Cart Cross-Sell**:
   - Open cart drawer with 1 item; verify suggestions appear for complementary categories not yet in cart.
5. **Code & Build Verification**:
   - Run `compile_applet` and `lint_applet` to confirm error-free build.
