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

export function extractPincode(text: string): string | null {
  const m = String(text || '').match(/\b([1-9][0-9]{5})\b/);
  return m ? m[1] : null;
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

async function fetchJson(url: string, timeoutMs = 8000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
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
  const data = await fetchJson(`https://api.postalpincode.in/pincode/${pin}`);
  const office = data?.[0]?.PostOffice?.[0];
  if (office) {
    city = office.District || office.Name || city;
    district = office.State || '';
  }

  return { pincode: pin, city, district, source, serviceable: false };
}

async function pinsForCity(city: string): Promise<string[]> {
  const q = city.replace(/urban|rural/gi, '').trim();
  if (q.length < 3) return [];
  const data = await fetchJson(`https://api.postalpincode.in/postoffice/${encodeURIComponent(q)}`);
  const offices = data?.[0]?.PostOffice;
  if (!Array.isArray(offices)) return [];
  const pins = offices.map((o: { Pincode?: string }) => String(o.Pincode || '')).filter(isValidPincode);
  return [...new Set(pins)].slice(0, 6);
}

type GeoHint = { pin?: string; city?: string; district?: string };

const PLACE_ALIASES: Record<string, string> = {
  bangalore: 'bengaluru',
  bengalooru: 'bengaluru',
  mysore: 'mysuru',
  mangalore: 'mangaluru',
  tumkur: 'tumakuru',
  belgaum: 'belagavi',
  gulbarga: 'kalaburagi',
  bijapur: 'vijayapura',
  shimoga: 'shivamogga',
  hospet: 'hosapete',
  hubli: 'hubballi',
};

function normalizePlace(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/urban|rural|district|city/g, ' ')
    .replace(/[^a-z]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchCatalogPlace(place: string) {
  const raw = normalizePlace(place);
  if (raw.length < 3) return null;
  const key = PLACE_ALIASES[raw.split(' ')[0]] || raw;
  const hits = pincodesData.filter((p) => {
    const c = normalizePlace(p.city);
    const d = normalizePlace(p.district);
    return c.includes(key) || d.includes(key) || key.includes(c) || key.includes(d);
  });
  if (!hits.length) return null;
  return hits.find((p) => p.pincode.endsWith('001')) || hits[0];
}

async function reverseGeocode(lat: number, lon: number): Promise<GeoHint> {
  const hint: GeoHint = {};
  const [bdc, nom, photon] = await Promise.all([
    fetchJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`, 7000),
    fetchJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, 7000),
    fetchJson(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`, 7000),
  ]);

  if (bdc) {
    hint.pin = extractPincode(String(bdc.postcode || bdc.postCode || '')) || hint.pin;
    hint.city = bdc.city || bdc.locality || bdc.localityInfo?.administrative?.[3]?.name || bdc.localityInfo?.administrative?.[2]?.name;
    hint.district = bdc.principalSubdivision;
  }
  const addr = nom?.address || {};
  hint.pin = hint.pin || extractPincode(JSON.stringify(nom || {})) || undefined;
  hint.city = hint.city || addr.city || addr.town || addr.village || addr.suburb || addr.county;
  hint.district = hint.district || addr.state_district || addr.state;

  const props = photon?.features?.[0]?.properties || {};
  hint.pin = hint.pin || extractPincode(JSON.stringify(props)) || undefined;
  hint.city = hint.city || props.city || props.name;
  hint.district = hint.district || props.state;

  if (!hint.pin && hint.city) {
    const catalog = matchCatalogPlace(hint.city) || matchCatalogPlace(hint.district || '');
    if (catalog) hint.pin = catalog.pincode;
    else {
      const cityPins = await pinsForCity(hint.city);
      hint.pin = cityPins[0];
    }
  }

  return hint;
}

/** Must be called directly from a tap/click so iOS/Android keep the user-gesture. */
export function requestBrowserLocation(): Promise<GeolocationPosition> {
  if (!('geolocation' in navigator)) {
    return Promise.reject(Object.assign(new Error('no-geo'), { code: 2 }));
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return Promise.reject(Object.assign(new Error('insecure'), { code: 1 }));
  }

  return new Promise((resolve, reject) => {
    const ok = (pos: GeolocationPosition) => resolve(pos);
    const retryPrecise: PositionErrorCallback = () => {
      navigator.geolocation.getCurrentPosition(ok, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
    };
    navigator.geolocation.getCurrentPosition(ok, retryPrecise, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 300000,
    });
  });
}

export async function completeFromCoords(lat: number, lon: number): Promise<DeliveryLocation> {
  const hint = await reverseGeocode(lat, lon);

  if (hint.pin && isValidPincode(hint.pin)) {
    return resolvePincode(hint.pin, 'gps');
  }

  const catalog = matchCatalogPlace(hint.city || '') || matchCatalogPlace(hint.district || '');
  if (catalog) {
    return resolvePincode(catalog.pincode, 'gps');
  }

  const suggestions = hint.city ? await pinsForCity(hint.city) : [];
  throw new GpsNeedsPinError(hint.city || '', suggestions);
}

export class GpsNeedsPinError extends Error {
  city: string;
  suggestions: string[];
  constructor(city: string, suggestions: string[] = []) {
    super(
      city
        ? `We found you near ${city}. Confirm the 6-digit PIN below.`
        : 'GPS found you, but not a PIN. Please enter it.'
    );
    this.name = 'GpsNeedsPinError';
    this.city = city;
    this.suggestions = suggestions;
  }
}

export function gpsErrorMessage(err: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'GPS works only on HTTPS. Open the live site, or enter your PIN.';
  }
  if (err instanceof GpsNeedsPinError) return err.message;
  const code = (err as GeolocationPositionError)?.code;
  if (code === 1) return 'Allow location in your phone browser (Safari/Chrome site settings), then try again — or enter PIN.';
  if (code === 2) return 'Couldn’t get a GPS signal. Move near a window, or enter PIN.';
  if (code === 3) return 'Location took too long. Try again, or enter PIN.';
  return err instanceof Error ? err.message : 'Could not use GPS. Enter your PIN instead.';
}
