# Customer Login Footer: Terms & Conditions, Refund Policy & Privacy Policy

Provide full compliance documentation and interactive inline collapsible policy cards in the footer of the customer login page (`CustomerLoginPage.tsx`), detailing the strict artisan handloom policy ("No returns; exceptions handled directly via store concierge/staff"), comprehensive Terms of Service, and patron Privacy Policy.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed during the interactive interview:
> - **Refund & Return Model**: Strict **No Returns** policy on handcrafted heirloom sarees. In the event of transit damage or verified weaving discrepancies, patrons must contact store staff directly via concierge chat, email, or telephone for case-by-case review.
> - **Display Presentation**: **Inline collapsible policy cards inside the footer** with smooth expand/collapse accordions, quick-jump policy tabs, and copy/print capabilities without leaving the login portal.
> - **Policy Suite**: Complete coverage for **Terms of Service**, **Refund & Cancellation Policy**, and **Privacy Policy** satisfying Indian E-Commerce consumer guidelines and Paytm Payment Gateway channel activation requirements.

---

## 1. Overview & Core Concept

### What It Delivers
A dedicated, elegant compliance footer module embedded into `CustomerLoginPage.tsx` containing three comprehensive policy modules tailored specifically for **Neydhal Handcrafted Heritage Sarees**:
1. **Terms of Service**: Catalog access rules, pricing & taxes (GST), handloom weave nuances, digital payments via Paytm/UPI, intellectual property, and governing jurisdiction (Salem / Tamil Nadu).
2. **Refund & Cancellation Policy**: Clear declaration of the **No Returns** policy on pure mulberry silk and authentic zari sarees, order cancellation windows prior to dispatch, procedure for reporting damaged parcels with unboxing evidence, and store staff concierge resolution paths.
3. **Privacy & Data Protection Policy**: Explanation of patron profile isolation, phone number authentication, payment data handling through PCI-DSS compliant Paytm gateway, and device-level privacy safeguards.

### Target Audience & Compliance Value
- **Patrons & Shoppers**: Reassured of legitimate boutique operations, transparent policies, and direct staff redressal options.
- **Paytm Verification Auditors**: Instant verification of e-commerce legal compliance, contact information, return policies, and consumer terms required to approve payment gateway live channels.

---

## 2. Comprehensive Application Policies

### A. Terms of Service (Neydhal Heritage Atelier)
1. **Artisan Nature & Weave Characteristics**:
   - Each saree is handwoven by master weavers across Kanchipuram, Varanasi, and Chanderi using pure mulberry silk and tested zari.
   - Minor slubs, subtle yarn variations, or slight motif asymmetries are natural hallmarks of authentic pit-loom weaving, not manufacturing defects.
   - Exact shade may vary marginally ($\le 5\%$) based on mobile and desktop monitor color calibration.
2. **Pricing, Orders & Payments**:
   - All prices are quoted in Indian Rupees (₹) inclusive of applicable GST (GSTIN: 33AAAAA0000A1Z5).
   - Orders are confirmed upon payment authorization via the official Paytm Payment Gateway (UPI, Cards, Net Banking, Paytm Wallet).
   - In the event of pricing errors or sudden loom stock exhaustion, the boutique reserves the right to cancel and issue a full credit or refund.
3. **Account & Patron Verification**:
   - Customer accounts are verified via registered Google authentication or verified phone credentials to ensure isolated order access and delivery security.
   - Patrons are responsible for safeguarding login credentials.
4. **Governing Law & Jurisdiction**:
   - All agreements and transactions are governed under the laws of the Republic of India, with exclusive jurisdiction in Salem / Chennai, Tamil Nadu.

### B. Refund & Cancellation Policy
1. **Strict No Returns Policy**:
   - Due to the delicate, heirloom nature of handloom silk drapes and hygiene considerations, **Neydhal does not accept general returns, change-of-mind refunds, or post-delivery exchanges**.
