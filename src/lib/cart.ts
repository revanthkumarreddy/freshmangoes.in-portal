/**
 * Tiny façade over Wix `currentCart` SDK for the React components.
 */
import { wixClient, persistTokens } from './wix-client';
import { clampInt, sanitizeCoupon } from './sanitize';

export type LineItemInput = {
  catalogItemId: string;
  variantId?: string;
  quantity: number;
  options?: Record<string, string>;
};

const STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';

export async function getCart() {
  try {
    return await wixClient.currentCart.getCurrentCart();
  } catch {
    return null;
  }
}

export async function addToCart(input: LineItemInput) {
  const qty = clampInt(input.quantity, 1, 20);
  const actualVariantId =
    input.variantId &&
    input.variantId !== '00000000-0000-0000-0000-000000000000' &&
    input.variantId !== 'default'
      ? input.variantId
      : undefined;

  const lineItem = {
    catalogReference: {
      catalogItemId: input.catalogItemId,
      appId: STORES_APP_ID,
      ...(actualVariantId
        ? { options: { variantId: actualVariantId } }
        : input.options
          ? { options: { options: input.options } }
          : {}),
    },
    quantity: qty,
  };

  try {
    const res = await wixClient.currentCart.addToCurrentCart({
      lineItems: [lineItem],
    });
    persistTokens();
    window.dispatchEvent(new CustomEvent('cart:updated'));
    return res;
  } catch (err) {
    console.error('[cart] addToCurrentCart failed');
    throw err;
  }
}

export async function updateLineItem(lineItemId: string, quantity: number) {
  const qty = clampInt(quantity, 1, 20);
  const res = await wixClient.currentCart.updateCurrentCartLineItemQuantity([
    { _id: lineItemId, quantity: qty },
  ]);
  persistTokens();
  window.dispatchEvent(new CustomEvent('cart:updated'));
  return res;
}

export async function removeLineItem(lineItemId: string) {
  const res = await wixClient.currentCart.removeLineItemsFromCurrentCart([lineItemId]);
  persistTokens();
  window.dispatchEvent(new CustomEvent('cart:updated'));
  return res;
}

export async function applyCoupon(code: string) {
  const couponCode = sanitizeCoupon(code);
  if (!couponCode) throw new Error('Enter a valid coupon code');
  const res = await wixClient.currentCart.updateCurrentCart({
    couponCode,
  });
  persistTokens();
  window.dispatchEvent(new CustomEvent('cart:updated'));
  return res;
}

/** Create a Wix checkout from current cart and redirect the browser to it. */
export async function checkoutNow() {
  const { checkoutId } = await wixClient.currentCart.createCheckoutFromCurrentCart({
    channelType: 'WEB',
  });
  if (!checkoutId) throw new Error('No checkout id returned by Wix');

  const origin = window.location.origin;
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const { redirectSession } = await wixClient.redirects.createRedirectSession({
    ecomCheckout: { checkoutId },
    callbacks: {
      postFlowUrl: `${origin}${base}/thank-you`,
      thankYouPageUrl: `${origin}${base}/thank-you`,
      cartPageUrl: `${origin}${base}/cart`,
    },
  });
  const url = redirectSession?.fullUrl;
  if (!url) throw new Error('No redirect URL returned by Wix');
  // Only follow Wix-hosted HTTPS checkout URLs
  if (!/^https:\/\//i.test(url)) throw new Error('Invalid checkout redirect');
  window.location.href = url;
}
