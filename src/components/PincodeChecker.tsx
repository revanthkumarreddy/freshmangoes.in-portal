import { useEffect, useState } from 'react';
import {
  DELIVERY_EVENT,
  OPEN_LOCATION_EVENT,
  expectedDeliveryLabel,
  getSavedLocation,
  type DeliveryLocation,
} from '~/lib/delivery';

export default function PincodeChecker() {
  const [loc, setLoc] = useState<DeliveryLocation | null>(null);

  useEffect(() => {
    setLoc(getSavedLocation());
    const onUpdate = (e: Event) => setLoc((e as CustomEvent<DeliveryLocation>).detail || getSavedLocation());
    window.addEventListener(DELIVERY_EVENT, onUpdate);
    return () => window.removeEventListener(DELIVERY_EVENT, onUpdate);
  }, []);

  function changeLocation() {
    window.dispatchEvent(new Event(OPEN_LOCATION_EVENT));
  }

  return (
    <div className="mt-6 pt-6 border-t border-black/10">
      <div className="flex items-center gap-2 mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[color:var(--color-leaf-600)]">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <h3 className="font-medium text-sm">Check delivery</h3>
      </div>

      {loc ? (
        <div className="rounded-xl border border-black/8 bg-white/70 px-4 py-3">
          <p className={`text-sm font-semibold ${loc.serviceable ? 'text-[color:var(--color-leaf-700)]' : 'text-red-700'}`}>
            {loc.serviceable
              ? `Available at ${loc.city} — ${loc.pincode}`
              : `Currently not deliverable to ${loc.pincode}`}
          </p>
          {loc.serviceable ? (
            <p className="text-xs text-[color:var(--color-ink-soft)] mt-1">
              {expectedDeliveryLabel(true)} · Packed in 24 hrs · Free shipping over ₹599
            </p>
          ) : (
            <p className="text-xs text-[color:var(--color-ink-soft)] mt-1">
              Try another PIN. We ship to serviceable pincodes across Karnataka.
            </p>
          )}
          <button type="button" className="mt-3 text-sm font-semibold text-[color:var(--color-leaf-600)]" onClick={changeLocation}>
            Change location
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost w-full justify-between" onClick={changeLocation}>
          <span>Enter PIN or use GPS</span>
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