2. **Damaged, Defective or Incorrect Items (Concierge Staff Review)**:
   - If an order arrives damaged in transit or a completely incorrect item was dispatched, the patron must **contact store staff within 48 hours of delivery**.
   - Contact channels: Concierge Live Chat on the order tracking link, email to `nandhagoban21@gmail.com`, or WhatsApp/phone to `+91 98765 43210`.
   - An uncut video recording of the outer parcel unpacking is mandatory for courier damage insurance claims.
   - Upon review and verification by the master weaving team, store staff will arrange a reverse pick-up and issue a replacement or direct bank/gateway refund within 5–7 business days.
3. **Order Cancellation Before Dispatch**:
   - Orders can be cancelled free of charge through the self-service cancellation window **within 2 hours of placement** (or before the loom dispatch milestone is recorded).
   - Once dispatched via DTDC or Blue Dart, orders cannot be recalled or cancelled.

### C. Privacy & Data Protection Policy
1. **Information Collected**:
   - Contact details (full name, phone number, delivery address, email) collected solely for order fulfillment, courier transit updates, and concierge communications.
2. **Financial Data Security**:
   - Neydhal does not capture, store, or process credit card numbers or UPI MPINs. All transactions are processed through tokenized, 256-bit encrypted channels via Paytm (RBI-licensed payment aggregator).
3. **Strict Data Isolation**:
   - Patron orders, wishlists, and delivery addresses are isolated in dedicated customer records with zero cross-customer sharing or third-party marketing resale.

---

## 3. User Experience & Visual Design

### Footer Layout & Collapsible Architecture
- **Footer Placement**: Integrated beneath the main patron login card on `CustomerLoginPage.tsx`, replacing the minimal single-line footer with an expansive, luxury-styled compliance section.
- **Top Policy Action Bar**:
  - Horizontal buttons: `Terms of Service`, `Refund Policy`, `Privacy Policy`.
  - Badges: `No Returns (Staff Contact Required)`, `RBI / GST Compliant`, `Paytm Secure 256-bit`.
- **Inline Collapsible Policy Cards**:
  - Clicking any policy expands a rich, structured card directly within the footer with smooth accordion transition.
  - Features formatted clauses, highlighted callout boxes for "No Returns" policy and staff contact details (`nandhagoban21@gmail.com`, `+91 98765 43210`).
  - Single-click "Close" and "Copy Policy Text" controls.
- **Staff Support Quick-Bar**:
  - Direct links to reach out to store staff via phone, WhatsApp, and email if an exchange or inspection is required.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Customer Login Form (Username / Password / Google Sign-In)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CUSTOMER LOGIN FOOTER                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [📜 Terms of Service]   [↩️ Refund Policy (No Returns)]   [🔒 Privacy]  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ▾ INLINE EXPANDED POLICY CARD (e.g. Refund & Return Policy)              │ │
│ │ • Strict No-Returns on Handloom Silk Sarees                             │ │
│ │ • Reporting transit damage within 48h with unboxing video               │ │
│ │ • Direct Store Staff Contact: nandhagoban21@gmail.com | +91 98765 43210  │ │
│ │ • Paytm Payment Gateway Refund Timeline: 5-7 business days               │ │
│ │ [Copy Text]  [Print / Close]                                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ © 2026 Neydhal Heritage Atelier • GSTIN: 33AAAAA0000A1Z5 • Salem, TN • [B2B]│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Technical Architecture & File Modifications

### Component Structure
- **`src/data/legalPolicies.ts`**: Centralized source of truth for all three legal policies (Terms, Refund Policy, Privacy Policy) containing structured sections, clauses, contact details, and disclaimers.
- **`src/components/customer/CustomerLoginPage.tsx`**: Update the footer section to incorporate the interactive policy triggers, collapsible policy accordion, staff contact bar, and disclaimer notes.

### Verification Steps
1. Run `compile_applet` to verify TypeScript compilation and build cleanliness.
2. Run `lint_applet` to confirm no unused variables or type errors.
3. Test expanding/collapsing all three policy cards on `CustomerLoginPage.tsx`.
4. Validate that the Refund Policy explicitly states "No returns; contact store staff for damaged parcels".
