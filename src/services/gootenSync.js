import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function syncGootenProducts() {
  const syncLog = {
    sync_type: 'full_products',
    status: 'running',
    started_at: new Date().toISOString()
  };

  let productsSynced = 0;
  let variantsSynced = 0;
  const errors = [];

  try {
    const { data: logEntry } = await supabase
      .from('sync_logs')
      .insert(syncLog)
      .select()
      .single();

    const syncLogId = logEntry?.id;

    const productsResponse = await fetch('http://localhost:3001/api/prp-products?countryCode=US');
    if (!productsResponse.ok) {
      throw new Error(`Failed to fetch products: ${productsResponse.statusText}`);
    }

    const productsData = await productsResponse.json();
    const gootenProducts = productsData.data?.PreconfiguredProducts || [];

    for (const gootenProduct of gootenProducts) {
      try {
        const productName = gootenProduct.Name || gootenProduct.ProductName || 'Unknown Product';
        const productSlug = slugify(productName);

        let category = await supabase
          .from('categories')
          .select('id')
          .eq('slug', 'print-on-demand')
          .maybeSingle();

        if (!category.data) {
          const { data: newCategory } = await supabase
            .from('categories')
            .insert({
              name: 'Print on Demand',
              slug: 'print-on-demand',
              description: 'Custom print-on-demand products from Gooten'
            })
            .select()
            .single();
          category = { data: newCategory };
        }

        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('gooten_product_id', gootenProduct.Id)
          .maybeSingle();

        let productId;
        if (existingProduct) {
          const { data: updatedProduct } = await supabase
            .from('products')
            .update({
              name: productName,
              slug: productSlug,
              category_id: category.data.id,
              metadata: gootenProduct,
              synced_at: new Date().toISOString()
            })
            .eq('id', existingProduct.id)
            .select()
            .single();
          productId = updatedProduct.id;
        } else {
          const { data: newProduct } = await supabase
            .from('products')
            .insert({
              gooten_product_id: gootenProduct.Id,
              name: productName,
              slug: productSlug,
              description: `Custom ${productName} - Print your designs on high-quality products`,
              category_id: category.data.id,
              base_price: 19.99,
              is_active: true,
              metadata: gootenProduct,
              synced_at: new Date().toISOString()
            })
            .select()
            .single();
          productId = newProduct.id;
          productsSynced++;
        }

        const variantsResponse = await fetch(
          `http://localhost:3001/api/prp-variants?productName=${encodeURIComponent(productName)}&countryCode=US`
        );

        if (variantsResponse.ok) {
          const variantsData = await variantsResponse.json();
          const gootenVariants = variantsData.data?.ProductVariants || variantsData.data?.PreconfiguredProducts || [];

          for (const gootenVariant of gootenVariants) {
            try {
              const variantName = gootenVariant.Name || gootenVariant.ProductName || 'Unknown Variant';
              const variantSku = gootenVariant.Sku || `gooten-${Date.now()}`;

              const { data: existingVariant } = await supabase
                .from('product_variants')
                .select('id')
                .eq('gooten_sku', variantSku)
                .maybeSingle();

              const price = parseFloat(gootenVariant.Price?.Price || gootenVariant.Price || 29.99);

              if (existingVariant) {
                await supabase
                  .from('product_variants')
                  .update({
                    name: variantName,
                    price: price,
                    metadata: gootenVariant
                  })
                  .eq('id', existingVariant.id);
              } else {
                const { data: newVariant } = await supabase
                  .from('product_variants')
                  .insert({
                    product_id: productId,
                    gooten_sku: variantSku,
                    name: variantName,
                    sku: `store-${variantSku}`,
                    price: price,
                    inventory_quantity: 999,
                    track_inventory: false,
                    allow_backorder: true,
                    is_active: true,
                    metadata: gootenVariant
                  })
                  .select()
                  .single();

                variantsSynced++;

                if (gootenVariant.Images && gootenVariant.Images.length > 0) {
                  const images = gootenVariant.Images.map((img, index) => ({
                    variant_id: newVariant.id,
                    url: img.Url || img,
                    alt_text: variantName,
                    sort_order: index,
                    is_primary: index === 0
                  }));

                  await supabase.from('product_images').insert(images);
                }
              }

              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (variantError) {
              console.error('Variant sync error:', variantError);
              errors.push({
                type: 'variant',
                sku: gootenVariant.Sku,
                error: variantError.message
              });
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (productError) {
        console.error('Product sync error:', productError);
        errors.push({
          type: 'product',
          product: gootenProduct.Name,
          error: productError.message
        });
      }
    }

    const completedAt = new Date();
    const duration = completedAt - new Date(syncLog.started_at);

    if (syncLogId) {
      await supabase
        .from('sync_logs')
        .update({
          status: errors.length > 0 ? 'partial' : 'success',
          products_synced: productsSynced,
          variants_synced: variantsSynced,
          errors: errors.length > 0 ? errors : null,
          completed_at: completedAt.toISOString(),
          duration_ms: duration
        })
        .eq('id', syncLogId);
    }

    return {
      success: true,
      productsSynced,
      variantsSynced,
      errors: errors.length > 0 ? errors : null
    };
  } catch (error) {
    console.error('Sync failed:', error);
    errors.push({
      type: 'fatal',
      error: error.message
    });

    return {
      success: false,
      error: error.message,
      errors
    };
  }
}

export async function syncProductTemplates(variantId, gootenSku) {
  try {
    const templateResponse = await fetch(
      `http://localhost:3001/api/product-content/${encodeURIComponent(gootenSku)}`
    );

    if (!templateResponse.ok) {
      throw new Error(`Failed to fetch template for SKU: ${gootenSku}`);
    }

    const templateData = await templateResponse.json();

    if (templateData.data && templateData.data.Options) {
      const template = templateData.data.Options[0];

      const { data: existingTemplate } = await supabase
        .from('product_templates')
        .select('id')
        .eq('variant_id', variantId)
        .eq('gooten_sku', gootenSku)
        .maybeSingle();

      const templateRecord = {
        variant_id: variantId,
        gooten_sku: gootenSku,
        template_data: template,
        spaces: template.Spaces || [],
        layers: template.Spaces?.[0]?.Layers || []
      };

      if (existingTemplate) {
        await supabase
          .from('product_templates')
          .update(templateRecord)
          .eq('id', existingTemplate.id);
      } else {
        await supabase
          .from('product_templates')
          .insert(templateRecord);
      }

      return { success: true };
    }

    return { success: false, error: 'No template data found' };
  } catch (error) {
    console.error('Template sync error:', error);
    return { success: false, error: error.message };
  }
}
