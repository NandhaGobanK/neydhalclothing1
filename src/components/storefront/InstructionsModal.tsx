import React, { useState } from 'react';
import {
  BookOpen,
  Smartphone,
  Laptop,
  Apple,
  CreditCard,
  Truck,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  X,
  Download,
  CheckCircle2,
  Phone,
  MessageSquare,
  Share2,
  PlusSquare,
  Zap,
  Info,
  Heart,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { formatPrice } from '../../utils/upi';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'installation' | 'ordering' | 'payment' | 'tracking' | 'care';
}

export const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'installation',
}) => {
  const { settings, setIsTrackOrderOpen } = useStore();
  const { isInstallable, isInstalled, platform, browserName, install } = usePWAInstall();

  const [activeTab, setActiveTab] = useState<
    'installation' | 'ordering' | 'payment' | 'tracking' | 'care'
  >(defaultTab);

  const [pwaPlatformTab, setPwaPlatformTab] = useState<'desktop' | 'android' | 'ios'>(
    platform || 'desktop'
  );
  const [installing, setInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    setInstalling(true);
    const success = await install();
    setInstalling(false);
    if (success) {
      setInstallSuccess(true);
      setTimeout(() => setInstallSuccess(false), 3000);
    }
  };

  const boutiqueTitle = settings.boutiqueName || 'Neydhal';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 text-neutral-900 my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-neutral-950 via-neutral-900 to-[#52126e] text-white flex items-center justify-between border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#7e1ba8] via-[#52126e] to-[#2d053f] flex items-center justify-center text-[#faebd7] font-serif font-bold text-lg shadow-lg ring-2 ring-amber-300/40 shrink-0">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={boutiqueTitle}
                  className="w-8 h-8 object-contain rounded-xl"
                />
              ) : (
                <span>N</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-serif text-lg sm:text-xl font-bold tracking-wide">
                  {boutiqueTitle} Store Instructions & Guide
                </h3>
                <span className="text-[10px] font-sans px-2.5 py-0.5 rounded-full bg-amber-400 text-neutral-950 font-bold uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                  <BookOpen className="w-3 h-3" />
                  <span>Shopper Handbook</span>
                </span>
              </div>
              <p className="text-xs text-amber-200/90 font-light mt-0.5">
                Complete instructions for App Installation, Saree Ordering, Instant UPI Payments & Tracking
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center gap-1 p-2 sm:p-3 bg-neutral-100 border-b border-neutral-200 overflow-x-auto no-scrollbar shrink-0">
          {[
            {
              id: 'installation',
              label: 'PWA App Installation',
              icon: Download,
              badge: 'PC, Android, iOS',
            },
            {
              id: 'ordering',
              label: 'How to Order Sarees',
              icon: Sparkles,
            },
            {
              id: 'payment',
              label: 'Instant UPI Payment',
              icon: CreditCard,
            },
            {
              id: 'tracking',
              label: 'Track Order & Courier',
              icon: Truck,
            },
            {
              id: 'care',
              label: 'Pure Silk Care',
              icon: Heart,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : 'bg-white hover:bg-neutral-200 text-neutral-700 border border-neutral-200/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-neutral-500'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-md font-semibold ${
                      isActive ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* TAB 1: PWA APP INSTALLATION */}
          {activeTab === 'installation' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-amber-50/60 p-4 sm:p-5 rounded-3xl border border-amber-300 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-neutral-950 font-bold text-sm sm:text-base">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  <h4>Cross-Platform Progressive Web App (PWA)</h4>
                </div>
                <p className="text-neutral-700 leading-relaxed text-xs">
                  {boutiqueTitle} is engineered with modern Progressive Web App (PWA) standards. You can install it directly onto your <strong>PC / Laptop (Windows & Mac)</strong>, <strong>Android phone</strong>, or <strong>Apple iPhone / iPad</strong> without visiting third-party app stores or consuming device storage.
                </p>
              </div>

              {/* Native 1-Click Install Banner if available */}
              {isInstallable && !isInstalled && (
                <div className="p-4 rounded-2xl bg-neutral-950 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-400 text-neutral-950 shrink-0 font-bold">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">
                        Your device is ready for 1-Click Installation!
                      </p>
                      <p className="text-neutral-400 text-xs">
                        Detected: {browserName}. Tap Install to add {boutiqueTitle} directly to your launcher.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={installing}
                    onClick={handleInstallClick}
                    className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>{installing ? 'Installing...' : 'Install Neydhal App'}</span>
                  </button>
                </div>
              )}

              {installSuccess && (
                <div className="p-3 bg-emerald-600 text-white text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Success! {boutiqueTitle} has been installed to your device launcher.</span>
                </div>
              )}

              {/* Sub-tabs for Operating Systems */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-200 pb-2.5">
                  <button
                    type="button"
                    onClick={() => setPwaPlatformTab('desktop')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      pwaPlatformTab === 'desktop'
                        ? 'bg-neutral-950 text-white'
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5 text-blue-400" />
                    <span>PC & Laptops (Windows / Mac)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPwaPlatformTab('android')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      pwaPlatformTab === 'android'
                        ? 'bg-neutral-950 text-white'
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Android Phones & Tablets</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPwaPlatformTab('ios')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      pwaPlatformTab === 'ios'
                        ? 'bg-neutral-950 text-white'
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    <Apple className="w-3.5 h-3.5 text-rose-400" />
                    <span>iPhone & iPad (iOS Safari)</span>
                  </button>
                </div>

                {/* Sub-content Desktop */}
                {pwaPlatformTab === 'desktop' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-neutral-900 text-xs">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                        <span>Via Browser Address Bar (Google Chrome & MS Edge)</span>
                      </div>
                      <p className="text-neutral-600 text-xs leading-relaxed">
                        On your PC or laptop, look to the right-hand corner of the browser address bar where the website URL is displayed. You will see an <strong>"Install app"</strong> icon (monitor with down arrow ⤓).
                      </p>
                      <div className="p-2.5 bg-white rounded-xl border border-neutral-200 text-neutral-800 text-[11px] font-medium flex items-center gap-2">
                        <Download className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Click the icon and select <strong>"Install"</strong>.</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-neutral-900 text-xs">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                        <span>Via Browser Menu Options</span>
                      </div>
                      <p className="text-neutral-600 text-xs leading-relaxed">
                        Click the <strong>three dots (⋮)</strong> at the top right of Chrome or Edge &rarr; Click <strong>"Save and Share"</strong> (or "Apps") &rarr; Select <strong>"Install Neydhal"</strong>.
                      </p>
                      <div className="p-2.5 bg-white rounded-xl border border-neutral-200 text-neutral-800 text-[11px] font-medium flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Neydhal will launch in its own standalone window with a desktop icon!</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-content Android */}
                {pwaPlatformTab === 'android' && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
                      <div>
                        <p className="font-bold text-neutral-900 text-xs">Tap Browser Menu (⋮)</p>
                        <p className="text-neutral-600 text-xs mt-0.5">
                          In Chrome or Samsung Internet, tap the three dots in the top right corner.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
                      <div>
                        <p className="font-bold text-neutral-900 text-xs">Choose "Install app" or "Add to Home screen"</p>
                        <p className="text-neutral-600 text-xs mt-0.5">
                          Select the install option. The high-resolution Neydhal icon will appear on your phone screen.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</span>
                      <div>
                        <p className="font-bold text-neutral-900 text-xs">1-Tap Direct Launch</p>
                        <p className="text-neutral-600 text-xs mt-0.5">
                          Open anytime with instant loading, offline catalog support, and full-screen silk showcase.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-content iOS */}
                {pwaPlatformTab === 'ios' && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
                      <div>
                        <p className="font-bold text-neutral-900 text-xs flex items-center gap-1.5">
                          <span>Tap the Share Button in Safari</span>
                          <Share2 className="w-3.5 h-3.5 text-blue-600" />
                        </p>
                        <p className="text-neutral-600 text-xs mt-0.5">
                          Open the Neydhal boutique in <strong>Safari</strong> on your iPhone or iPad. Tap the <strong>Share</strong> icon (square with upward arrow) on the bottom navigation bar.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
                      <div>
                        <p className="font-bold text-neutral-900 text-xs flex items-center gap-1.5">
                          <span>Tap "Add to Home Screen"</span>
                          <PlusSquare className="w-3.5 h-3.5 text-neutral-700" />
                        </p>
                        <p className="text-neutral-600 text-xs mt-0.5">
                          Scroll down through the share sheet options and tap <strong>"Add to Home Screen"</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</span>
                      <div>
                        <p className="font-bold text-neutral-900 text-xs">Tap "Add" in the Top Right</p>
                        <p className="text-neutral-600 text-xs mt-0.5">
                          Tap <strong>Add</strong>. Neydhal will be added as an app on your iOS home screen!
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: HOW TO ORDER */}
          {activeTab === 'ordering' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h4 className="font-serif text-base font-bold text-neutral-950 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <span>How to Select & Order Handloom Sarees</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                  <div className="w-7 h-7 rounded-full bg-neutral-950 text-white flex items-center justify-center font-bold text-xs">1</div>
                  <h5 className="font-bold text-neutral-900 text-xs uppercase tracking-wider">Explore Collections</h5>
                  <p className="text-neutral-600 text-xs leading-relaxed">
                    Filter by heritage fabrics: Pure Kanjivaram Silk, Banarasi Brocade, Soft Silk, or Linen. Click on any saree card to view loom details, zari purity, and close-up weave photos.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                  <div className="w-7 h-7 rounded-full bg-neutral-950 text-white flex items-center justify-center font-bold text-xs">2</div>
                  <h5 className="font-bold text-neutral-900 text-xs uppercase tracking-wider">Add to Silk Bag</h5>
                  <p className="text-neutral-600 text-xs leading-relaxed">
                    Select your preferred color shade if variants exist and tap <strong>"Add to Bag"</strong>. Review your total in the shopping drawer anytime.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                  <div className="w-7 h-7 rounded-full bg-neutral-950 text-white flex items-center justify-center font-bold text-xs">3</div>
                  <h5 className="font-bold text-neutral-900 text-xs uppercase tracking-wider">Instant Concierge Checkout</h5>
                  <p className="text-neutral-600 text-xs leading-relaxed">
                    Fill in your delivery address, phone number, and complete direct UPI payment. You will receive an instant order receipt and tracking number!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INSTANT UPI PAYMENT */}
          {activeTab === 'payment' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h4 className="font-serif text-base font-bold text-neutral-950 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span>Instant 100% Verified UPI Payment Flow</span>
              </h4>

              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 space-y-2">
                <p className="font-bold text-xs uppercase tracking-wider text-emerald-900">Zero Gateway Surcharges</p>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  We support direct peer-to-boutique UPI payments via Google Pay, PhonePe, Paytm, BHIM, Cred, and all major Indian banking UPI apps.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-neutral-950 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</div>
                  <div>
                    <p className="font-bold text-neutral-900 text-xs">Scan Dynamic QR Code or Tap UPI App</p>
                    <p className="text-neutral-600 text-xs mt-0.5">
                      On checkout, a dynamic boutique QR code and verified UPI ID ({settings.payment.upiId}) will be shown with your exact order amount.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-neutral-950 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</div>
                  <div>
                    <p className="font-bold text-neutral-900 text-xs">Complete Payment in your UPI App</p>
                    <p className="text-neutral-600 text-xs mt-0.5">
                      Authorize payment to payee <strong>{settings.payment.payeeName}</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-neutral-950 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</div>
                  <div>
                    <p className="font-bold text-neutral-900 text-xs">Submit 12-Digit UPI Reference Number (UTR)</p>
                    <p className="text-neutral-600 text-xs mt-0.5">
                      Enter the 12-digit transaction ID / UTR from your payment receipt to link with your saree order for priority packing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ORDER TRACKING */}
          {activeTab === 'tracking' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h4 className="font-serif text-base font-bold text-neutral-950 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <span>Order Tracking & Courier Delivery</span>
              </h4>

              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-blue-950 space-y-2">
                <p className="font-bold text-xs uppercase tracking-wider text-blue-900">Real-Time Dispatch Stages</p>
                <p className="text-xs text-blue-900 leading-relaxed">
                  Every order progresses through 4 clear stages: <strong>Pending</strong> (Payment verification) &rarr; <strong>Confirmed</strong> (Reserving handloom from weaver loom) &rarr; <strong>Shipped</strong> (Handed to courier with live tracking number) &rarr; <strong>Delivered</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                  <h5 className="font-bold text-neutral-900 text-xs">How to Track Your Order</h5>
                  <p className="text-neutral-600 text-xs leading-relaxed">
                    Click <strong>"Track Order"</strong> in the top header or bottom footer. Enter your Order Number (e.g. #NYD-1001) or customer phone number to see live status and courier tracking links.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      setIsTrackOrderOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                  >
                    <span>Open Order Tracker Now &rarr;</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-rose-950 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-rose-900">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Non-Delivery / Dispute Reporting</span>
                  </div>
                  <p className="text-rose-950 text-xs leading-relaxed">
                    If your tracking status displays "Delivered" but you have not physically received your parcel, tap <strong>"Report Delivery Issue"</strong> in the tracker. It routes immediately to our concierge and courier dispatch hub for swift investigation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PURE SILK CARE */}
          {activeTab === 'care' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h4 className="font-serif text-base font-bold text-neutral-950 flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-600" />
                <span>Pure Silk Handloom Preservation Instructions</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                  <h5 className="font-bold text-neutral-900 text-xs">Dry Clean Only</h5>
                  <p className="text-neutral-600 text-xs leading-relaxed">
                    Authentic pure mulberry silk and zari borders must always be dry-cleaned. Never machine-wash or soak in chlorinated water.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                  <h5 className="font-bold text-neutral-900 text-xs">Breathable Muslin Storage</h5>
                  <p className="text-neutral-600 text-xs leading-relaxed">
                    Wrap your heirloom saree in pure unbleached muslin or soft cotton cloth. Avoid plastic zip covers which trap moisture and tarnish gold zari.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                  <h5 className="font-bold text-neutral-900 text-xs">Refold Periodically</h5>
                  <p className="text-neutral-600 text-xs leading-relaxed">
                    Unfold and change the crease lines every 3 to 4 months to prevent permanent creasing along the heavy pallu and zari borders.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                  <h5 className="font-bold text-neutral-900 text-xs">Protecting Gold & Silver Zari</h5>
                  <p className="text-neutral-600 text-xs leading-relaxed">
                    Keep neem leaves or cloves in your wardrobe instead of harsh naphthalene balls. Never spray perfumes directly on zari work.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-neutral-600">
            {settings.contactPhone && (
              <a
                href={`tel:${settings.contactPhone}`}
                className="hover:text-amber-800 flex items-center gap-1 font-medium"
              >
                <Phone className="w-3.5 h-3.5 text-amber-600" />
                <span>{settings.contactPhone}</span>
              </a>
            )}
            <span className="text-neutral-300">·</span>
            <span>Concierge Atelier Support</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs transition shadow-xs cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
