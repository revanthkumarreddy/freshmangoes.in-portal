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

  // Try ID 1
  try {
    const res = await wixClient.currentCart.addToCurrentCart({
      lineItems: [{
        catalogReference: {
          catalogItemId: product._id!,
          appId: '1380b703-ce81-ff05-f115-39571d94dfcd',
        },
        quantity: 1,
      }]
    });
    console.log('SUCCESS with 1380b703-ce81-ff05-f115-39571d94dfcd. Cart items:', res.cart?.lineItems?.length);
  } catch (err: any) {
    console.log('FAILED with 1380b703-ce81-ff05-f115-39571d94dfcd:', err?.message || err);
  }

  // Try ID 2
  try {
    const res = await wixClient.currentCart.addToCurrentCart({
      lineItems: [{
        catalogReference: {
          catalogItemId: product._id!,
          appId: '215238eb-22a5-4c36-9e7b-e7c08025e04e',
        },
        quantity: 1,
      }]
    });
    console.log('SUCCESS with 215238eb-22a5-4c36-9e7b-e7c08025e04e. Cart items:', res.cart?.lineItems?.length);
  } catch (err: any) {
    console.log('FAILED with 215238eb-22a5-4c36-9e7b-e7c08025e04e:', err?.message || err);
  }
}

run();
