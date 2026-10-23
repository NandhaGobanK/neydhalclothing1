import React, { useState, useRef, useEffect } from 'react';
import { Product } from '../../types/store';
import { useStore } from '../../context/StoreContext';
import { formatPrice } from '../../utils/upi';
import {
  X,
  Camera,
  Upload,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  Check,
  RotateCcw,
  Sliders,
  Download,
  Eye,
  AlertTriangle,
} from 'lucide-react';

interface VirtualTryOnModalProps {
  primaryProduct: Product;
  matchingProducts: Product[];
  onClose: () => void;
}

export const VirtualTryOnModal: React.FC<VirtualTryOnModalProps> = ({
  primaryProduct,
  matchingProducts,
  onClose,
}) => {
  const { addToCart, setIsCartOpen } = useStore();

  // Mode: 'preview' (initial mannequin with try-on CTA), 'camera' (live webcam stream), 'adjust' (user photo aligned on canvas)
  const [activeStep, setActiveStep] = useState<'preview' | 'camera' | 'adjust'>('preview');
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Selected products in ensemble to buy together
  const allEnsembleProducts = [primaryProduct, ...matchingProducts];
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    allEnsembleProducts.map((p) => p.id)
  );

  // Face adjustment controls for canvas
  const [scale, setScale] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(100);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [addedBundleSuccess, setAddedBundleSuccess] = useState<boolean>(false);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera tracks cleanly
  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Start webcam
  const handleStartCamera = async () => {
    setCameraError(null);
    setIsCapturing(true);
    setActiveStep('camera');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera is not supported on this device/browser. Please upload a photo instead.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      setCameraError(
        err.message || 'Unable to access your camera. Please check browser permissions or upload a portrait photo.'
      );
    } finally {
      setIsCapturing(false);
    }
  };

  // Capture snapshot from webcam
  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth || 640;
    tempCanvas.height = video.videoHeight || 480;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally for natural mirror feel
    ctx.translate(tempCanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.9);
    setUserPhotoUrl(dataUrl);
    stopCameraStream();
    setActiveStep('adjust');
  };

  // Upload photo file fallback
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setUserPhotoUrl(event.target.result as string);
        stopCameraStream();
        setActiveStep('adjust');
      }
    };
    reader.readAsDataURL(file);
  };

  // Reset face adjustments
  const handleResetAdjustments = () => {
    setScale(1.0);
    setPanX(0);
    setPanY(0);
    setRotation(0);
    setBrightness(100);
  };

  // Redraw canvas with mannequin + masked user face
  useEffect(() => {
    if (activeStep !== 'adjust') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mannequinImg = new Image();
    mannequinImg.crossOrigin = 'anonymous';
    // Use the generated mannequin image
    mannequinImg.src = '/assets/images/tryon_mannequin_base_1792785910915.jpg';

    mannequinImg.onload = () => {
      canvas.width = mannequinImg.naturalWidth || 600;
      canvas.height = mannequinImg.naturalHeight || 800;

      // 1. Draw mannequin base
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(mannequinImg, 0, 0, canvas.width, canvas.height);

      // If user photo exists, composite user's face onto the mannequin head oval
      if (userPhotoUrl) {
        const userImg = new Image();
        userImg.src = userPhotoUrl;
        userImg.onload = () => {
          ctx.save();

          // Target face coordinate area on the mannequin base:
          // In tryon_mannequin_base (3:4 aspect), head center is roughly x: 50%, y: 13.5%
          const headCenterX = canvas.width * 0.508 + panX;
          const headCenterY = canvas.height * 0.138 + panY;
          const faceRadiusX = canvas.width * 0.082 * scale;
          const faceRadiusY = canvas.height * 0.076 * scale;

          // Clip to smooth soft oval for natural face mapping
          ctx.beginPath();
          ctx.ellipse(headCenterX, headCenterY, faceRadiusX, faceRadiusY, (rotation * Math.PI) / 180, 0, Math.PI * 2);
          ctx.clip();

          // Apply brightness/contrast filter
          ctx.filter = `brightness(${brightness}%) contrast(105%)`;

          // Position user image inside face frame
          const userAspect = userImg.width / userImg.height;
          const drawH = faceRadiusY * 2.5;
          const drawW = drawH * userAspect;
          const drawX = headCenterX - drawW / 2;
          const drawY = headCenterY - drawH / 2;

          ctx.drawImage(userImg, drawX, drawY, drawW, drawH);
          ctx.restore();

          // Soft feathered gradient border around face for seamless skin blend
          ctx.save();
          const radialGlow = ctx.createRadialGradient(
            headCenterX,
            headCenterY,
            faceRadiusX * 0.8,
            headCenterX,
            headCenterY,
            faceRadiusX * 1.05
          );
          radialGlow.addColorStop(0, 'rgba(0,0,0,0)');
          radialGlow.addColorStop(1, 'rgba(180, 120, 80, 0.22)');
          ctx.fillStyle = radialGlow;
          ctx.beginPath();
          ctx.ellipse(headCenterX, headCenterY, faceRadiusX * 1.05, faceRadiusY * 1.05, (rotation * Math.PI) / 180, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        };
      }
    };
  }, [activeStep, userPhotoUrl, scale, panX, panY, rotation, brightness]);

  // Toggle selection of products in ensemble
  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  // Calculate ensemble total
  const selectedProducts = allEnsembleProducts.filter((p) =>
    selectedProductIds.includes(p.id)
  );
  const ensembleSubtotal = selectedProducts.reduce((sum, p) => sum + p.price, 0);
  const bundleDiscountAmount = Math.round(ensembleSubtotal * 0.05); // 5% ensemble bundle saving
  const ensembleGrandTotal = ensembleSubtotal - bundleDiscountAmount;

  // Add Complete Look to Bag
  const handleAddEnsembleToBag = () => {
    if (selectedProducts.length === 0) return;
    selectedProducts.forEach((prod) => {
      addToCart(prod, 1);
    });
    setAddedBundleSuccess(true);
    setTimeout(() => {
      setAddedBundleSuccess(false);
      onClose();
      setIsCartOpen(true);
    }, 900);
  };

  // Download snapshot
  const handleDownloadSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `Neydhal-Complete-Look-${primaryProduct.productCode}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold tracking-tight">
                Virtual Try-On & Complete Look
              </h2>
              <p className="text-xs text-neutral-400">
                Visualize how the complete saree, blouse, and jewelry drape on you
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Local Privacy Disclaimer Banner */}
        <div className="bg-emerald-950/90 text-emerald-100 px-4 py-2 text-xs flex items-center justify-between gap-2 border-b border-emerald-900/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium text-[11px] sm:text-xs">
              <strong>100% In-Browser Privacy:</strong> Your photo is processed locally in your browser memory and is never uploaded to any server or saved beyond this session.
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 shrink-0 hidden sm:inline-block">
            Private & Secure
          </span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 bg-neutral-50/50">
          {/* Left Column: Visual Try-On Display Canvas / Camera / Preview */}
          <div className="md:col-span-7 flex flex-col items-center justify-center">
            <div className="relative w-full max-w-sm aspect-3/4 rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-200 shadow-md flex items-center justify-center">
              {/* STEP 1: Initial Mannequin Preview */}
              {activeStep === 'preview' && (
                <div className="relative w-full h-full group">
                  <img
                    src="/assets/images/tryon_mannequin_base_1792785910915.jpg"
                    alt="Mannequin Wearing Ensemble"
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-5 text-white">
                    <span className="text-amber-400 text-xs font-bold tracking-wider uppercase mb-1">
                      Curated Ensemble
                    </span>
                    <h3 className="font-serif text-lg font-bold">
                      {primaryProduct.title}
                    </h3>
                    <p className="text-xs text-neutral-300 mt-0.5 line-clamp-2">
                      Paired with matching hand-embroidered blouse & temple jewelry
                    </p>

                    <div className="mt-4 flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={handleStartCamera}
                        disabled={isCapturing}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>{isCapturing ? 'Starting Camera...' : 'Take Live Selfie'}</span>
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="py-2.5 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs flex items-center justify-center gap-2 backdrop-blur-xs transition cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Upload Photo</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Live Camera View */}
              {activeStep === 'camera' && (
                <div className="relative w-full h-full bg-black flex flex-col items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  {/* Face Guide Oval */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-44 h-56 rounded-[50%] border-2 border-dashed border-amber-400/90 shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center justify-center">
                      <span className="text-[11px] font-semibold text-amber-300 bg-black/60 px-2.5 py-1 rounded-full">
                        Align Face Here
                      </span>
                    </div>
                  </div>

                  {cameraError ? (
                    <div className="absolute inset-0 bg-neutral-900/95 p-6 flex flex-col items-center justify-center text-center text-white">
                      <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                      <p className="text-xs text-neutral-300 mb-4">{cameraError}</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="py-2.5 px-4 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs"
                      >
                        Upload Portrait Photo Instead
                      </button>
                      <button
                        onClick={() => {
                          stopCameraStream();
                          setActiveStep('preview');
                        }}
                        className="mt-3 text-xs text-neutral-400 hover:text-white underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="absolute bottom-4 inset-x-4 flex items-center justify-between">
                      <button
                        onClick={() => {
                          stopCameraStream();
                          setActiveStep('preview');
                        }}
                        className="py-2 px-3 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-semibold backdrop-blur-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCaptureSnapshot}
                        className="py-3 px-5 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-2 shadow-xl shadow-amber-500/30 transform active:scale-95 transition"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Capture Selfie</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Adjusted Composite Canvas */}
              {activeStep === 'adjust' && (
                <div className="relative w-full h-full flex items-center justify-center">
                  <canvas ref={canvasRef} className="w-full h-full object-cover" />

                  {/* Top Canvas Action Overlay */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <button
                      onClick={() => setShowControls(!showControls)}
                      className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs backdrop-blur-xs transition"
                      title="Toggle face adjustment sliders"
                    >
                      <Sliders className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleDownloadSnapshot}
                      className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs backdrop-blur-xs transition"
                      title="Download look snapshot"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setUserPhotoUrl(null);
                        setActiveStep('preview');
                      }}
                      className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs backdrop-blur-xs transition"
                      title="Retake photo"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Face Adjustment Sliders when in 'adjust' step */}
            {activeStep === 'adjust' && showControls && (
              <div className="w-full max-w-sm mt-3 p-3.5 bg-white rounded-2xl border border-neutral-200 shadow-xs space-y-2.5 text-xs animate-in fade-in">
                <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
                  <span className="font-bold text-neutral-800 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-600" />
                    <span>Fine-Tune Face Alignment</span>
                  </span>
                  <button
                    onClick={handleResetAdjustments}
                    className="text-[11px] text-neutral-500 hover:text-neutral-900 underline"
                  >
                    Reset
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="text-neutral-500 block mb-1">Face Size ({scale.toFixed(1)}x)</label>
                    <input
                      type="range"
                      min="0.6"
                      max="1.5"
                      step="0.05"
                      value={scale}
                      onChange={(e) => setScale(parseFloat(e.target.value))}
                      className="w-full accent-amber-600"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-500 block mb-1">Tilt / Angle ({rotation}°)</label>
                    <input
                      type="range"
                      min="-25"
                      max="25"
                      step="1"
                      value={rotation}
                      onChange={(e) => setRotation(parseInt(e.target.value))}
                      className="w-full accent-amber-600"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-500 block mb-1">Position Up/Down</label>
                    <input
                      type="range"
                      min="-40"
                      max="40"
                      step="2"
                      value={panY}
                      onChange={(e) => setPanY(parseInt(e.target.value))}
                      className="w-full accent-amber-600"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-500 block mb-1">Position Left/Right</label>
                    <input
                      type="range"
                      min="-40"
                      max="40"
                      step="2"
                      value={panX}
                      onChange={(e) => setPanX(parseInt(e.target.value))}
                      className="w-full accent-amber-600"
                    />
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <span className="text-[11px] text-neutral-500 shrink-0">Lighting:</span>
                  <input
                    type="range"
                    min="70"
                    max="140"
                    step="5"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    className="w-full accent-amber-600"
                  />
                  <span className="text-[11px] text-neutral-700 font-mono w-9 text-right">
                    {brightness}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Complete Look Ensemble & 1-Click Bundle Purchase */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="mb-3">
                <span className="text-amber-800 text-[11px] font-bold uppercase tracking-wider bg-amber-100/70 px-2 py-0.5 rounded-full border border-amber-200">
                  Curated Match
                </span>
                <h3 className="font-serif text-xl font-bold text-neutral-900 mt-1">
                  Complete The Ensemble
                </h3>
                <p className="text-xs text-neutral-500">
                  Select the items you wish to include in your bridal bundle
                </p>
              </div>

              {/* Ensemble Items List */}
              <div className="space-y-2.5">
                {allEnsembleProducts.map((item, idx) => {
                  const isChecked = selectedProductIds.includes(item.id);
                  const isPrimary = item.id === primaryProduct.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleProduct(item.id)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-center gap-3 ${
                        isChecked
                          ? 'border-neutral-900 bg-white shadow-xs'
                          : 'border-neutral-200 bg-neutral-100/60 opacity-60'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                          isChecked
                            ? 'bg-neutral-900 border-neutral-900 text-white'
                            : 'border-neutral-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </div>

                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200">
                        <img
                          src={item.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            {item.category || (idx === 0 ? 'Saree' : idx === 1 ? 'Blouse' : 'Jewelry')}
                          </span>
                          {isPrimary && (
                            <span className="text-[10px] text-neutral-500 font-medium">
                              (Current Selection)
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-neutral-900 truncate mt-0.5">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold text-neutral-900 tabular-nums">
                            {formatPrice(item.price)}
                          </span>
                          {item.originalPrice && (
                            <span className="text-[10px] text-neutral-400 line-through tabular-nums">
                              {formatPrice(item.originalPrice)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Price & Bundle CTA Footer */}
            <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-neutral-600">
                  <span>Ensemble Subtotal ({selectedProducts.length} items)</span>
                  <span className="font-semibold text-neutral-900 tabular-nums">
                    {formatPrice(ensembleSubtotal)}
                  </span>
                </div>
                {selectedProducts.length > 1 && (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span className="font-medium">✨ Complete Look Ensemble Discount (5%)</span>
                    <span className="font-bold tabular-nums">-{formatPrice(bundleDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm font-bold text-neutral-950 pt-2 border-t border-neutral-100">
                  <span>Total Payable</span>
                  <span className="font-serif text-base text-neutral-950 tabular-nums">
                    {formatPrice(ensembleGrandTotal)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddEnsembleToBag}
                disabled={selectedProducts.length === 0}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition ${
                  addedBundleSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-amber-500/20'
                }`}
              >
                {addedBundleSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Added Complete Look to Bag!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      Add Complete Look to Bag ({selectedProducts.length}{' '}
                      {selectedProducts.length === 1 ? 'Item' : 'Items'})
                    </span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-neutral-500">
                Items can also be customized or removed anytime in your shopping bag.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
