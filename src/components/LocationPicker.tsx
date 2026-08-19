import { useEffect, useState } from 'react';
import {
  DELIVERY_EVENT,
  OPEN_LOCATION_EVENT,
  GpsNeedsPinError,
  completeFromCoords,
  expectedDeliveryLabel,
  getRecentPincodes,
  getSavedLocation,
  gpsErrorMessage,
  requestBrowserLocation,
  resolvePincode,
  saveLocation,
  type DeliveryLocation,
} from '~/lib/delivery';

export default function LocationPicker() {
  const [loc, setLoc] = useState<DeliveryLocation | null>(() => getSavedLocation());
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState(() => getSavedLocation()?.pincode || '');
  const [busy, setBusy] = useState<'idle' | 'gps' | 'pin'>('idle');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>(() => getRecentPincodes());

  useEffect(() => {
    const saved = getSavedLocation();
    setLoc(saved);
    setRecent(getRecentPincodes());
    if (saved) setPin(saved.pincode);

    const onUpdate = (e: Event) => {
      const next = (e as CustomEvent<DeliveryLocation>).detail || getSavedLocation();
      setLoc(next);
      if (next) setPin(next.pincode);
      setRecent(getRecentPincodes());
    };
    const onOpen = () => setOpen(true);
    window.addEventListener(DELIVERY_EVENT, onUpdate);
    window.addEventListener(OPEN_LOCATION_EVENT, onOpen);
    return () => {
      window.removeEventListener(DELIVERY_EVENT, onUpdate);
      window.removeEventListener(OPEN_LOCATION_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (loc) return;
    try {
      if (sessionStorage.getItem('fm:loc_prompted')) return;
      sessionStorage.setItem('fm:loc_prompted', '1');
    } catch {
      return;
    }
    const t = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(t);
  }, [loc]);

  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', open);
    return () => document.body.classList.remove('overflow-hidden');
  }, [open]);

  async function apply(next: DeliveryLocation) {
    saveLocation(next);
    setLoc(next);
    setError('');
    setOpen(false);
  }

  function onGps() {
    setError('');
    setHint('');
    // Start GPS in the same tap — required for iOS/Android Chrome.
    const geo = requestBrowserLocation();
    setBusy('gps');
    void geo
      .then((pos) => completeFromCoords(pos.coords.latitude, pos.coords.longitude))
      .then((next) => apply(next))
      .catch((err) => {
        if (err instanceof GpsNeedsPinError) {
          setHint(err.message);
          setSuggestions(err.suggestions);
          setError('');
        } else {
          setError(gpsErrorMessage(err));
        }
      })
      .finally(() => setBusy('idle'));
  }

  async function onCheck(code = pin) {
    setBusy('pin');
    setError('');
    try {
      await apply(await resolvePincode(code, 'manual'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check this PIN.');
    } finally {
      setBusy('idle');
    }
  }

  const label = loc
    ? `${loc.city} ${loc.pincode}`
    : 'Select your location';

  return (
    <>
      <button type="button" className="loc-bar" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[color:var(--color-leaf-600)]" aria-hidden="true">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-[10px] uppercase tracking-wider text-[color:var(--color-ink-soft)] leading-none">Deliver to</span>
          <span className="block truncate text-xs font-semibold leading-tight mt-0.5">
            {label}
            {loc && !loc.serviceable ? ' · unavailable' : ''}
          </span>
        </span>
        <span className="text-xs font-semibold text-[color:var(--color-leaf-600)] shrink-0">{loc ? 'Change' : 'Set PIN'}</span>
      </button>

      {open && (
        <div className="loc-sheet" role="dialog" aria-modal="true" aria-labelledby="loc-title">
          <button type="button" className="loc-sheet-backdrop" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="loc-sheet-panel">
            <div className="loc-sheet-handle" aria-hidden="true" />
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="eyebrow mb-1">Delivery location</p>
                <h2 id="loc-title" className="display text-2xl leading-tight">Where should we send it?</h2>
              </div>
              <button type="button" className="w-9 h-9 rounded-lg hover:bg-black/5 text-xl leading-none" aria-label="Close" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            <button type="button" className="btn btn-primary loc-gps-btn w-full gap-2" onClick={onGps} disabled={busy === 'gps'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
              {busy === 'gps' ? 'Detecting location…' : 'Use current location'}
            </button>
            <p className="text-[11px] text-[color:var(--color-ink-soft)] text-center mt-2 mb-1">
              Tap Allow when your phone asks. If it fails, type the PIN — GPS needs HTTPS and permission.
            </p>

            <div className="loc-or">or enter PIN manually</div>

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (pin.length === 6) onCheck();
              }}
            >
              <label className="sr-only" htmlFor="loc-pin">PIN code</label>
              <input
                id="loc-pin"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                placeholder="Enter 6-digit PIN"
                className="flex-1 min-w-0 rounded-xl border border-black/15 px-4 py-3 outline-none focus:border-[color:var(--color-leaf-500)]"
              />
              <button type="submit" className="btn btn-saffron !px-5" disabled={busy !== 'idle' || pin.length !== 6}>
                {busy === 'pin' ? '…' : 'Check'}
              </button>
            </form>

            {hint && !error && (
              <p className="mt-3 text-sm text-[color:var(--color-leaf-700)]" role="status">{hint}</p>
            )}

            {(suggestions.length > 0 || recent.length > 0) && (
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-ink-soft)] mb-2">
                  {suggestions.length > 0 ? 'Suggested PINs near you' : 'Recent PINs'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(suggestions.length > 0 ? suggestions : recent).map((r) => (
                    <button key={r} type="button" className="px-3 py-1.5 rounded-full border border-black/12 text-xs font-semibold" onClick={() => onCheck(r)}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}

            {loc && !error && (
              <p className={`mt-4 text-sm font-medium ${loc.serviceable ? 'text-[color:var(--color-leaf-600)]' : 'text-red-700'}`}>
                {loc.serviceable
                  ? `Yes — we deliver to ${loc.city}. ${expectedDeliveryLabel(true)}.`
                  : `Not available at ${loc.city} (${loc.pincode}) yet.`}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
