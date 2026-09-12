import { createClient } from '@supabase/supabase-js';

const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL || 'https://uxnbkuyfbwmvtksipesg.supabase.co';
const OLD_SUPABASE_ANON_KEY = process.env.OLD_SUPABASE_ANON_KEY;
const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const NEW_SUPABASE_ANON_KEY = process.env.NEW_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const EXECUTE = process.argv.includes('--execute');

if (!OLD_SUPABASE_URL || !OLD_SUPABASE_ANON_KEY || !NEW_SUPABASE_URL || !NEW_SUPABASE_ANON_KEY) {
  console.error('Missing env vars. Required: OLD_SUPABASE_URL, OLD_SUPABASE_ANON_KEY, NEW_SUPABASE_URL, NEW_SUPABASE_ANON_KEY');
  process.exit(1);
}

const oldDb = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_ANON_KEY);
const newDb = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_ANON_KEY);

const metrics = {
  categories: { source: 0, insertedOrUpdated: 0 },
  products: { source: 0, insertedOrUpdated: 0, skipped: 0 },
  variants: { source: 0, insertedOrUpdated: 0, skipped: 0 },
  images: { source: 0, inserted: 0, skipped: 0 },
  templates: { source: 0, insertedOrUpdated: 0, skipped: 0 }
};

function nowIso() {
  return new Date().toISOString();
}

async function hasColumn(client, table, column) {
  const { error } = await client.from(table).select(column).limit(1);
  if (!error) return true;
  if (error.message && error.message.includes('does not exist')) return false;
  throw new Error(`Failed checking column ${table}.${column}: ${error.message}`);
}

async function fetchAll(client, table, select = '*') {
  const { data, error } = await client.from(table).select(select);
  if (error) {
    throw new Error(`Failed to read ${table}: ${error.message}`);
  }
  return data || [];
}

function mapProductForTarget(row, categoryId, flags) {
  const payload = {
    gooten_product_id: row.gooten_product_id ?? null,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    short_description: row.short_description ?? null,
    category_id: categoryId ?? null,
    base_price: row.base_price ?? 0,
    is_active: row.is_active ?? false,
    is_featured: row.is_featured ?? false,
    metadata: row.metadata ?? {},
    synced_at: row.synced_at ?? null
  };
  if (flags.productHasSource) {
    payload.source = row.source ?? (row.gooten_product_id ? 'gooten' : 'manual');
  }
  if (flags.productHasStatus) {
    payload.status = row.status ?? ((row.is_active ?? false) ? 'published' : 'pending');
  }
  if (flags.productHasDeletedAt) {
    payload.deleted_at = row.deleted_at ?? null;
  }
  if (flags.productHasUpdatedAt) {
    payload.updated_at = nowIso();
  }
  return payload;
}

function mapVariantForTarget(row, productId, hasUpdatedAt) {
  const payload = {
    product_id: productId,
    gooten_sku: row.gooten_sku ?? null,
    name: row.name,
    sku: row.sku,
    price: row.price ?? 0,
    compare_at_price: row.compare_at_price ?? null,
    cost: row.cost ?? null,
    size: row.size ?? null,
    color: row.color ?? null,
    material: row.material ?? null,
    weight: row.weight ?? null,
    dimensions: row.dimensions ?? null,
    inventory_quantity: row.inventory_quantity ?? 999,
    track_inventory: row.track_inventory ?? false,
    allow_backorder: row.allow_backorder ?? true,
    is_active: row.is_active ?? false,
    sort_order: row.sort_order ?? 0,
    metadata: row.metadata ?? {}
  };
  if (hasUpdatedAt) {
    payload.updated_at = nowIso();
  }
  return payload;
}

