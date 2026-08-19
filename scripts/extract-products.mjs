/**
 * Extract all product data from the current FreshMangos_r Wix site.
 * Outputs a complete JSON snapshot of every product, variant, and setting.
 *
 * Usage: node scripts/extract-products.mjs
 */
import { createClient, OAuthStrategy } from '@wix/sdk';
import { products } from '@wix/stores';

const CLIENT_ID = '838b43b6-ece9-49f0-860c-4bac47c71e2e';

const client = createClient({
  modules: { products },
  auth: OAuthStrategy({ clientId: CLIENT_ID }),
});

async function main() {
  console.log('🔄 Connecting to FreshMangos_r Wix site...');
  console.log(`   Client ID: ${CLIENT_ID}\n`);

  const all = [];
  let page = await client.products.queryProducts().limit(100).find();
  all.push(...(page.items ?? []));
  while (page.hasNext()) {
    page = await page.next();
    all.push(...(page.items ?? []));
  }

  console.log(`✅ Found ${all.length} product(s)\n`);
  console.log('='.repeat(80));

  for (const p of all) {
    console.log(`\n📦 Product: ${p.name}`);
    console.log(`   ID:          ${p._id}`);
    console.log(`   Slug:        ${p.slug}`);
    console.log(`   Type:        ${p.productType}`);
    console.log(`   Visible:     ${p.visible}`);
    console.log(`   In Stock:    ${p.stock?.inStock}`);
    console.log(`   Description: ${(p.description || '').replace(/<[^>]+>/g, '').slice(0, 120)}`);
    
    const priceData = p.priceData || p.price;
    if (priceData) {
      console.log(`   Base Price:  ${priceData.currency} ${priceData.price}`);
      if (priceData.discountedPrice && priceData.discountedPrice !== priceData.price) {
        console.log(`   Sale Price:  ${priceData.currency} ${priceData.discountedPrice}`);
      }
    }

    // Product Options (e.g., Weight: 3kg, 5kg)
    if (p.productOptions?.length) {
      console.log(`   Options:`);
      for (const opt of p.productOptions) {
        const choices = opt.choices?.map(c => c.value).join(', ') || 'none';
        console.log(`     - ${opt.name} (${opt.optionType}): [${choices}]`);
      }
    }

    // Variants
    if (p.variants?.length) {
      console.log(`   Variants (${p.variants.length}):`);
      for (const v of p.variants) {
        const choiceStr = v.choices ? Object.entries(v.choices).map(([k, val]) => `${k}=${val}`).join(', ') : 'default';
        const vPrice = v.variant?.priceData?.price || '?';
        const vCurrency = v.variant?.priceData?.currency || 'INR';
        const vSku = v.variant?.sku || '-';
        const vStock = v.stock?.inStock !== false ? '✓' : '✗';
        console.log(`     [${v._id}] ${choiceStr} → ${vCurrency} ${vPrice}  (SKU: ${vSku}, stock: ${vStock})`);
      }
    }

    // Media
    if (p.media?.items?.length) {
      console.log(`   Media (${p.media.items.length} items):`);
      for (const m of p.media.items) {
        console.log(`     - ${m.mediaType}: ${m.image?.url || m.video?.url || 'unknown'}`);
      }
    }

    console.log('-'.repeat(80));
  }

  // Also dump the raw JSON for detailed reference
  const outputPath = 'scripts/products-snapshot.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(all, null, 2));
  console.log(`\n💾 Full JSON snapshot saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
