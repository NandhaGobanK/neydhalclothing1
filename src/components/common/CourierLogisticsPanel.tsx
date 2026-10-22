import React, { useState } from 'react';
import { CourierService } from '../../types/store';
import {
  resolveCourierDetails,
  buildCourierTrackingUrl,
  buildCourierMapsUrl,
} from '../../utils/courier';
import {
  Truck,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Copy,
  Check,
  Building,
  Navigation,
  Globe,
  ShieldCheck,
} from 'lucide-react';

interface CourierLogisticsPanelProps {
  courierName?: string;
  trackingNumber?: string;
  configuredCouriers?: CourierService[];
  customerCity?: string;
  customerState?: string;
  orderNumber?: string;
  customerName?: string;
  variant?: 'dispute' | 'standard';
  title?: string;
}

export const CourierLogisticsPanel: React.FC<CourierLogisticsPanelProps> = ({
  courierName,
  trackingNumber,
  configuredCouriers,
  customerCity,
  customerState,
  orderNumber,
  customerName,
  variant = 'dispute',
  title = 'Courier Logistics & Partner Hub Coordination',
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const courier = resolveCourierDetails(courierName, configuredCouriers, customerCity);
  const trackingUrl = buildCourierTrackingUrl(courier, courierName, trackingNumber);
  const mapsUrl = buildCourierMapsUrl(courier, courierName, customerCity);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isDispute = variant === 'dispute';

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-4 shadow-xs ${
        isDispute
          ? 'bg-gradient-to-br from-amber-50/90 via-white to-amber-50/60 border-amber-300 text-neutral-900'
          : 'bg-white border-neutral-200 text-neutral-900'
      }`}
    >
      {/* 1. Header Row: Courier Name, Code & Tracking Consignment Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500 text-neutral-950 font-bold shadow-2xs shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-serif font-bold text-sm sm:text-base text-neutral-950">
                {courier.name}
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                {courier.city} Branch Hub
              </span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-300">
                {courier.code}
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 mt-0.5">
              {title} · Official carrier logistics & parcel transit desk
            </p>
          </div>
        </div>

        {/* Consignment Number Badge with Click-to-Copy */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <span className="text-[11px] font-bold text-neutral-600">Consignment:</span>
          {trackingNumber ? (
            <div className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-amber-300 shadow-2xs font-mono font-bold text-xs text-neutral-950">
              <span>{trackingNumber}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(trackingNumber, 'tracking-copy')}
                className="p-1 hover:bg-neutral-100 rounded-lg text-neutral-600 hover:text-neutral-900 transition cursor-pointer"
                title="Copy Consignment Number"
              >
                {copiedKey === 'tracking-copy' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ) : (
            <span className="text-xs font-mono font-semibold text-neutral-500 bg-neutral-100 px-2 py-1 rounded-lg">
              Pending AWB Handover
            </span>
          )}
        </div>
      </div>

      {/* 2. Direct Action Links Toolbar (Tracking Link & Direct Google Maps Hub Link) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* ACTION 1: THE TRACKING LINK */}
        <a
          href={trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-xs flex items-center justify-center gap-2 text-center group cursor-pointer"
          title={`Open ${courier.name} online tracking portal`}
        >
          <Globe className="w-4 h-4 shrink-0 group-hover:rotate-12 transition-transform" />
          <span className="truncate">Track Consignment Online</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
        </a>

        {/* ACTION 2: DIRECT GOOGLE MAPS HUB LINK */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-xs flex items-center justify-center gap-2 text-center group cursor-pointer"
          title={`View ${courier.name} ${courier.city} Branch Hub on Google Maps`}
        >
          <MapPin className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
          <span className="truncate">Open Hub on Google Maps</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
        </a>

        {/* ACTION 3: CALL HUB OFFICE */}
        <a
          href={`tel:${courier.phone.replace(/[^0-9+]/g, '')}`}
          className="p-2.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-300 font-bold text-xs transition shadow-2xs flex items-center justify-center gap-2 text-center cursor-pointer"
          title={`Call ${courier.name} office: ${courier.phone}`}
        >
          <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">Call Hub Office</span>
        </a>

        {/* ACTION 4: EMAIL HUB DESK */}
        <a
          href={`mailto:${courier.supportEmail}?subject=${encodeURIComponent(
            `Delivery Dispute Investigation - Order #${orderNumber || ''} (Tracking #${trackingNumber || ''})`
          )}&body=${encodeURIComponent(
            `Namaste Hub Dispatch Team,\n\nWe are investigating a customer delivery dispute for consignment number: ${trackingNumber || 'N/A'} (Order #${orderNumber || 'N/A'}).\nCustomer: ${customerName || ''} (${customerCity || ''}, ${customerState || ''}).\n\nPlease provide the local delivery boy contact number, delivery attempt timestamps, and receiver Proof-of-Delivery (POD) signature image.\n\nWarm regards,\nBoutique Concierge`
          )}`}
          className="p-2.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-300 font-bold text-xs transition shadow-2xs flex items-center justify-center gap-2 text-center cursor-pointer"
          title={`Email ${courier.name} support: ${courier.supportEmail}`}
        >
          <Mail className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="truncate">Email Hub Desk</span>
        </a>
      </div>

      {/* 3. Detailed Courier Logistics Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Local Branch Hub Office Address */}
        <div className="p-3 bg-white/95 rounded-xl border border-amber-200/90 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-amber-700" />
              <span>Local Branch Hub Office Address</span>
            </span>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(
                  `${courier.addressLine1}, ${courier.addressLine2 ? courier.addressLine2 + ', ' : ''}${courier.city} - ${courier.pincode}`,
                  'address-copy'
                )
              }
              className="text-[10px] text-amber-800 hover:text-amber-950 font-semibold flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'address-copy' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Address</span>
                </>
              )}
            </button>
          </div>

          <p className="font-semibold text-neutral-950 leading-snug">
            {courier.name} {courier.city} Main Logistics Office
          </p>
          <p className="text-neutral-700 leading-relaxed text-[11px]">
            {courier.addressLine1}
            {courier.addressLine2 ? `, ${courier.addressLine2}` : ''}
            <br />
            {courier.city}, Tamil Nadu - <span className="font-mono font-bold text-neutral-900">{courier.pincode}</span>
          </p>

          <div className="pt-1">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-rose-700 hover:text-rose-900 font-bold text-[11px] underline"
            >
              <Navigation className="w-3 h-3" />
              <span>Direct Google Maps Pin Directions &rarr;</span>
            </a>
          </div>
        </div>

        {/* Contact Phone & Email Desk */}
        <div className="p-3 bg-white/95 rounded-xl border border-amber-200/90 space-y-2.5 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
            Direct Branch Contact Channels
          </span>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-600 text-[11px]">Direct Phone:</span>
              <a
                href={`tel:${courier.phone.replace(/[^0-9+]/g, '')}`}
                className="font-mono font-bold text-neutral-950 hover:text-amber-800 flex items-center gap-1"
              >
                <Phone className="w-3 h-3 text-emerald-600" />
                <span>{courier.phone}</span>
              </a>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-600 text-[11px]">Support Email:</span>
              <a
                href={`mailto:${courier.supportEmail}`}
                className="font-medium text-neutral-900 hover:text-blue-800 truncate max-w-[200px] flex items-center gap-1"
                title={courier.supportEmail}
              >
                <Mail className="w-3 h-3 text-blue-600 shrink-0" />
                <span className="truncate">{courier.supportEmail}</span>
              </a>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
              <span className="text-neutral-600 text-[11px]">Consignment ID:</span>
              <span className="font-mono font-bold text-neutral-950 bg-neutral-100 px-2 py-0.5 rounded text-[11px]">
                {trackingNumber || 'Pending'}
              </span>
            </div>
          </div>

          <div className="pt-0.5">
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-bold text-[11px] underline"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open Carrier Tracking Website &rarr;</span>
            </a>
          </div>
        </div>
      </div>

      {/* 4. Investigation Coordination Tip */}
      <div className="p-2.5 bg-amber-100/70 rounded-xl border border-amber-300/80 text-[11px] text-amber-950 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Concierge Dispute Guideline:</strong> When coordinating with the {courier.name} branch hub, request the last-mile delivery executive's run-sheet timestamp and physical Proof of Delivery (POD) signature image for consignment{' '}
          <strong className="font-mono text-neutral-900">{trackingNumber || 'ID'}</strong> before closing the dispute.
        </p>
      </div>
    </div>
  );
};
