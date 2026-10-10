import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { StoreTheme } from '../../types/store';
import { THEME_CONFIGS } from '../../utils/theme';
import {
  Save,
  Palette,
  Megaphone,
  CreditCard,
  Building,
  Key,
  Check,
  Upload,
  RotateCcw,
  Sparkles,
  LayoutTemplate,
  Eye,
} from 'lucide-react';

export const SettingsManager: React.FC = () => {
  const { settings, updateSettings, resetToInitialData } = useStore();

  // Boutique Info
  const [boutiqueName, setBoutiqueName] = useState(settings.boutiqueName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [contactPhone, setContactPhone] = useState(settings.contactPhone);
  const [contactEmail, setContactEmail] = useState(settings.contactEmail);
  const [instagramHandle, setInstagramHandle] = useState(settings.instagramHandle);
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress);
  const [theme, setTheme] = useState<StoreTheme>(settings.theme);

  // Storefront Public Front Display Controls (Prompt requirement: Things what to show on public front should be editable from admin side)
  const defaultDisplay = settings.storefrontDisplay || {
    heroHeadline: 'Timeless Drapes, Woven for Generations.',
    heroSubheadline: 'Discover authentic handcrafted Kanjivaram bridal silks, Varanasi Kadwa brocades, and feather-light Chanderi tissue sarees. Direct from the master weavers of India to your doorstep.',
    showHeroBanner: true,
    showTrustBadges: true,
    showCraftsmanshipStory: true,
    storyTitle: 'The Heritage Loom Legacy',
    storyContent: 'Every saree in our collection is an heirloom woven with mulberry silk and authentic zari by master weavers across Kanchipuram and Varanasi.',
    showTrackOrder: true,
    allowPublicCancellation: true,
    freeShippingText: 'Free Insured Express Delivery across India (Tamper-Proof Box)',
  };

  const [heroHeadline, setHeroHeadline] = useState(defaultDisplay.heroHeadline);
  const [heroSubheadline, setHeroSubheadline] = useState(defaultDisplay.heroSubheadline);
  const [showHeroBanner, setShowHeroBanner] = useState(defaultDisplay.showHeroBanner);
  const [showTrustBadges, setShowTrustBadges] = useState(defaultDisplay.showTrustBadges);
  const [freeShippingText, setFreeShippingText] = useState(defaultDisplay.freeShippingText);
  const [showTrackOrder, setShowTrackOrder] = useState(defaultDisplay.showTrackOrder);
  const [allowPublicCancellation, setAllowPublicCancellation] = useState(
    settings.storefrontDisplay?.allowPublicCancellation !== false
  );
  const [showCraftsmanshipStory, setShowCraftsmanshipStory] = useState(defaultDisplay.showCraftsmanshipStory);
  const [storyTitle, setStoryTitle] = useState(defaultDisplay.storyTitle);
  const [storyContent, setStoryContent] = useState(defaultDisplay.storyContent);

  // Announcement Comments Board
  const [announcementEnabled, setAnnouncementEnabled] = useState(settings.announcement.enabled);
  const [announcementText, setAnnouncementText] = useState(settings.announcement.text);

  // Payment Config
  const [upiId, setUpiId] = useState(settings.payment.upiId);
  const [payeeName, setPayeeName] = useState(settings.payment.payeeName);
  const [qrCodeUrl, setQrCodeUrl] = useState(settings.payment.qrCodeUrl || '');
  const [paymentInstructions, setPaymentInstructions] = useState(settings.payment.instructions);

  // Security
  const [adminPin, setAdminPin] = useState(settings.adminPin);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      boutiqueName: boutiqueName.trim(),
      tagline: tagline.trim(),
      contactPhone: contactPhone.trim(),
      contactEmail: contactEmail.trim(),
      instagramHandle: instagramHandle.trim(),
      storeAddress: storeAddress.trim(),
      theme,
      storefrontDisplay: {
        heroHeadline: heroHeadline.trim(),
        heroSubheadline: heroSubheadline.trim(),
        showHeroBanner,
        showTrustBadges,
        showCraftsmanshipStory,
        storyTitle: storyTitle.trim(),
        storyContent: storyContent.trim(),
        showTrackOrder,
        allowPublicCancellation,
        freeShippingText: freeShippingText.trim(),
      },
      announcement: {
        enabled: announcementEnabled,
        text: announcementText.trim(),
        badgeLabel: 'NOTICE',
      },
      payment: {
        upiId: upiId.trim(),
        payeeName: payeeName.trim(),
        qrCodeUrl: qrCodeUrl.trim(),
        instructions: paymentInstructions.trim(),
      },
      adminPin: adminPin.trim() || '889988',
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setQrCodeUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900">
            Store & Settings Manager
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Customize what shows on public storefront, payment QR code, announcements, and theme
          </p>
        </div>

        {savedSuccess && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold animate-in fade-in">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Section 1: Public Storefront Content & Visibility Controls (User Request) */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-2 text-rose-950 font-serif font-bold text-base sm:text-lg">
            <LayoutTemplate className="w-5 h-5 text-amber-600" />
            <h3>Public Storefront Display & Content Controls</h3>
          </div>
          <p className="text-xs text-neutral-500 mb-4">
            Edit text headlines, customize customer-facing banners, and toggle sections visible on the public storefront.
          </p>

          <div className="space-y-4 text-xs">
            {/* Toggles Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showHeroBanner}
                  onChange={(e) => setShowHeroBanner(e.target.checked)}
                  className="rounded text-rose-900"
                />
                <span className="font-semibold text-neutral-800">Show Hero Banner</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTrustBadges}
                  onChange={(e) => setShowTrustBadges(e.target.checked)}
                  className="rounded text-rose-900"
                />
                <span className="font-semibold text-neutral-800">Show Trust Badges Strip</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTrackOrder}
                  onChange={(e) => setShowTrackOrder(e.target.checked)}
                  className="rounded text-rose-900"
                />
                <span className="font-semibold text-neutral-800">Show 'Track Order' Feature</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer sm:col-span-3 pt-1 border-t border-neutral-200">
                <input
                  type="checkbox"
                  checked={allowPublicCancellation}
                  onChange={(e) => setAllowPublicCancellation(e.target.checked)}
                  className="rounded text-rose-900"
                />
                <div className="flex-1">
                  <span className="font-semibold text-neutral-800 block">
                    Enable Customer Order Cancellation Requests (Pending & Confirmed Only)
                  </span>
                  <span className="text-[11px] text-neutral-500 font-normal">
                    When enabled, customers can submit cancellation and refund requests while orders are in Pending or Confirmed state. Once an order is Shipped, cancellations are automatically locked.
                  </span>
                </div>
              </label>
            </div>

            {/* Hero Headlines */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Public Hero Title / Headline *
                </label>
                <input
                  type="text"
                  value={heroHeadline}
                  onChange={(e) => setHeroHeadline(e.target.value)}
                  placeholder="e.g. Timeless Drapes, Woven for Generations."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Public Hero Subtitle / Description *
                </label>
                <textarea
                  rows={2}
                  value={heroSubheadline}
                  onChange={(e) => setHeroSubheadline(e.target.value)}
                  placeholder="e.g. Discover authentic handcrafted Kanjivaram bridal silks..."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Free Shipping / Delivery Badge Copy
                </label>
                <input
                  type="text"
                  value={freeShippingText}
                  onChange={(e) => setFreeShippingText(e.target.value)}
                  placeholder="e.g. Free Insured Express Delivery across India (Tamper-Proof Box)"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>
            </div>

            {/* Craftsmanship Section Controls */}
            <div className="pt-2 border-t border-neutral-200 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="craftStory"
                  checked={showCraftsmanshipStory}
                  onChange={(e) => setShowCraftsmanshipStory(e.target.checked)}
                  className="rounded text-rose-900 cursor-pointer"
                />
                <label htmlFor="craftStory" className="font-bold text-neutral-800 cursor-pointer">
                  Show 'About Our Looms & Heritage' Story Section on Public Storefront
                </label>
              </div>

              {showCraftsmanshipStory && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Story Section Title</label>
                    <input
                      type="text"
                      value={storyTitle}
                      onChange={(e) => setStoryTitle(e.target.value)}
                      placeholder="e.g. The Heritage Loom Legacy"
                      className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Story Text Narrative</label>
                    <textarea
                      rows={2}
                      value={storyContent}
                      onChange={(e) => setStoryContent(e.target.value)}
                      placeholder="e.g. Every saree in our collection is an heirloom..."
                      className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Storefront Announcement / Comments Board */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-2 text-rose-950 font-serif font-bold text-base sm:text-lg">
            <Megaphone className="w-5 h-5 text-amber-600" />
            <h3>Storefront Announcement / Comments Board</h3>
          </div>
          <p className="text-xs text-neutral-500 mb-4">
            Type custom notices, festive offers, holiday dispatch schedules, or live updates to instantly display on the public storefront ticker.
          </p>

          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="announcementToggle"
                checked={announcementEnabled}
                onChange={(e) => setAnnouncementEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-rose-900 cursor-pointer"
              />
              <label htmlFor="announcementToggle" className="font-semibold text-neutral-800 cursor-pointer">
                Publish announcement on Public Storefront
              </label>
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Announcement Text / Notice *
              </label>
              <textarea
                rows={2}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="e.g. ✨ Festive Wedding Edit: Free Insured Express Delivery across India. 100% Pure Silk Mark Certified Handlooms."
                className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            {announcementEnabled && announcementText && (
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-neutral-400 uppercase">Live Storefront Preview:</span>
                <div className="mt-1 p-2.5 rounded-xl bg-rose-950 text-amber-200 text-xs flex items-center gap-2 border border-amber-600/30">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{announcementText}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Payment Configuration (UPI ID & Downloadable QR Code) */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-2 text-neutral-900 font-serif font-bold text-base sm:text-lg">
            <CreditCard className="w-5 h-5 text-amber-600" />
            <h3>Payment Configuration (Prepaid UPI)</h3>
          </div>
          <p className="text-xs text-neutral-500 mb-4">
            Customers will see these exact UPI payment coordinates and downloadable QR code during checkout before submitting their orders.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-neutral-800 mb-1">Business UPI ID *</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                required
                placeholder="e.g. yourboutique@okhdfcbank"
                className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono text-xs text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-800 mb-1">Payee Registered Name *</label>
              <input
                type="text"
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                required
                placeholder="e.g. Aara Heritage Sarees LLP"
                className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <label className="block font-semibold text-neutral-800">
                Custom UPI QR Code Image (Optional URL or File Upload)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={qrCodeUrl}
                  onChange={(e) => setQrCodeUrl(e.target.value)}
                  placeholder="Leave empty to use automatic live UPI QR generator, or paste image URL"
                  className="flex-1 p-2 rounded-xl border border-neutral-300 text-neutral-900"
                />
                <label className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-700 font-medium cursor-pointer flex items-center gap-1 shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload QR</span>
                  <input type="file" accept="image/*" onChange={handleQrUpload} className="hidden" />
                </label>
              </div>
              <p className="text-[11px] text-neutral-500">
                Customers can tap "Download QR Code" on the checkout page to save it directly to their mobile photo gallery.
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Boutique Profile & Contact Information */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-2 text-neutral-900 font-serif font-bold text-base sm:text-lg">
            <Building className="w-5 h-5 text-amber-600" />
            <h3>Boutique Profile & Concierge Contacts</h3>
          </div>
          <p className="text-xs text-neutral-500 mb-4">
            Contact information used for WhatsApp order routing, header title, and customer receipts.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Boutique Name</label>
              <input
                type="text"
                value={boutiqueName}
                onChange={(e) => setBoutiqueName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                WhatsApp Order Receiving Phone Number *
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+919876543210"
                className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
              />
              <p className="text-[10px] text-neutral-500 mt-0.5">Orders sent via WhatsApp will open a chat with this number.</p>
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Email Address</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Instagram Handle</label>
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Boutique Address</label>
              <input
                type="text"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Store Theme & Color Palette */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-2 text-neutral-900 font-serif font-bold text-base sm:text-lg">
            <Palette className="w-5 h-5 text-amber-600" />
            <h3>Store Theme & Color Palette</h3>
          </div>
          <p className="text-xs text-neutral-500 mb-4">
            Select the brand aesthetic for the public customer catalog.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(Object.keys(THEME_CONFIGS) as StoreTheme[]).map((themeKey) => {
              const cfg = THEME_CONFIGS[themeKey];
              const isSelected = theme === themeKey;
              return (
                <button
                  key={themeKey}
                  type="button"
                  onClick={() => setTheme(themeKey)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                    isSelected
                      ? 'border-neutral-900 ring-2 ring-neutral-900 bg-neutral-50 shadow-xs'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`w-4 h-4 rounded-full ${cfg.primaryBg}`} />
                    <span className="w-3 h-3 rounded-full bg-amber-500" />
                  </div>
                  <span className="text-xs font-bold text-neutral-900 leading-tight">
                    {cfg.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 6: Security PIN & Reset Operations */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-2 text-neutral-900 font-serif font-bold text-base sm:text-lg">
            <Key className="w-5 h-5 text-amber-600" />
            <h3>Admin Dashboard Security</h3>
          </div>
          <p className="text-xs text-neutral-500 mb-4">
            Protect your order ledger and product inventory from unauthorized public access.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs items-center">
            <div>
              <label className="block font-bold text-neutral-800 mb-1">
                Admin Master PIN (6 Digits)
              </label>
              <input
                type="text"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={6}
                placeholder="889988"
                className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono text-sm tracking-wider text-neutral-900"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Owner master security PIN required to unlock the Admin Console.
              </p>
            </div>

            <div className="pt-4 sm:pt-0">
              {confirmReset ? (
                <div className="space-y-1.5 animate-in fade-in">
                  <p className="text-[11px] font-bold text-rose-700">Restore factory catalog, stock & settings?</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetToInitialData();
                        setConfirmReset(false);
                        setSavedSuccess(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-700 text-white hover:bg-rose-800 text-xs font-bold transition shadow-xs"
                    >
                      Yes, Restore Defaults
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="px-2.5 py-1.5 rounded-xl border border-neutral-300 text-neutral-600 hover:bg-neutral-100 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-rose-300 text-rose-800 hover:bg-rose-50 text-xs font-semibold transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Factory Catalog & State</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Save Button Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs sm:text-sm shadow-md transition"
          >
            <Save className="w-4 h-4" />
            <span>Save All Boutique Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
