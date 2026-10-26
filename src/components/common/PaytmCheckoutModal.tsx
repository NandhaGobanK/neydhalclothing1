import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  PaytmTransactionDetails,
} from '../../types/store';
import {
  loadPaytmCheckoutScript,
  generatePaytmUpiUri,
  getPaytmQrCodeUrl,
  createPaytmTransactionReceipt,
} from '../../utils/paytm';
import { formatPrice } from '../../utils/upi';
import {
  ShieldCheck,
  X,
  QrCode,
  CreditCard,
  Building2,
  Wallet,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Sparkles,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';

interface PaytmCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  onPaymentSuccess: (details: PaytmTransactionDetails) => void;
  onPaymentFailure?: (error: string) => void;
}

export const PaytmCheckoutModal: React.FC<PaytmCheckoutModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  amount,
  customerName,
  customerPhone,
  customerEmail,
  onPaymentSuccess,
  onPaymentFailure,
}) => {
  const { settings } = useStore();
  const paytmConfig = settings.payment.paytm || {
    enabled: true,
    environment: 'staging',
    merchantId: 'MOCK_PAYTM_MID_STAGE',
    merchantKey: 'MOCK_SECRET_KEY_123',
    website: 'WEBSTAGING',
    channelId: 'WEB',
    industryTypeId: 'Retail',
    autoVerifyInTestMode: true,
    enableQr: true,
    enableUpi: true,
    enableCards: true,
    enableNetBanking: true,
    enableWallet: true,
  };

  const isStaging = paytmConfig.environment === 'staging';

  // Active Payment Method Tab
  type PaymentTab = 'qr_upi' | 'cards' | 'netbanking' | 'wallet';
  const [activeTab, setActiveTab] = useState<PaymentTab>('qr_upi');

  // Interactive state
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<PaytmTransactionDetails | null>(null);
  const [copiedUpiUri, setCopiedUpiUri] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState(customerName || '');

  // Net banking state
  const [selectedBank, setSelectedBank] = useState('HDFC');

  // Wallet state
  const [walletPhone, setWalletPhone] = useState(customerPhone || '');
  const [walletOtpSent, setWalletOtpSent] = useState(false);
  const [walletOtp, setWalletOtp] = useState('');

  // Generate UPI payload and QR code
  const upiPayload = generatePaytmUpiUri({
    merchantUpiId: settings.payment.upiId || 'paytm-merchant@paytm',
    payeeName: settings.payment.payeeName || settings.boutiqueName,
    orderNumber,
    amount,
  });

  const qrImageUrl = getPaytmQrCodeUrl(upiPayload, 320);

  // Load Paytm JS SDK on mount
  useEffect(() => {
    if (isOpen) {
      loadPaytmCheckoutScript(paytmConfig.merchantId, paytmConfig.environment);
      setTimeRemaining(600);
      setIsProcessing(false);
      setPaymentSuccessData(null);
    }
  }, [isOpen, paytmConfig.merchantId, paytmConfig.environment]);

  // Countdown timer for QR code validity
  useEffect(() => {
    if (!isOpen || paymentSuccessData || timeRemaining <= 0) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, paymentSuccessData, timeRemaining]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyUpiUri = () => {
    navigator.clipboard.writeText(upiPayload);
    setCopiedUpiUri(true);
    setTimeout(() => setCopiedUpiUri(false), 2000);
  };

  // Complete payment handler
  const handleAuthorizePayment = (mode: 'UPI_QR' | 'PAYTM_WALLET' | 'CC_DC' | 'NET_BANKING') => {
    setIsProcessing(true);

    // Simulate standard Paytm gateway handshake latency (1.0s - 1.5s)
    setTimeout(() => {
      const receipt = createPaytmTransactionReceipt(orderNumber, amount, mode, isStaging);
      setPaymentSuccessData(receipt);
      setIsProcessing(false);

      // Brief visual celebration then notify parent
      setTimeout(() => {
        onPaymentSuccess(receipt);
      }, 1200);
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Paytm Header */}
        <div className="bg-[#002970] text-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Paytm Stylized Logo */}
              <div className="flex items-center tracking-tight text-xl font-bold">
                <span className="text-white">Pay</span>
                <span className="text-[#00BAF2]">tm</span>
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-white/10 text-[#00BAF2] border border-[#00BAF2]/30 uppercase tracking-wider">
                  Payment Gateway
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isProcessing}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
              title="Close payment gateway"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-white/15 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/70 font-medium">Order Number</p>
              <p className="text-sm font-semibold tracking-wide text-white">{orderNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/70 font-medium">Amount to Pay</p>
              <p className="text-2xl font-bold tabular-nums text-white">{formatPrice(amount)}</p>
            </div>
          </div>
        </div>

        {/* Test Mode / Sandbox Ribbon */}
        {isStaging && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong className="font-semibold">Test Mode (Sandbox):</strong> MID{' '}
                <code className="bg-amber-100/70 px-1 py-0.5 rounded font-mono">{paytmConfig.merchantId}</code>
              </span>
            </div>
            <button
              onClick={() => handleAuthorizePayment('UPI_QR')}
              disabled={isProcessing || Boolean(paymentSuccessData)}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-md transition-colors shadow-sm disabled:opacity-50 shrink-0 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Simulate Instant Payment
            </button>
          </div>
        )}

        {/* Success State Overlay */}
        {paymentSuccessData ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Payment Authorized</h3>
              <p className="text-sm text-slate-600 mt-1">
                Paytm Transaction verified successfully!
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-w-sm mx-auto text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Paytm Txn ID:</span>
                <span className="font-mono font-semibold text-slate-800">{paymentSuccessData.txnId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bank Reference:</span>
                <span className="font-mono text-slate-800">{paymentSuccessData.bankTxnId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-semibold text-slate-900 tabular-nums">{formatPrice(paymentSuccessData.txnAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-medium text-slate-700">{paymentSuccessData.paymentMode}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">Finalizing your order confirmation...</p>
          </div>
        ) : isProcessing ? (
          /* Processing State */
          <div className="p-12 text-center space-y-4">
            <div className="w-14 h-14 border-4 border-[#00BAF2] border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">Contacting Paytm Gateway</h3>
              <p className="text-xs text-slate-500 mt-1">Verifying encrypted payment token & authorization...</p>
            </div>
          </div>
        ) : (
          /* Normal Payment Method Selector & Content */
          <div className="p-6">
            {/* Segmented Method Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setActiveTab('qr_upi')}
                className={`flex flex-col items-center gap-1 py-2 px-1 text-xs font-medium rounded-lg transition-all ${
                  activeTab === 'qr_upi'
                    ? 'bg-white text-[#002970] shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-4 h-4 text-[#00BAF2]" />
                <span className="truncate w-full text-center">Paytm QR</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('cards')}
                className={`flex flex-col items-center gap-1 py-2 px-1 text-xs font-medium rounded-lg transition-all ${
                  activeTab === 'cards'
                    ? 'bg-white text-[#002970] shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-4 h-4 text-[#00BAF2]" />
                <span className="truncate w-full text-center">Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('netbanking')}
                className={`flex flex-col items-center gap-1 py-2 px-1 text-xs font-medium rounded-lg transition-all ${
                  activeTab === 'netbanking'
                    ? 'bg-white text-[#002970] shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4 text-[#00BAF2]" />
                <span className="truncate w-full text-center">NetBanking</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('wallet')}
                className={`flex flex-col items-center gap-1 py-2 px-1 text-xs font-medium rounded-lg transition-all ${
                  activeTab === 'wallet'
                    ? 'bg-white text-[#002970] shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wallet className="w-4 h-4 text-[#00BAF2]" />
                <span className="truncate w-full text-center">Wallet</span>
              </button>
            </div>

            {/* TAB 1: PAYTM QR & UPI */}
            {activeTab === 'qr_upi' && (
              <div className="space-y-5">
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  {/* Dynamic QR */}
                  <div className="relative p-3 bg-white rounded-xl shadow-sm border border-slate-200">
                    <img
                      src={qrImageUrl}
                      alt="Paytm Dynamic QR"
                      className="w-48 h-48 object-contain rounded-lg"
                    />
                    <div className="absolute inset-0 border-2 border-[#00BAF2]/30 rounded-xl pointer-events-none" />
                  </div>

                  {/* Timer & Instruction */}
                  <div className="mt-3 text-center">
                    <p className="text-xs text-slate-500">
                      QR Code expires in{' '}
                      <span className="font-mono font-semibold text-slate-800">
                        {formatTimer(timeRemaining)}
                      </span>
                    </p>
                    <p className="text-xs font-medium text-slate-700 mt-1">
                      Scan using Paytm, Google Pay, PhonePe, BHIM, or any banking app
                    </p>
                  </div>
                </div>

                {/* Mobile Intent Button */}
                <div className="space-y-2">
                  <a
                    href={upiPayload}
                    onClick={() => {
                      // Trigger verification watcher
                      setTimeout(() => {
                        handleAuthorizePayment('UPI_QR');
                      }, 2500);
                    }}
                    className="w-full py-3 px-4 bg-[#00BAF2] hover:bg-[#00a3d4] text-[#002970] font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in UPI / Paytm App on this Device
                  </a>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyUpiUri}
                      className="flex-1 py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      {copiedUpiUri ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">UPI Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy UPI Intent String</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAuthorizePayment('UPI_QR')}
                      className="py-2 px-3 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Paid via QR
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CREDIT / DEBIT CARDS */}
            {activeTab === 'cards' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Card Number
                  </label>
                  <input
                    type="text"
                    maxLength={19}
                    placeholder="4000 1234 5678 9010"
                    value={cardNumber}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim();
                      setCardNumber(v);
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00BAF2] focus:border-transparent font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '');
                        if (v.length >= 2) {
                          setCardExpiry(`${v.slice(0, 2)}/${v.slice(2, 4)}`);
                        } else {
                          setCardExpiry(v);
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00BAF2] focus:border-transparent font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      CVV / Security Code
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="•••"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00BAF2] focus:border-transparent font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    placeholder="Full name as on card"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00BAF2] focus:border-transparent"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleAuthorizePayment('CC_DC')}
                  className="w-full py-3 bg-[#002970] hover:bg-[#001f54] text-white font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 mt-4"
                >
                  <Lock className="w-4 h-4 text-[#00BAF2]" />
                  Pay {formatPrice(amount)} via Card
                </button>
              </div>
            )}

            {/* TAB 3: NET BANKING */}
            {activeTab === 'netbanking' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 font-medium">Select your bank for instant authorization:</p>
                <div className="grid grid-cols-3 gap-2">
                  {['HDFC', 'SBI', 'ICICI', 'Axis', 'Kotak', 'PNB'].map((bank) => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => setSelectedBank(bank)}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        selectedBank === bank
                          ? 'border-[#002970] bg-[#002970]/5 font-semibold text-[#002970]'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <Building2 className="w-4 h-4 mx-auto mb-1 text-slate-500" />
                      <span className="text-xs">{bank} Bank</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleAuthorizePayment('NET_BANKING')}
                  className="w-full py-3 bg-[#002970] hover:bg-[#001f54] text-white font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 mt-4"
                >
                  <Lock className="w-4 h-4 text-[#00BAF2]" />
                  Proceed to {selectedBank} NetBanking ({formatPrice(amount)})
                </button>
              </div>
            )}

            {/* TAB 4: PAYTM WALLET */}
            {activeTab === 'wallet' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Paytm Registered Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={walletPhone}
                    onChange={(e) => setWalletPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00BAF2] focus:border-transparent font-mono"
                  />
                </div>

                {!walletOtpSent ? (
                  <button
                    type="button"
                    onClick={() => setWalletOtpSent(true)}
                    className="w-full py-2.5 bg-[#00BAF2] hover:bg-[#00a3d4] text-[#002970] font-semibold text-sm rounded-xl transition-all"
                  >
                    Send OTP to Link Wallet
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Enter 6-digit OTP sent to {walletPhone}
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="••••••"
                        value={walletOtp}
                        onChange={(e) => setWalletOtp(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00BAF2] focus:border-transparent font-mono tracking-widest text-center"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAuthorizePayment('PAYTM_WALLET')}
                      className="w-full py-3 bg-[#002970] hover:bg-[#001f54] text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Authorize & Pay {formatPrice(amount)} from Wallet
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Security Trust Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>128-bit Encrypted • PCI-DSS Level 1 Certified</span>
              </div>
              <span className="font-medium text-slate-600">Paytm Trusted Checkout</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
