import { CourierService } from '../types/store';

/**
 * Default fallback courier branch offices for the boutique in Salem / Tamil Nadu region.
 * Used whenever a courier partner is assigned on an order but not fully configured in settings.
 */
export const DEFAULT_COURIER_HUBS: Record<string, Omit<CourierService, 'id' | 'isActive'>> = {
  dtdc: {
    name: 'DTDC Express',
    code: 'DTDC',
    addressLine1: 'No. 14/B, Junction Main Road, Meyyanur',
    addressLine2: 'Near New Bus Stand Branch Hub',
    city: 'Salem',
    pincode: '636004',
    phone: '+91 427 244 8899',
    supportEmail: 'salem.dtdc@express.in',
    mapsUrl: 'https://maps.google.com/?q=DTDC+Express+Salem+New+Bus+Stand',
    trackingUrl: 'https://www.dtdc.in/tracking.asp',
    trackingUrlTemplate: 'https://www.dtdc.in/tracking/shipment-tracking.asp?strCnno=',
  },
  tpc: {
    name: 'The Professional Couriers',
    code: 'TPC',
    addressLine1: '45, Fort Main Road, Shevapet',
    addressLine2: 'Silk Bazaar Hub Desk',
    city: 'Salem',
    pincode: '636002',
    phone: '+91 427 221 4455',
    supportEmail: 'salem@tpcglobe.com',
    mapsUrl: 'https://maps.google.com/?q=The+Professional+Couriers+Salem+Shevapet',
    trackingUrl: 'https://www.tpcglobe.com/tracking',
    trackingUrlTemplate: 'https://www.tpcglobe.com/track/',
  },
  bluedart: {
    name: 'Blue Dart Express',
    code: 'BLUEDART',
    addressLine1: '2nd Floor, Saradha College Road, Alagapuram',
    addressLine2: 'Main Logistics Hub',
    city: 'Salem',
    pincode: '636016',
    phone: '+91 427 233 1122',
    supportEmail: 'bluedart.salem@bluedart.com',
    mapsUrl: 'https://maps.google.com/?q=Blue+Dart+Salem+Saradha+College+Road',
    trackingUrl: 'https://www.bluedart.com/tracking',
    trackingUrlTemplate: 'https://www.bluedart.com/tracking?trackNumber=',
  },
  speedpost: {
    name: 'India Post (Speed Post)',
    code: 'SPEEDPOST',
    addressLine1: 'Head Post Office, Collectorate Complex',
    addressLine2: 'Speed Post Parcel Counter Desk',
    city: 'Salem',
    pincode: '636001',
    phone: '+91 427 241 6260',
    supportEmail: 'customercare@indiapost.gov.in',
    mapsUrl: 'https://maps.google.com/?q=Head+Post+Office+Salem+Collectorate',
    trackingUrl: 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx',
    trackingUrlTemplate: 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?id=',
  },
  delhivery: {
    name: 'Delhivery Express',
    code: 'DELHIVERY',
    addressLine1: 'Plot No. 8, SIDCO Industrial Estate, Five Roads',
    addressLine2: 'Parcel Sorting Center',
    city: 'Salem',
    pincode: '636004',
    phone: '+91 427 290 8822',
    supportEmail: 'customer.support@delhivery.com',
    mapsUrl: 'https://maps.google.com/?q=Delhivery+Express+Salem+Five+Roads',
    trackingUrl: 'https://www.delhivery.com/',
    trackingUrlTemplate: 'https://www.delhivery.com/track/package/',
  },
  shadowfax: {
    name: 'Shadowfax Logistics',
    code: 'SHADOWFAX',
    addressLine1: '12/4, Omalur Main Road, Swarnapuri',
    addressLine2: 'E-commerce Hub Office',
    city: 'Salem',
    pincode: '636004',
    phone: '+91 427 291 3344',
    supportEmail: 'help@shadowfax.in',
    mapsUrl: 'https://maps.google.com/?q=Shadowfax+Salem+Swarnapuri',
    trackingUrl: 'https://tracker.shadowfax.in/',
    trackingUrlTemplate: 'https://tracker.shadowfax.in/?trackingId=',
  },
};

/**
 * Resolves courier service details from store settings or intelligent regional fallbacks.
 */
