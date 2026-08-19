import { useEffect, useState } from 'react';
import { getCart, updateLineItem, removeLineItem, applyCoupon, checkoutNow } from '~/lib/cart';
import { isLoggedIn } from '~/lib/wix-client';
import { getOverriddenPrice } from '~/lib/pricing';

const fmt = (amount: string | number | undefined) => {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount ?? 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
};

export default function CartPage() {
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [coupon, setCoupon] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  async function refresh() {
    setLoading(true);
    setCart(await getCart());
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('autoCheckout') === '1' && cart && cart.lineItems?.length > 0 && !checkingOut) {
      window.history.replaceState({}, '', window.location.pathname);
      onCheckout();
    }
  }, [cart]);

  let overrideSubtotal = 0;
  const displayLineItems = (cart?.lineItems || []).map((li: any) => {
    const productName = li.productName?.original || li.productName?.translated || '';
    let variantName = 'Default';
    if (li.descriptionLines?.length > 0) {
      variantName = li.descriptionLines.map((d: any) => d.colorInfo?.original || d.plainText?.original).join(' · ');
    }
    const originalPrice = parseFloat(li.price?.amount || '0');
    const displayPrice = getOverriddenPrice(productName, variantName, originalPrice);
    overrideSubtotal += displayPrice * li.quantity;
    return { ...li, displayPrice };
  });

  const subtotal = overrideSubtotal;
  const discountAmt = parseFloat(cart?.priceSummary?.discount?.amount || '0');
  const shippingAmt = parseFloat(cart?.priceSummary?.shipping?.amount || '0');
  const total = overrideSubtotal + shippingAmt - discountAmt;
  const discount = discountAmt > 0 ? discountAmt.toString() : undefined;
  const shipping = shippingAmt > 0 ? shippingAmt.toString() : undefined;

  async function onQty(id: string, q: number) {
    setBusy(id); setError(null);
    try { await updateLineItem(id, q); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }
  async function onRemove(id: string) {
    setBusy(id); setError(null);
    try { await removeLineItem(id); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }
  async function onCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!coupon.trim()) return;
    setBusy('coupon'); setError(null);
    try { await applyCoupon(coupon.trim()); await refresh(); }
    catch (e) { setError('Could not apply that coupon. Please check the code and try again.'); }
    finally { setBusy(null); }
  }
  async function onCheckout() {
    // Payments require real Wix member auth — localStorage "fm:user" is not trusted
    if (!isLoggedIn()) {
      window.location.href = `${import.meta.env.BASE_URL || ''}/login?checkout=1`.replace(/\/\/+/g, '/');
      return;
    }

    setCheckingOut(true); setError(null);
    try { await checkoutNow(); }
    catch (e) { setError((e as Error).message); setCheckingOut(false); }
  }

  const FREE_SHIPPING_AT = 599;
  const shipProgress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_AT) * 100));
  const shipRemaining = Math.max(0, FREE_SHIPPING_AT - subtotal);

  if (loading) return <p className="text-[color:var(--color-ink-soft)]">Loading your cart…</p>;
  if (!displayLineItems.length)
    return (
      <div className="text-center py-16">
        <p className="display text-3xl mb-4">Your basket is empty</p>
        <p className="text-[color:var(--color-ink-soft)] mb-6">Time to fill it with sunshine.</p>
        <a href={`${import.meta.env.BASE_URL}/shop`.replace('//', '/')} className="btn btn-saffron">Browse our mangoes</a>
      </div>
    );

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {displayLineItems.map((li: any) => (
          <div key={li._id} className="flex gap-4 bg-white/80 rounded-xl p-4 border border-black/6">
            {li.image && (
              <img src={li.image} alt="" className="w-24 h-24 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="display text-xl leading-tight">{li.productName?.translated || li.productName?.original}</h3>
              {li.descriptionLines?.length > 0 && (
                <p className="text-xs text-[color:var(--color-ink-soft)] mt-1">
                  {li.descriptionLines.map((d: any, i: number) =>
                    <span key={i}>{d.name?.translated}: {d.colorInfo?.translated || d.plainText?.translated}{i < li.descriptionLines.length - 1 ? ' · ' : ''}</span>
                  )}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <div className="inline-flex items-center rounded-lg border border-black/15">
                  <button className="px-3 py-1.5 disabled:opacity-40" disabled={busy === li._id || li.quantity <= 1} onClick={() => onQty(li._id, li.quantity - 1)}>−</button>
                  <span className="px-3 py-1.5 text-sm font-semibold min-w-[2rem] text-center">{li.quantity}</span>
                  <button className="px-3 py-1.5 disabled:opacity-40" disabled={busy === li._id} onClick={() => onQty(li._id, li.quantity + 1)}>+</button>
                </div>
                <button className="text-xs text-[color:var(--color-ink-soft)] hover:text-red-700 underline-offset-2 hover:underline" disabled={busy === li._id} onClick={() => onRemove(li._id)}>
                  Remove
                </button>
              </div>
            </div>
            <div className="text-right">
              <p className="display text-lg">{fmt(li.displayPrice)}</p>
              {li.fullPrice && li.fullPrice.amount !== li.price?.amount && (
                <p className="price-strike text-xs">{fmt(li.fullPrice.amount)}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <aside className="rounded-xl bg-white border border-black/6 p-6 h-fit sticky top-24">
        <h3 className="display text-2xl mb-4">Order summary</h3>

        <div className="mb-5 rounded-lg bg-[color:var(--color-saffron-50)] px-4 py-3">
          <p className="text-xs font-medium mb-2">
            {shipRemaining > 0
              ? `Add ${fmt(shipRemaining)} more for free shipping`
              : 'You’ve unlocked free shipping'}
          </p>
          <div className="ship-meter" aria-hidden="true">
            <div className="ship-meter-fill" style={{ width: `${shipProgress}%` }} />
          </div>
        </div>

        <form onSubmit={onCoupon} className="flex gap-2 mb-5">
          <input
            type="text"
            value={coupon}
            onChange={e => setCoupon(e.target.value.toUpperCase())}
            placeholder="Coupon code"
            className="flex-1 rounded-lg border border-black/15 px-4 py-2 text-sm focus:border-[color:var(--color-leaf-500)] outline-none"
          />
          <button className="btn btn-ghost !py-2 !px-4 text-sm" disabled={busy === 'coupon'}>Apply</button>
        </form>
        {cart?.appliedDiscounts?.length > 0 && (
          <p className="text-xs text-[color:var(--color-leaf-600)] mb-3">{cart.appliedDiscounts[0].coupon?.code} applied</p>
        )}

        <dl className="text-sm space-y-2 mb-6">
          <div className="flex justify-between"><dt className="text-[color:var(--color-ink-soft)]">Subtotal</dt><dd>{fmt(subtotal)}</dd></div>
          {discount && parseFloat(discount) > 0 && (
            <div className="flex justify-between text-[color:var(--color-leaf-600)]"><dt>Discount</dt><dd>−{fmt(discount)}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-[color:var(--color-ink-soft)]">Shipping</dt><dd>{shipping && parseFloat(shipping) > 0 ? fmt(shipping) : 'Calculated at checkout'}</dd></div>
          <div className="border-t border-black/10 pt-3 flex justify-between font-semibold text-base">
            <dt>Total</dt><dd className="display text-2xl">{fmt(total)}</dd>
          </div>
        </dl>

        <button className="btn btn-primary w-full" onClick={onCheckout} disabled={checkingOut}>
          {checkingOut ? 'Redirecting to secure checkout…' : 'Checkout securely'}
        </button>
        {error && <p className="text-xs text-red-700 mt-3" role="alert">Something went wrong. Please try again.</p>}
        <p className="text-xs text-[color:var(--color-ink-soft)] mt-4">Secure payment. India shipping only. Free over ₹599. First order? Try FRESH10.</p>
      </aside>
    </div>
  );
}
