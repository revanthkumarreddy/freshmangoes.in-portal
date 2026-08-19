import { createClient, OAuthStrategy } from '@wix/sdk';
import { products } from '@wix/stores';
import { currentCart } from '@wix/ecom';

const wixClient = createClient({
  modules: { products, currentCart },
  auth: OAuthStrategy({
    clientId: '838b43b6-ece9-49f0-860c-4bac47c71e2e',
  }),
});

async function run() {
  const page = await wixClient.products.queryProducts().limit(1).find();
  const product = page.items[0];
  console.log('Product Name:', product.name);
  console.log('Product ID:', product._id);
  console.log('Variants:', JSON.stringify(product.variants, null, 2));

  // Test adding with variantId
  try {
    const res = await wixClient.currentCart.addToCurrentCart({
      lineItems: [{
        catalogReference: {
          catalogItemId: product._id!,
          appId: '215238eb-22a5-4c36-9e7b-e7c08025e04e',
          options: { variantId: '00000000-0000-0000-0000-000000000000' } // Default variant id
        },
        quantity: 1,
      }]
    });
    console.log('SUCCESS with variantId 0000... Cart items:', res.cart?.lineItems?.length);
  } catch (err: any) {
    console.log('FAILED with variantId 0000...:', err?.message || err);
  }
}

run();