export const resolveCourierDetails = (
  courierName?: string,
  configuredCouriers?: CourierService[],
  destinationCity?: string
): CourierService => {
  const query = (courierName || '').trim().toLowerCase();

  // 1. Check configured couriers in store settings
  if (configuredCouriers && configuredCouriers.length > 0) {
    const matched = configuredCouriers.find(
      (c) =>
        c.name.toLowerCase().trim() === query ||
        c.code.toLowerCase().trim() === query ||
        (query && c.name.toLowerCase().includes(query)) ||
        (query && query.includes(c.name.toLowerCase()))
    );
    if (matched) return matched;
  }

  // 2. Check known regional hub defaults
  for (const [key, hub] of Object.entries(DEFAULT_COURIER_HUBS)) {
    if (
      query.includes(key) ||
      query.includes(hub.name.toLowerCase()) ||
      query.includes(hub.code.toLowerCase())
    ) {
      return {
        id: `courier-${key}-salem`,
        isActive: true,
        ...hub,
      };
    }
  }

  // 3. Fallback for custom/unspecified courier
  const displayName = courierName?.trim() || 'Express Courier Dispatch';
  const city = destinationCity?.trim() || 'Salem';
  const encodedName = encodeURIComponent(`${displayName} ${city} branch hub office`);

  return {
    id: `courier-custom-${Date.now()}`,
    name: displayName,
    code: displayName.slice(0, 4).toUpperCase(),
    addressLine1: `Branch Hub Office, Commercial Logistics Corridor`,
    addressLine2: `Local Delivery Sorting Center`,
    city: city,
    pincode: '636004',
    phone: '+91 427 244 8899',
    supportEmail: 'concierge@neydhal.in',
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodedName}`,
    trackingUrl: `https://www.google.com/search?q=${encodeURIComponent(`${displayName} tracking`)}`,
    trackingUrlTemplate: undefined,
    isActive: true,
  };
};

/**
 * Builds the direct official courier portal tracking URL for a specific consignment number.
 */
export const buildCourierTrackingUrl = (
  courier?: CourierService,
  courierName?: string,
  trackingNumber?: string
): string => {
  const cleanTracking = (trackingNumber || '').trim();

  // If a template is configured on the courier service
  if (courier?.trackingUrlTemplate && cleanTracking) {
    return `${courier.trackingUrlTemplate}${encodeURIComponent(cleanTracking)}`;
  }

  // If a direct tracking URL is configured
  if (courier?.trackingUrl) {
    return courier.trackingUrl;
  }

  // Intelligent carrier portal matching
  const name = (courierName || courier?.name || '').toLowerCase().trim();

  if (name.includes('dtdc')) {
    return cleanTracking
      ? `https://www.dtdc.in/tracking/shipment-tracking.asp?strCnno=${encodeURIComponent(cleanTracking)}`
      : 'https://www.dtdc.in/tracking.asp';
  }
  if (name.includes('professional') || name.includes('tpc')) {
    return cleanTracking
      ? `https://www.tpcglobe.com/track/${encodeURIComponent(cleanTracking)}`
      : 'https://www.tpcglobe.com/tracking';
  }
  if (name.includes('blue dart') || name.includes('bluedart')) {
    return cleanTracking
      ? `https://www.bluedart.com/tracking?trackNumber=${encodeURIComponent(cleanTracking)}`
      : 'https://www.bluedart.com/tracking';
  }
  if (name.includes('speed post') || name.includes('india post')) {
    return 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx';
  }
  if (name.includes('delhivery')) {
    return cleanTracking
      ? `https://www.delhivery.com/track/package/${encodeURIComponent(cleanTracking)}`
      : 'https://www.delhivery.com/';
  }
  if (name.includes('shadowfax')) {
    return cleanTracking
      ? `https://tracker.shadowfax.in/?trackingId=${encodeURIComponent(cleanTracking)}`
      : 'https://tracker.shadowfax.in/';
  }

  // Final fallback to a direct Google search query for the specific consignment number
  if (cleanTracking) {
    return `https://www.google.com/search?q=${encodeURIComponent(`${name || 'courier'} tracking ${cleanTracking}`)}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(`${name || 'courier'} tracking portal`)}`;
};

/**
 * Builds the direct Google Maps URL for the courier branch hub.
 */
export const buildCourierMapsUrl = (
  courier?: CourierService,
  courierName?: string,
  city?: string
): string => {
  if (courier?.mapsUrl && courier.mapsUrl.trim().startsWith('http')) {
    return courier.mapsUrl.trim();
  }

  const name = courier?.name || courierName || 'Courier Partner';
  const targetCity = courier?.city || city || 'Salem';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} branch hub office ${targetCity}`)}`;
};
