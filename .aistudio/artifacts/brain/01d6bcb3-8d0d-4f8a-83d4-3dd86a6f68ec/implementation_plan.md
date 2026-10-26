# Paytm All-in-One Payment Gateway Integration

Integrate the official Paytm All-in-One Payment Gateway for customer storefront purchases and B2B reseller wholesale orders, replacing manual UPI UTR input with an automated, verified checkout experience and a dedicated Admin configuration suite.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed during the requirements interview:
> - **Paytm Payment Experience**: Paytm All-in-One JS checkout popup combined with an interactive dynamic QR modal (supporting all UPI apps, Paytm Wallet, Net Banking, and Cards).
> - **Credentials Management**: Configurable inside the Admin Settings panel with a seamless toggle between Test/Staging (Sandbox) and Live (Production) modes.
> - **Reseller Workflow**: Paytm gateway applies to instant wholesale order checkout only (deposit wallet top-up excluded).
> - **Deprecation of Legacy Method**: The old manual VPA copy-paste, static QR download, and manual 12-digit UTR input are completely removed from both storefront checkout and reseller order drawers.

---

## 1. Overview & Core Concept

- **What It Does**: Replaces manual offline UPI verification with an automated Paytm Payment Gateway. When shoppers or wholesale resellers click "Pay Securely with Paytm", an All-in-One checkout modal opens, generating a dynamic transaction session, real-time QR code, and hosted options. Upon payment authorization, the system receives a verified transaction payload (`PTM_TXN_...`), automatically marking the order as paid.
- **Target Audience**: 
  - **Retail Customers**: Fast, trustworthy checkout without typing 12-digit reference numbers or taking screenshots.
  - **B2B Resellers**: Instant confirmation of wholesale dropship and boutique bulk orders.
  - **Store Admin & Staff**: Zero manual UTR cross-checking; verified bank reference IDs attached to every order record.
- **Key Value**: Drastically reduces checkout friction, eliminates fake or incorrect UTR disputes, and provides the store owner with enterprise-grade payment infrastructure configurable from their admin panel.

---

## 2. User Experience & Visual Design

### Key User Flows

#### A. Customer Storefront Checkout Flow
1. **Cart & Shipping Information**: Customer adds sarees or apparel to cart, enters shipping address in `CheckoutModal`.
2. **Order Review & Initiation**: Customer reviews order total (with automated free delivery threshold calculation) and clicks **"Proceed to Paytm Payment"**.
3. **Paytm All-in-One Modal**:
   - Opens a branded Paytm dialog featuring official Paytm colors (`#002970` deep navy and `#00BAF2` cyan).
   - Shows live order reference (`AARA-XXXX`), amount (`₹X,XXX` in tabular figures), and a countdown security timer.
   - **Dynamic QR Code**: Scan via Paytm, PhonePe, Google Pay, or BHIM.
   - **Payment Methods**: Segmented options for Paytm Wallet, UPI Intent, Credit/Debit Cards, and Net Banking.
   - **Test Mode Indicator**: In Sandbox mode, a prominent test simulator allows instant authorized completion for rapid prototyping.
4. **Instant Confirmation**: Upon callback, order is persisted with payment status `Paid`, generating the `OrderSuccessModal` with official Paytm transaction ID.

#### B. Reseller Wholesale Checkout Flow
1. **Wholesale Saree Selection**: Reseller selects bulk items with discounted wholesale pricing.
2. **Recipient & Margin Details**: Reseller enters dropship customer recipient info and margin.
3. **Paytm Wholesale Payment**: Reseller clicks **"Pay Wholesale Total with Paytm"**, opening the Paytm gateway modal for the wholesale discounted total.
4. **Ledger Update**: Order is logged into the Reseller Portal and Admin Order Ledger with verified Paytm payment status.

