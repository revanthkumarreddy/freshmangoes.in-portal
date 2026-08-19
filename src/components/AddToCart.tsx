import { useState, useEffect } from 'react';
import { addToCart } from '~/lib/cart';
import { wixClient } from '~/lib/wix-client';
import { getOverriddenPrice } from '~/lib/pricing';
import { clampInt } from '~/lib/sanitize';

type Variant = {
  _id?: string;
  variantId?: string;
  name?: string;
  price?: number;
  salePrice?: number | null;
  inStock?: boolean;
  choices?: Record<string, string>;
};

type Props = {
  productId: string;
  productName: string;
  variants: Variant[];
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function AddToCart({ productId, productName, variants }: Props) {
  const [liveVariants, setLiveVariants] = useState<Variant[]>(variants);
  const [selected, setSelected] = useState(0);
  const [qty, setQty] = useState(1);
  const [state, setState] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchLiveStock() {
      try {
        const { items } = await wixClient.products.queryProducts().eq('_id', productId).find();
        if (items.length > 0 && active) {
          const product = items[0];
          let mapped: Variant[] =
            product.variants
              ?.map((v) => {
                const variantName = v.choices ? Object.values(v.choices).join(' · ') : 'Default';
                let price = Number(v.variant?.priceData?.price ?? 0);
                price = getOverriddenPrice(productName, variantName, price);
                return {
                  _id: v._id,
                  variantId: v._id,
                  name: variantName,
                  price,
                  salePrice: null,
                  inStock: v.stock?.inStock !== false,
                };
              })
              .filter((v: Variant) => {
                const n = (v.name || '').toLowerCase().replace(/\s/g, '');
                return n.includes('3kg') || n.includes('5kg');
              }) || [];

          if (mapped.length === 0) {
            let price = Number(product.price?.price ?? product.priceData?.price ?? 0);
            price = getOverriddenPrice(productName, 'Default', price);
            mapped.push({
              _id: 'default',
              variantId: '00000000-0000-0000-0000-000000000000',
              name: 'Default',
              price,
              salePrice: null,
              inStock: product.stock?.inStock !== false,
            });
          }
          setLiveVariants(mapped);
        }
      } catch {
        /* keep build-time variants */
      }
    }
    fetchLiveStock();
    return () => {
      active = false;
    };
  }, [productId, productName]);

  const variant = liveVariants[selected] || liveVariants[0];
  const variantId = variant?.variantId || variant?._id;
  const price = variant?.price ?? 0;
  const sale = variant?.salePrice ?? null;
  const showSale = sale != null && sale > price;
  const out = variant?.inStock === false;

  async function handleAdd() {
    setState('adding');
    setError(false);
    try {
      const result = await addToCart({
        catalogItemId: productId,
        variantId,
        quantity: clampInt(qty, 1, 20),
      });
      const lineItems = result?.cart?.lineItems || [];
      const addedItem = lineItems.find((li: any) => {
        const matchesProduct = li.catalogReference?.catalogItemId === productId;
        const matchesVariant =
          !variantId ||
          variantId === '00000000-0000-0000-0000-000000000000' ||
          li.catalogReference?.options?.variantId === variantId;
        return matchesProduct && matchesVariant;
      });
      if (addedItem && (addedItem.quantity === 0 || addedItem.availability?.status === 'NOT_AVAILABLE')) {
        throw new Error('out of stock');
      }
      setState('added');
      setTimeout(() => setState('idle'), 2200);
    } catch {
      setError(true);
      setState('error');
    }
  }

  const ctaLabel =
    out ? 'Out of stock' :
    state === 'adding' ? 'Adding…' :
    state === 'added' ? 'Added' :
    state === 'error' ? 'Try again' :
    'Add to Cart';

  return (
    <div className="space-y-6">
      {liveVariants.length > 1 && (
        <div>
          <div className="eyebrow mb-2">Choose size</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {liveVariants.map((v, i) => (
              <button
                key={v._id || v.variantId || i}
                type="button"
                onClick={() => setSelected(i)}
                className={
                  'min-h-[52px] rounded-lg border px-3 py-3 text-sm font-medium transition-all ' +
                  (i === selected
                    ? 'border-[color:var(--color-leaf-600)] bg-[color:var(--color-leaf-600)] text-[color:var(--color-cream)]'
                    : 'border-black/15 hover:border-[color:var(--color-leaf-600)]')
                }
              >
                <div>{v.name || `Option ${i + 1}`}</div>
                <div className="mt-1 text-xs opacity-80">{fmt(v.price ?? 0)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-baseline gap-3">
        {showSale && <span className="price-strike text-lg">{fmt(sale!)}</span>}
        <span className="display text-4xl">{fmt(price)}</span>
        <span className="text-xs uppercase tracking-wider opacity-60">incl. of all taxes</span>
      </div>

      <div className="hidden sm:flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-black/15 overflow-hidden">
          <button type="button" aria-label="Decrease quantity" className="px-4 py-3 hover:bg-black/5" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span className="px-4 py-3 min-w-[2.5rem] text-center text-sm font-semibold">{qty}</span>
          <button type="button" aria-label="Increase quantity" className="px-4 py-3 hover:bg-black/5" onClick={() => setQty((q) => Math.min(20, q + 1))}>+</button>
        </div>
        <button type="button" onClick={handleAdd} disabled={state === 'adding' || out} className="btn btn-saffron flex-1 min-h-[48px]">
          {ctaLabel}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-700" role="alert">
          Couldn't add this to your cart. Please try again, or WhatsApp us for help.
        </p>
      )}

      <p className="text-xs text-[color:var(--color-ink-soft)]">
        Picked, packed and shipped within 24 hours. Free shipping over ₹599.
      </p>

      {/* Mobile sticky purchase bar */}
      <div className="sm:hidden fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-30 border-t border-black/8 bg-[color:var(--color-paper)]/95 backdrop-blur-md px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="inline-flex items-center rounded-lg border border-black/15 overflow-hidden shrink-0">
            <button type="button" aria-label="Decrease quantity" className="px-3.5 py-2.5" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <span className="px-2 py-2.5 min-w-[1.75rem] text-center text-sm font-semibold">{qty}</span>
            <button type="button" aria-label="Increase quantity" className="px-3.5 py-2.5" onClick={() => setQty((q) => Math.min(20, q + 1))}>+</button>
          </div>
        <button type="button" onClick={handleAdd} disabled={state === 'adding' || out} className="btn btn-saffron flex-1 !py-3 text-sm">
          {state === 'added' ? `Added · ${fmt(price)}` : `${ctaLabel} · ${fmt(price)}`}
        </button>
        </div>
      </div>
    </div>
  );
}