async function run() {
  console.log(`Mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Old DB: ${OLD_SUPABASE_URL}`);
  console.log(`New DB: ${NEW_SUPABASE_URL}`);

  const [productHasSource, productHasStatus, productHasDeletedAt, productHasUpdatedAt, variantHasUpdatedAt, templateHasUpdatedAt] = await Promise.all([
    hasColumn(newDb, 'products', 'source'),
    hasColumn(newDb, 'products', 'status'),
    hasColumn(newDb, 'products', 'deleted_at'),
    hasColumn(newDb, 'products', 'updated_at'),
    hasColumn(newDb, 'product_variants', 'updated_at'),
    hasColumn(newDb, 'product_templates', 'updated_at')
  ]);
  const flags = { productHasSource, productHasStatus, productHasDeletedAt, productHasUpdatedAt };

  const [sourceCategories, sourceProducts, sourceVariants, sourceImages, sourceTemplates] = await Promise.all([
    fetchAll(oldDb, 'categories'),
    fetchAll(oldDb, 'products'),
    fetchAll(oldDb, 'product_variants'),
    fetchAll(oldDb, 'product_images'),
    fetchAll(oldDb, 'product_templates')
  ]);

  metrics.categories.source = sourceCategories.length;
  metrics.products.source = sourceProducts.length;
  metrics.variants.source = sourceVariants.length;
  metrics.images.source = sourceImages.length;
  metrics.templates.source = sourceTemplates.length;

  const targetCategories = await fetchAll(newDb, 'categories', 'id, slug');
  const targetCategoriesBySlug = new Map(targetCategories.map((c) => [c.slug, c.id]));
  const categoryMapOldToNew = new Map();

  for (const src of sourceCategories) {
    let targetId = targetCategoriesBySlug.get(src.slug);
    if (!targetId && EXECUTE) {
      const { data, error } = await newDb
        .from('categories')
        .upsert({
          name: src.name,
          slug: src.slug,
          description: src.description ?? null,
          sort_order: src.sort_order ?? 0,
          is_active: src.is_active ?? true,
          updated_at: nowIso()
        }, { onConflict: 'slug' })
        .select('id')
        .single();
      if (error) throw new Error(`Failed upserting category ${src.slug}: ${error.message}`);
      targetId = data.id;
      metrics.categories.insertedOrUpdated += 1;
    } else if (targetId) {
      metrics.categories.insertedOrUpdated += 1;
    }
    if (targetId) {
      categoryMapOldToNew.set(src.id, targetId);
    }
  }

  const targetProducts = await fetchAll(newDb, 'products', 'id, slug, gooten_product_id');
  const targetBySlug = new Map(targetProducts.map((p) => [p.slug, p]));
  const targetByGootenId = new Map(
    targetProducts.filter((p) => p.gooten_product_id).map((p) => [String(p.gooten_product_id), p])
  );
  const productMapOldToNew = new Map();

  for (const src of sourceProducts) {
    const keyGooten = src.gooten_product_id ? String(src.gooten_product_id) : null;
    const targetExisting = keyGooten ? targetByGootenId.get(keyGooten) : targetBySlug.get(src.slug);

    if (!EXECUTE) {
      if (targetExisting) {
        metrics.products.insertedOrUpdated += 1;
      } else {
        metrics.products.insertedOrUpdated += 1;
      }
      if (targetExisting) productMapOldToNew.set(src.id, targetExisting.id);
      continue;
    }

    const categoryId = src.category_id ? categoryMapOldToNew.get(src.category_id) ?? null : null;
    const payload = mapProductForTarget(src, categoryId, flags);

    if (keyGooten) {
      const { data, error } = await newDb
        .from('products')
        .upsert(payload, { onConflict: 'gooten_product_id' })
        .select('id')
        .single();
      if (error) throw new Error(`Failed upserting product ${src.slug} (gooten): ${error.message}`);
      metrics.products.insertedOrUpdated += 1;
      productMapOldToNew.set(src.id, data.id);
      continue;
    }

    const { data, error } = await newDb
      .from('products')
      .upsert(payload, { onConflict: 'slug' })
      .select('id')
      .single();
    if (error) throw new Error(`Failed upserting product ${src.slug} (slug): ${error.message}`);
    metrics.products.insertedOrUpdated += 1;
    productMapOldToNew.set(src.id, data.id);
  }

  if (!EXECUTE) {
    const targetProductsRef = await fetchAll(newDb, 'products', 'id, slug, gooten_product_id');
    const refBySlug = new Map(targetProductsRef.map((p) => [p.slug, p.id]));
    const refByGooten = new Map(
      targetProductsRef.filter((p) => p.gooten_product_id).map((p) => [String(p.gooten_product_id), p.id])
    );
    for (const src of sourceProducts) {
      const mapped = src.gooten_product_id ? refByGooten.get(String(src.gooten_product_id)) : refBySlug.get(src.slug);
      if (mapped) productMapOldToNew.set(src.id, mapped);
    }
  }

  const targetVariants = await fetchAll(newDb, 'product_variants', 'id, sku, gooten_sku');
  const targetVariantBySku = new Map(targetVariants.map((v) => [v.sku, v.id]));
  const targetVariantByGootenSku = new Map(
    targetVariants.filter((v) => v.gooten_sku).map((v) => [String(v.gooten_sku), v.id])
  );
  const variantMapOldToNew = new Map();

  for (const src of sourceVariants) {
    const targetProductId = productMapOldToNew.get(src.product_id);
    if (!targetProductId) {
      metrics.variants.skipped += 1;
      continue;
    }

    if (!EXECUTE) {
      metrics.variants.insertedOrUpdated += 1;
      continue;
    }

    const payload = mapVariantForTarget(src, targetProductId, variantHasUpdatedAt);
    const conflictColumn = src.gooten_sku ? 'gooten_sku' : 'sku';
    const { data, error } = await newDb
      .from('product_variants')
      .upsert(payload, { onConflict: conflictColumn })
      .select('id')
      .single();
    if (error) throw new Error(`Failed upserting variant ${src.sku}: ${error.message}`);
    metrics.variants.insertedOrUpdated += 1;
    variantMapOldToNew.set(src.id, data.id);
  }

  if (!EXECUTE) {
    for (const src of sourceVariants) {
      const mapped = src.gooten_sku
        ? targetVariantByGootenSku.get(String(src.gooten_sku))
        : targetVariantBySku.get(src.sku);
      if (mapped) variantMapOldToNew.set(src.id, mapped);
    }
  }

  if (EXECUTE) {
    const targetImages = await fetchAll(newDb, 'product_images', 'id, product_id, variant_id, url');
    const imageKeySet = new Set(
      targetImages.map((img) => `${img.product_id || ''}|${img.variant_id || ''}|${img.url}`)
    );

    for (const src of sourceImages) {
      const mappedProductId = src.product_id ? productMapOldToNew.get(src.product_id) ?? null : null;
      const mappedVariantId = src.variant_id ? variantMapOldToNew.get(src.variant_id) ?? null : null;
      if (!mappedProductId && !mappedVariantId) {
        metrics.images.skipped += 1;
        continue;
      }

      const key = `${mappedProductId || ''}|${mappedVariantId || ''}|${src.url}`;
      if (imageKeySet.has(key)) {
        metrics.images.skipped += 1;
        continue;
      }

      const { error } = await newDb.from('product_images').insert({
        product_id: mappedProductId,
        variant_id: mappedVariantId,
        url: src.url,
        alt_text: src.alt_text ?? null,
        sort_order: src.sort_order ?? 0,
        is_primary: src.is_primary ?? false,
        width: src.width ?? null,
        height: src.height ?? null
      });
      if (error) throw new Error(`Failed inserting image ${src.url}: ${error.message}`);
      imageKeySet.add(key);
      metrics.images.inserted += 1;
    }
  } else {
    metrics.images.inserted = sourceImages.length;
  }

  for (const src of sourceTemplates) {
    const mappedVariantId = variantMapOldToNew.get(src.variant_id);
    if (!mappedVariantId) {
      metrics.templates.skipped += 1;
      continue;
    }

    if (!EXECUTE) {
      metrics.templates.insertedOrUpdated += 1;
      continue;
    }

    const templatePayload = {
      variant_id: mappedVariantId,
      gooten_sku: src.gooten_sku,
      template_data: src.template_data ?? {},
      spaces: src.spaces ?? [],
      layers: src.layers ?? []
    };
    if (templateHasUpdatedAt) {
      templatePayload.updated_at = nowIso();
    }

    const { error } = await newDb
      .from('product_templates')
      .upsert(templatePayload, { onConflict: 'variant_id,gooten_sku' });
    if (error) throw new Error(`Failed upserting template ${src.gooten_sku}: ${error.message}`);
    metrics.templates.insertedOrUpdated += 1;
  }

  console.log('\nMerge summary:');
  console.log(JSON.stringify(metrics, null, 2));
}

run().catch((err) => {
  console.error('Merge failed:', err.message);
  process.exit(1);
});
