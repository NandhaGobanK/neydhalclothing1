import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { StoreTheme, OrderStatusChatTemplates, StaffSectionPermissions, Order } from '../../types/store';
import { THEME_CONFIGS } from '../../utils/theme';
import { DEFAULT_CHAT_TEMPLATES, DEFAULT_STAFF_PERMISSIONS } from '../../data/initialData';
import { applyTemplateTokens } from '../../utils/upi';
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
  EyeOff,
  Image as ImageIcon,
  MessageSquare,
  Users,
  Shield,
  Trash2,
  Lock,
  Truck,
  CheckCircle2,
} from 'lucide-react';

export const SettingsManager: React.FC = () => {
  const { settings, updateSettings, resetToInitialData, currentUser, currentPermissions } = useStore();

  const isAdmin = currentUser?.type === 'admin';

  // Store Logo
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '');

  // Boutique Info
  const [boutiqueName, setBoutiqueName] = useState(settings.boutiqueName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [contactPhone, setContactPhone] = useState(settings.contactPhone);
  const [contactEmail, setContactEmail] = useState(settings.contactEmail);
  const [instagramHandle, setInstagramHandle] = useState(settings.instagramHandle);
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress);
  const [theme, setTheme] = useState<StoreTheme>(settings.theme);

  // Storefront Public Front Display Controls
  const defaultDisplay = settings.storefrontDisplay || {
    heroHeadline: 'Timeless Drapes, Woven for Generations.',
    heroSubheadline: 'Discover authentic handcrafted Kanjivaram bridal silks, Varanasi Kadwa brocades, and feather-light Chanderi tissue sarees. Direct from the master weavers of India to your doorstep.',
    showHeroBanner: true,
    heroBannerImageUrl: '',
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
  const [heroBannerImageUrl, setHeroBannerImageUrl] = useState(defaultDisplay.heroBannerImageUrl || '');
  const [showTrustBadges, setShowTrustBadges] = useState(defaultDisplay.showTrustBadges);
  const [freeShippingText, setFreeShippingText] = useState(defaultDisplay.freeShippingText);
  const [showTrackOrder, setShowTrackOrder] = useState(defaultDisplay.showTrackOrder !== false);
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

  // Automated Chat Templates
  const [chatTemplates, setChatTemplates] = useState<OrderStatusChatTemplates>({
    ...DEFAULT_CHAT_TEMPLATES,
    ...(settings.chatTemplates || {}),
  });
  const [activeChatTab, setActiveChatTab] = useState<keyof OrderStatusChatTemplates>('pending');

  // Staff Section Permissions (Configurable by admin)
  const [staffPermissions, setStaffPermissions] = useState<StaffSectionPermissions>({
    ...DEFAULT_STAFF_PERMISSIONS,
    ...(settings.defaultStaffPermissions || {}),
  });

  // Security (Strictly for admin)
  const [adminPin, setAdminPin] = useState(settings.adminPin);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // File Upload Handlers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setLogoUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleHeroBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setHeroBannerImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
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

  const handleInsertToken = (token: string) => {
    setChatTemplates((prev) => ({
      ...prev,
      [activeChatTab]: (prev[activeChatTab] || '') + ' ' + token,
    }));
  };

  const handleResetSingleTemplate = (key: keyof OrderStatusChatTemplates) => {
    setChatTemplates((prev) => ({
      ...prev,
      [key]: DEFAULT_CHAT_TEMPLATES[key],
    }));
  };

  // Mock order for live template preview
  const sampleOrder: Order = {
    id: 'sample-01',
    orderNumber: 'SAR-2026-8942',
    createdAt: new Date().toISOString(),
    customer: {
      name: 'Priyanka Sharma',
      phone: '+91 98765 43210',
      email: 'priyanka@example.com',
      address: '42 Lotus Enclave, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
    },
    items: [
      {
        product: {
          id: 'sample-p1',
          productCode: 'AARA-KAN-CRIM-101',
          title: 'Maharani Shrimant Kanjivaram Silk',
          subtitle: 'Pure Mulberry Silk with Pure Gold Zari',
          description: '',
          fabric: 'Kanjivaram Silk',
          color: 'Crimson Red',
          price: 34500,
          stockStatus: 'in_stock',
          stockCount: 3,
          isVisible: true,
          images: [],
          weaveDetails: 'Korvai',
          borderType: 'Temple Border',
          blousePieceIncluded: true,
          lengthMeters: 6.3,
          occasion: 'Bridal',
          createdAt: '',
        },
        quantity: 1,
      },
    ],
    subtotal: 34500,
    shippingFee: 0,
    totalAmount: 34500,
    upiTransactionId: '984521748291',
    refundDetails: {
      refundUpiId: 'priyanka@okaxis',
      refundUpiPhone: '+91 98765 43210',
      refundStatus: activeChatTab === 'refunded' ? 'processed' : 'pending',
      refundUtr: 'REF-78912401',
    },
    shippingDetails: {
      courierName: 'BlueDart Air Express',
      trackingNumber: 'BD-84729180',
    },
    status:
      activeChatTab === 'refunded'
        ? 'Cancelled'
        : (activeChatTab.charAt(0).toUpperCase() + activeChatTab.slice(1) as any),
    checkoutMethod: 'submit_order',
    cancellationReason: 'Weaver pit loom backlog / fabric sold out',
    assignedStaffName: 'Gayatri Devi (Atelier Specialist)',
  };

  const livePreviewMessage = applyTemplateTokens(
    chatTemplates[activeChatTab] || '',
    sampleOrder,
    {
      ...settings,
      boutiqueName,
      instagramHandle,
    }
  );

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      logoUrl: logoUrl.trim(),
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
        heroBannerImageUrl: heroBannerImageUrl.trim(),
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
      chatTemplates,
      defaultStaffPermissions: staffPermissions,
      ...(isAdmin ? { adminPin: adminPin.trim() || '889988' } : {}),
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Check section visibility permissions for staff
  const canViewStorefront = isAdmin || currentPermissions?.settingsStorefront?.canView !== false;
  const canEditStorefront = isAdmin || currentPermissions?.settingsStorefront?.canEdit !== false;

  const canViewAnnouncement = isAdmin || currentPermissions?.settingsAnnouncement?.canView !== false;
  const canEditAnnouncement = isAdmin || currentPermissions?.settingsAnnouncement?.canEdit !== false;

  const canViewPayment = isAdmin || currentPermissions?.settingsPayment?.canView !== false;
  const canEditPayment = isAdmin || currentPermissions?.settingsPayment?.canEdit !== false;

  const canViewProfile = isAdmin || currentPermissions?.settingsProfile?.canView !== false;
  const canEditProfile = isAdmin || currentPermissions?.settingsProfile?.canEdit !== false;

  const canViewChatTemplates = isAdmin || currentPermissions?.settingsChatTemplates?.canView !== false;
  const canEditChatTemplates = isAdmin || currentPermissions?.settingsChatTemplates?.canEdit !== false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900">
            Store & Settings Manager
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Configure boutique logo, hero banner, public display, automated customer WhatsApp chats, and permissions
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
        {/* Section 1: Store Logo & Brand Branding Uploads (User Request) */}
        {canViewStorefront && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2 text-rose-950 font-serif font-bold text-base sm:text-lg">
                <ImageIcon className="w-5 h-5 text-amber-600" />
                <h3>Store Logo & Hero Banner Customization</h3>
              </div>
              {!canEditStorefront && (
                <span className="text-[11px] text-neutral-500 font-medium bg-neutral-100 px-2.5 py-1 rounded-full">
                  View-Only
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Store Logo Upload Module */}
              <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-neutral-900">Store Logo Upload</label>
                  {logoUrl && canEditStorefront && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove Logo</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500">
                  Upload your boutique brand mark (PNG, SVG, JPG). It will appear in the main header and customer receipts.
                </p>

                {/* Logo Live Preview */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900 text-white border border-neutral-800">
                  <div className="h-12 w-28 bg-neutral-800/80 rounded-lg flex items-center justify-center overflow-hidden border border-neutral-700 shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Store Logo Preview" className="h-full w-full object-contain p-1" />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-rose-700 flex items-center justify-center text-amber-100 font-serif font-bold text-sm">
                        आ
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="font-serif font-bold text-sm text-amber-100 block">
                      {boutiqueName}
                    </span>
                    <span className="text-[10px] text-neutral-400">Header Preview</span>
                  </div>
                </div>

                {canEditStorefront && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="Paste logo image URL or use upload button →"
                        className="flex-1 p-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs"
                      />
                      <label className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold cursor-pointer flex items-center gap-1.5 shrink-0 transition">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Logo</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Hero Banner Upload Module */}
              <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-neutral-900">Hero Banner Upload</label>
                  {heroBannerImageUrl && canEditStorefront && (
                    <button
                      type="button"
                      onClick={() => setHeroBannerImageUrl('')}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset to Default</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500">
                  Upload the large panoramic banner shown at the top of your public storefront. Recommended: 1920×1080.
                </p>

                {/* Hero Banner Live Preview */}
                <div className="relative h-24 rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800">
                  <img
                    src={heroBannerImageUrl || '/src/assets/images/hero_saree_atelier_1791651761357.jpg'}
                    alt="Hero Banner Preview"
                    className="w-full h-full object-cover opacity-60"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/80 via-transparent to-transparent flex items-center p-3">
                    <div>
                      <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Storefront Hero Preview</p>
                      <p className="font-serif font-bold text-white text-xs truncate max-w-[200px]">{heroHeadline}</p>
                    </div>
                  </div>
                </div>

                {canEditStorefront && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={heroBannerImageUrl}
                        onChange={(e) => setHeroBannerImageUrl(e.target.value)}
                        placeholder="Paste hero image URL or use upload button →"
                        className="flex-1 p-2 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs"
                      />
                      <label className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold cursor-pointer flex items-center gap-1.5 shrink-0 transition">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Banner</span>
                        <input type="file" accept="image/*" onChange={handleHeroBannerUpload} className="hidden" />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Public Storefront Display & Content Controls */}
        {canViewStorefront && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-rose-950 font-serif font-bold text-base sm:text-lg">
                <LayoutTemplate className="w-5 h-5 text-amber-600" />
                <h3>Public Storefront Display & Visibility Controls</h3>
              </div>
              {!canEditStorefront && (
                <span className="text-[11px] text-neutral-500 font-medium bg-neutral-100 px-2.5 py-1 rounded-full">
                  View-Only
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              Control what shows on the public store front. Duplicate links have been cleaned up and Track Order is now managed via a single toggle below.
            </p>

            <div className="space-y-4 text-xs">
              {/* Toggles Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditStorefront}
                    checked={showHeroBanner}
                    onChange={(e) => setShowHeroBanner(e.target.checked)}
                    className="rounded text-rose-900"
                  />
                  <span className="font-semibold text-neutral-800">Show Hero Banner</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditStorefront}
                    checked={showTrustBadges}
                    onChange={(e) => setShowTrustBadges(e.target.checked)}
                    className="rounded text-rose-900"
                  />
                  <span className="font-semibold text-neutral-800">Show Trust Badges Strip</span>
                </label>

                {/* Single Clean Track Order Toggle (User Request) */}
                <label className="flex items-center gap-2 cursor-pointer bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                  <input
                    type="checkbox"
                    disabled={!canEditStorefront}
                    checked={showTrackOrder}
                    onChange={(e) => setShowTrackOrder(e.target.checked)}
                    className="rounded text-amber-700 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-neutral-900 block flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-amber-600" />
                      <span>Show 'Track Order' (Single Header Option)</span>
                    </span>
                    <span className="text-[10px] text-neutral-600 block">
                      Enable or disable order status tracking on the public storefront
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer sm:col-span-3 pt-2 border-t border-neutral-200">
                  <input
                    type="checkbox"
                    disabled={!canEditStorefront}
                    checked={allowPublicCancellation}
                    onChange={(e) => setAllowPublicCancellation(e.target.checked)}
                    className="rounded text-rose-900"
                  />
                  <div className="flex-1">
                    <span className="font-semibold text-neutral-800 block">
                      Enable Customer Order Cancellation Requests (Pending & Confirmed Only)
                    </span>
                    <span className="text-[11px] text-neutral-500 font-normal">
                      When enabled, customers can submit cancellation and refund requests while orders are in Pending or Confirmed state. Once shipped, cancellations are locked.
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
                    disabled={!canEditStorefront}
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
                    disabled={!canEditStorefront}
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
                    disabled={!canEditStorefront}
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
                    disabled={!canEditStorefront}
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
                        disabled={!canEditStorefront}
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
                        disabled={!canEditStorefront}
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
        )}

        {/* Section 3: Automated Customer Chat & WhatsApp Notification Templates (User Request) */}
        {canViewChatTemplates && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2 text-rose-950 font-serif font-bold text-base sm:text-lg">
                <MessageSquare className="w-5 h-5 text-amber-600" />
                <h3>Automated Customer Chat & WhatsApp Notification Templates</h3>
              </div>
              {!canEditChatTemplates && (
                <span className="text-[11px] text-neutral-500 font-medium bg-neutral-100 px-2.5 py-1 rounded-full">
                  View-Only
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500">
              Customize the automated chat comments and messages sent to customers for each order stage. Changes reflect immediately when sending WhatsApp updates from the order manager.
            </p>

            {/* Stage Selector Tabs */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-neutral-100 rounded-xl">
              {(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'rejected', 'refunded'] as (keyof OrderStatusChatTemplates)[]).map(
                (statusKey) => (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => setActiveChatTab(statusKey)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                      activeChatTab === statusKey
                        ? 'bg-neutral-900 text-white shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-200/60'
                    }`}
                  >
                    {statusKey}
                  </button>
                )
              )}
            </div>

            {/* Template Editing Area */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="font-bold text-neutral-900 text-xs">
                  Automated Message for: <span className="uppercase text-amber-700 font-mono">[{activeChatTab}]</span> Stage
                </label>
                {canEditChatTemplates && (
                  <button
                    type="button"
                    onClick={() => handleResetSingleTemplate(activeChatTab)}
                    className="inline-flex items-center gap-1 text-[11px] text-neutral-600 hover:text-rose-700 font-medium self-start"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset {activeChatTab} to Default</span>
                  </button>
                )}
              </div>

              {/* Dynamic Variable Insertion Chips */}
              {canEditChatTemplates && (
                <div>
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                    Click variable chip to insert placeholder:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      '{customerName}',
                      '{orderNumber}',
                      '{itemsSummary}',
                      '{totalAmount}',
                      '{upiTransactionId}',
                      '{trackingLink}',
                      '{courierName}',
                      '{trackingNumber}',
                      '{reasonNotice}',
                      '{refundUtr}',
                      '{refundUpi}',
                      '{staffSignature}',
                      '{boutiqueName}',
                      '{instagramHandle}',
                    ].map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => handleInsertToken(token)}
                        className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-mono font-semibold transition"
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Textarea */}
              <textarea
                rows={7}
                disabled={!canEditChatTemplates}
                value={chatTemplates[activeChatTab] || ''}
                onChange={(e) =>
                  setChatTemplates({
                    ...chatTemplates,
                    [activeChatTab]: e.target.value,
                  })
                }
                className="w-full p-3 rounded-xl border border-neutral-300 font-mono text-xs text-neutral-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
              />

              {/* Live Render Preview */}
              <div className="p-3.5 rounded-xl bg-neutral-900 text-emerald-300 border border-neutral-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] border-b border-neutral-800 pb-1.5">
                  <span className="font-bold text-amber-400 uppercase tracking-wider">
                    Customer WhatsApp Live Preview:
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">Sample Order #SAR-2026-8942</span>
                </div>
                <pre className="font-mono text-[11px] text-neutral-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {livePreviewMessage}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Staff Section Access & Visibility Permissions (Admin Only) (User Request) */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-rose-950 font-serif font-bold text-base sm:text-lg border-b border-neutral-100 pb-3">
              <Users className="w-5 h-5 text-amber-600" />
              <h3>Staff Section Visibility & Edit Permissions (Admin Controlled)</h3>
            </div>
            <p className="text-xs text-neutral-500">
              Configure which sections staff members can view and edit in the management portal. Admin password details are permanently hidden from all staff members.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Boutique Console Section</th>
                    <th className="py-2.5 px-3 text-center">Staff Can View</th>
                    <th className="py-2.5 px-3 text-center">Staff Can Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {[
                    { key: 'orders', label: 'Orders & Dispatch Management', hasEdit: true },
                    { key: 'products', label: 'Saree Catalog & Inventory', hasEdit: true },
                    { key: 'analytics', label: 'Sales Analytics & Revenue Reports', hasEdit: false },
                    { key: 'staff', label: 'Staff Accounts & Workload', hasEdit: true },
                    { key: 'settingsStorefront', label: 'Settings: Storefront Display & Logo/Banner', hasEdit: true },
                    { key: 'settingsAnnouncement', label: 'Settings: Announcement Board', hasEdit: true },
                    { key: 'settingsPayment', label: 'Settings: Payment & UPI Configuration', hasEdit: true },
                    { key: 'settingsProfile', label: 'Settings: Boutique Profile & Contact', hasEdit: true },
                    { key: 'settingsChatTemplates', label: 'Settings: Automated Customer Chat Templates', hasEdit: true },
                  ].map((row) => {
                    const perm = (staffPermissions as any)[row.key] || { canView: true, canEdit: false };
                    return (
                      <tr key={row.key} className="hover:bg-neutral-50/50">
                        <td className="py-2.5 px-3 font-semibold text-neutral-800">{row.label}</td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={perm.canView}
                            onChange={(e) =>
                              setStaffPermissions((prev) => ({
                                ...prev,
                                [row.key]: {
                                  ...(prev as any)[row.key],
                                  canView: e.target.checked,
                                },
                              }))
                            }
                            className="rounded text-amber-600 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {row.hasEdit ? (
                            <input
                              type="checkbox"
                              checked={perm.canEdit}
                              disabled={!perm.canView}
                              onChange={(e) =>
                                setStaffPermissions((prev) => ({
                                  ...prev,
                                  [row.key]: {
                                    ...(prev as any)[row.key],
                                    canEdit: e.target.checked,
                                  },
                                }))
                              }
                              className="rounded text-amber-600 w-4 h-4 cursor-pointer disabled:opacity-30"
                            />
                          ) : (
                            <span className="text-neutral-400 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 5: Storefront Announcement / Comments Board */}
        {canViewAnnouncement && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-rose-950 font-serif font-bold text-base sm:text-lg">
                <Megaphone className="w-5 h-5 text-amber-600" />
                <h3>Storefront Announcement / Comments Board</h3>
              </div>
              {!canEditAnnouncement && (
                <span className="text-[11px] text-neutral-500 font-medium bg-neutral-100 px-2.5 py-1 rounded-full">
                  View-Only
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              Type custom notices, festive offers, holiday dispatch schedules, or live updates to instantly display on the public storefront ticker.
            </p>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="announcementToggle"
                  disabled={!canEditAnnouncement}
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
                  disabled={!canEditAnnouncement}
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
        )}

        {/* Section 6: Payment Configuration (UPI ID & Downloadable QR Code) */}
        {canViewPayment && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-neutral-900 font-serif font-bold text-base sm:text-lg">
                <CreditCard className="w-5 h-5 text-amber-600" />
                <h3>Payment Configuration (Prepaid UPI)</h3>
              </div>
              {!canEditPayment && (
                <span className="text-[11px] text-neutral-500 font-medium bg-neutral-100 px-2.5 py-1 rounded-full">
                  View-Only
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              Customers will see these exact UPI payment coordinates and downloadable QR code during checkout before submitting their orders.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-800 mb-1">Business UPI ID *</label>
                <input
                  type="text"
                  disabled={!canEditPayment}
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
                  disabled={!canEditPayment}
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
                    disabled={!canEditPayment}
                    value={qrCodeUrl}
                    onChange={(e) => setQrCodeUrl(e.target.value)}
                    placeholder="Leave empty to use automatic live UPI QR generator, or paste image URL"
                    className="flex-1 p-2 rounded-xl border border-neutral-300 text-neutral-900"
                  />
                  {canEditPayment && (
                    <label className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-700 font-medium cursor-pointer flex items-center gap-1 shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload QR</span>
                      <input type="file" accept="image/*" onChange={handleQrUpload} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 7: Boutique Profile & Contact Information */}
        {canViewProfile && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-neutral-900 font-serif font-bold text-base sm:text-lg">
                <Building className="w-5 h-5 text-amber-600" />
                <h3>Boutique Profile & Concierge Contacts</h3>
              </div>
              {!canEditProfile && (
                <span className="text-[11px] text-neutral-500 font-medium bg-neutral-100 px-2.5 py-1 rounded-full">
                  View-Only
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              Contact information used for WhatsApp order routing, header title, and customer receipts.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Boutique Name</label>
                <input
                  type="text"
                  disabled={!canEditProfile}
                  value={boutiqueName}
                  onChange={(e) => setBoutiqueName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Tagline</label>
                <input
                  type="text"
                  disabled={!canEditProfile}
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
                  disabled={!canEditProfile}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Email Address</label>
                <input
                  type="email"
                  disabled={!canEditProfile}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Instagram Handle</label>
                <input
                  type="text"
                  disabled={!canEditProfile}
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Boutique Address</label>
                <input
                  type="text"
                  disabled={!canEditProfile}
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 8: Store Theme & Color Palette */}
        {isAdmin && (
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
        )}

        {/* Section 9: Admin Master Security PIN & Reset Operations (PERMANENTLY NOT VISIBLE TO STAFF) */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-2 text-neutral-900 font-serif font-bold text-base sm:text-lg">
              <Key className="w-5 h-5 text-amber-600" />
              <h3>Admin Dashboard Security (Owner PIN)</h3>
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              This master security section and password details are permanently hidden from staff members. Only the boutique owner can view or edit this PIN.
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
        )}

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