#### C. Admin Gateway Configuration Flow
1. **Payment Settings Tab**: In `AdminLayout` -> `SettingsManager` -> **Paytm Payment Gateway**:
   - **Gateway Toggle**: Enable / Disable Paytm Gateway.
   - **Environment Selector**: Segmented toggle between **Test / Staging (Sandbox)** and **Live Production**.
   - **Merchant Credentials**: Input fields for Merchant ID (MID), Merchant Key (with visibility toggle), Website Name (`WEBSTAGING` / `DEFAULT`), and Channel ID (`WEB`).
   - **Gateway Health Check / Test Tool**: A "Test Credentials & Connection" action verifying configuration validity.
   - **Setup Instructions Card**: Step-by-step guide explaining how to retrieve credentials from the Paytm Business Dashboard.

### Visual Identity & Theme Alignment
- **Aesthetic**: Follows the existing luxury boutique design language with Cormorant Garamond display typography and Plus Jakarta Sans body font.
- **Paytm Brand Integration**: Clean, official Paytm branding (`#002970` and `#00BAF2`) rendered in the checkout popup without clashing with the boutique's royal theme.
- **Anti-Slop Discipline**: No decorative status dots or pill-badge clutter; clean hairline borders, accessible contrast (WCAG AA), and tabular numerals for transaction amounts.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Paytm All-in-One JS SDK with Resilient Client-Side Fallback**
  - *Chosen Approach*: Implement a modular Paytm checkout manager (`paytm.ts` & `PaytmCheckoutModal.tsx`) that attempts to load `Paytm.CheckoutJS` from Paytm's CDN while providing a self-contained dynamic QR and simulated intent engine when running in sandbox environments or if third-party scripts are blocked by ad blockers.
  - *Why*: Ensures checkout never fails or hangs, even in sandboxed iframes or offline scenarios, while delivering a authentic Paytm experience.
- **Decision 2: Complete Deprecation of Manual UTR**
  - *Chosen Approach*: Strip out `upiTransactionId` manual text input fields, screenshot upload instructions, and the third-party app UTR guides (`gpay`, `phonepe`, `paytm` screenshots).
  - *Why*: The user explicitly stated: *"Going to remove the old method completely"*. Streamlining the form eliminates 4 unnecessary form fields and reduces checkout abandonment.
- **Decision 3: Admin-Controlled Gateway Credentials in Firestore**
  - *Chosen Approach*: Store Paytm gateway configuration within `StoreSettings.payment` persisted in Firestore and local storage, secured behind the Admin PIN / Google Auth.
  - *Why*: Allows the store owner to toggle between staging test mode and production live credentials anytime without redeploying code.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          StoreContext / Firestore                      │
│   - StoreSettings.payment (Paytm MID, Key, Environment, Modes)        │
│   - Orders Collection (status: 'Confirmed'/'Pending', paytmTxnId)      │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   ▼                                 ▼
┌───────────────────────────────────┐ ┌──────────────────────────────────┐
│         Storefront Flow           │ │          Reseller Flow           │
│  CheckoutModal.tsx                │ │  ResellerPortal.tsx              │
│  - Shipping & Customer Intake     │ │  - Dropship recipient form       │
│  - Cart total calculation         │ │  - Wholesale discounted total    │
└──────────────────┬────────────────┘ └──────────────────┬───────────────┘
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      │ Opens
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │            PaytmCheckoutModal.tsx               │
             │   - Paytm CheckoutJS SDK bridge                 │
             │   - Dynamic Paytm QR (UPI payload generator)    │
             │   - Payment methods: UPI, Cards, NetBanking     │
             │   - Test Sandbox auto-simulator & live webhook  │
             └────────────────────────┬────────────────────────┘
                                      │ On TXN_SUCCESS
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │       placeOrder() / placeResellerOrder()       │
             │   - paymentGateway: 'paytm'                     │
             │   - paytmTxnId: 'PTM_TXN_...'                   │
             │   - paymentStatus: 'paid'                       │
             └─────────────────────────────────────────────────┘
