import pincodesData from './pincodes.json';

export type DeliveryLocation = {
  pincode: string;
  city: string;
  district: string;
  source: 'gps' | 'manual';
  serviceable: boolean;
};

const LOCATION_KEY = 'fm:delivery';
const RECENT_KEY = 'fm:recent_pins';
export const DELIVERY_EVENT = 'delivery:updated';
export const OPEN_LOCATION_EVENT = 'delivery:open';

const PIN_RE = /^[1-9][0-9]{5}$/;

export function isValidPincode(pin: string): boolean {
  return PIN_RE.test(pin);
}

export function getSavedLocation(): DeliveryLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const loc = JSON.parse(raw) as DeliveryLocation;
    if (!isValidPincode(loc?.pincode || '')) return null;
    return loc;
  } catch {
    return null;
  }
}

export function getRecentPincodes(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((p) => isValidPincode(String(p))).slice(0, 4) : [];
  } catch {
    return [];
  }
}

function rememberPin(pin: string) {
  const next = [pin, ...getRecentPincodes().filter((p) => p !== pin)].slice(0, 4);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function saveLocation(loc: DeliveryLocation) {
  localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
  rememberPin(loc.pincode);
  window.dispatchEvent(new CustomEvent(DELIVERY_EVENT, { detail: loc }));
}

export function lookupServiceable(pincode: string) {
  return pincodesData.find((p) => p.pincode === pincode) || null;
}

export function expectedDeliveryLabel(serviceable: boolean): string {
  if (!serviceable) return '';
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return `Get it by ${date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}`;
}

export async function resolvePincode(pincode: string, source: 'gps' | 'manual'): Promise<DeliveryLocation> {
  const pin = pincode.trim();
  if (!isValidPincode(pin)) {
    throw new Error('Enter a valid 6-digit PIN code.');
  }

  const known = lookupServiceable(pin);
  if (known) {
    return {
      pincode: pin,
      city: known.city,
      district: known.district,
      source,
      serviceable: true,
    };
  }

  let city = 'this area';
  let district = '';
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      const office = data?.[0]?.PostOffice?.[0];
      if (office) {
        city = office.District || office.Name || city;
        district = office.State || '';
      }
    }
  } catch {
    /* keep fallback labels */
  }

  return { pincode: pin, city, district, source, serviceable: false };
}

export async function resolveFromGps(): Promise<DeliveryLocation> {
  if (!navigator.geolocation) {
    throw new Error('GPS is not available on this device. Enter your PIN instead.');
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60_000,
    });
  });

  const { latitude, longitude } = position.coords;
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Could not read your location. Enter PIN instead.');

  const geo = await res.json();
  const pin = String(geo.postcode || geo.postCode || '').replace(/\D/g, '').slice(0, 6);
  if (!isValidPincode(pin)) {
    throw new Error('Could not detect a PIN from GPS. Please enter it manually.');
  }

  return resolvePincode(pin, 'gps');
}

export function gpsErrorMessage(err: unknown): string {
  const code = (err as GeolocationPositionError)?.code;
  if (code === 1) return 'Location permission denied. Enter your PIN instead.';
  if (code === 2) return 'GPS signal not found. Enter your PIN instead.';
  if (code === 3) return 'Location timed out. Enter your PIN instead.';
  return err instanceof Error ? err.message : 'Could not use GPS. Enter your PIN instead.';
}