```

### Data Model Updates (`src/types/store.ts`)

```typescript
export interface PaytmSettings {
  enabled: boolean;
  environment: 'staging' | 'production';
  merchantId: string;       // Paytm MID
  merchantKey?: string;     // Paytm Secret Key
  website: string;          // 'WEBSTAGING' or 'DEFAULT'
  channelId: string;        // 'WEB'
  industryTypeId: string;   // 'Retail'
  autoVerifyInTestMode: boolean; // Auto-verify transactions in sandbox
  enableQr: boolean;
  enableUpi: boolean;
  enableCards: boolean;
  enableNetBanking: boolean;
  enableWallet: boolean;
}

export interface PaytmTransactionDetails {
  txnId: string;
  orderId: string;
  txnAmount: number;
  paymentMode: string;
  status: 'TXN_SUCCESS' | 'TXN_FAILURE' | 'PENDING';
  gatewayName: 'PAYTM';
  bankTxnId?: string;
  respCode?: string;
  respMsg?: string;
  txnDate: string;
}

// Updated PaymentSettings in StoreSettings
export interface PaymentSettings {
  paytm: PaytmSettings;
  // Deprecated legacy manual UPI settings retained optionally for backward-compatible fallback
  upiId?: string;
  payeeName?: string;
  qrCodeUrl?: string;
}
```

### Interactive State Transitions

```
[Customer clicks Checkout] ──> Validates Address ──> [Open Paytm Modal]
                                                              │
               ┌──────────────────────────────────────────────┴────────────────────────────┐
               │                                                                          │
         [Scan Paytm QR]                                                        [Pay with Card / UPI]
               │                                                                          │
               └──────────────────────────────┬───────────────────────────────────────────┘
                                              ▼
                                 [Paytm Authorization Event]
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
             [TXN_SUCCESS]                                     [TXN_FAILURE]
      - Generate PTM_TXN_...                             - Display error message
      - Call placeOrder(paytmDetails)                    - Retain cart & retry option
      - Show OrderSuccessModal
```

---

## 5. Implementation Steps

1. **Types & Initial Data**:
   - Update `src/types/store.ts` with `PaytmSettings`, `PaytmTransactionDetails`, and update `Order` interface.
   - Update `src/data/initialData.ts` with default Paytm gateway configuration (pre-configured in Staging mode with demo test credentials for instant evaluation).

2. **Paytm Gateway Service & Bridge (`src/utils/paytm.ts`)**:
   - Create script loader for Paytm Checkout JS SDK (`https://securegw-stage.paytm.in/merchantpgpui/checkoutjs/merchants/{MID}.js` or production URL).
   - Generate dynamic UPI string formatted for Paytm Merchant (`upi://pay?pa=...&pn=...&mc=...&tr=...&am=...`).
   - Implement simulated test transaction callback and payload verification.

3. **Paytm All-in-One Payment Modal (`src/components/common/PaytmCheckoutModal.tsx`)**:
   - Build a responsive modal with Paytm branding, security badges, dynamic QR, payment method switcher, and test simulator controls.

4. **Storefront Checkout Refactor (`src/components/storefront/CheckoutModal.tsx`)**:
   - Strip out manual UPI VPA copy button, static QR download, screenshot advice, and 12-digit UTR input form.
   - Wire customer address submission directly to open `PaytmCheckoutModal`.
   - On payment success, invoke `placeOrder` with verified Paytm transaction receipt.

5. **Reseller Portal Refactor (`src/components/reseller/ResellerPortal.tsx`)**:
   - Strip out manual UTR input from wholesale checkout drawer.
   - Route wholesale order checkout through `PaytmCheckoutModal`.
   - Save reseller wholesale order with verified Paytm transaction details.

6. **Admin Settings Manager (`src/components/admin/SettingsManager.tsx`)**:
   - Build the **Paytm Payment Gateway** configuration suite:
     - Sandbox / Live environment toggle.
     - MID and Merchant Key fields with toggleable masking.
     - Connection test button and Paytm Business Dashboard guidance.

7. **Order Records & Logistics Display**:
   - Update `OrderManager.tsx` and `OrderSuccessModal.tsx` to display verified Paytm transaction IDs and gateway status badges.
