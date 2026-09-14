import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const distDir = path.join(__dirname, 'dist');
const distIndexPath = path.join(distDir, 'index.html');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const GOOTEN_RECIPE_ID = process.env.GOOTEN_RECIPE_ID;
const GOOTEN_BASE_URL = 'https://api.print.io';
const GOOTEN_PRP_PRODUCTS_PATH = '/api/v/1/source/api/preconfiguredproducts/';
const GOOTEN_PRP_VARIANTS_PATH = '/api/v/1/source/api/preconfiguredproducts/variants/';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEV_AUTO_CONFIRM_USERS = process.env.DEV_AUTO_CONFIRM_USERS === 'true';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(publicDir));

if (existsSync(distDir)) {
  app.use(express.static(distDir));
}

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'gootenint',
    supabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
    gootenConfigured: Boolean(GOOTEN_RECIPE_ID)
  });
});

const STAFF_ROLES = ['admin', 'super_user', 'publisher'];
const PRODUCT_MANAGER_ROLES = ['admin', 'super_user', 'publisher'];
const SITE_TAGLINE_KEY = 'site_tagline';
const DEFAULT_SITE_TAGLINE = {
  quoteText: 'Your word is a lamp to my feet and a light to my path.',
  attribution: 'PSALM 119:105'
};

function createAuthorizedSupabase(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

function parseBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function authenticateRequest(req, res, next) {
  try {
    const token = parseBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const authClient = createAuthorizedSupabase(token);
    const { data, error } = await authClient.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session' });
    }

    const { data: roleRecord, error: roleError } = await authClient
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (roleError) throw roleError;

    req.user = data.user;
    req.userRole = roleRecord?.role || 'shopper';
    req.supabase = authClient;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ success: false, error: 'Failed to authenticate request' });
  }
}

async function optionalAuthenticateRequest(req, _res, next) {
  try {
    const token = parseBearerToken(req);
    if (!token) return next();

    const authClient = createAuthorizedSupabase(token);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) {
      const { data: roleRecord } = await authClient
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();
      req.user = data.user;
      req.userRole = roleRecord?.role || 'shopper';
      req.supabase = authClient;
    }
  } catch (error) {
    console.warn('Optional authentication failed:', error.message);
  }
  next();
}

function requireRoles(roles) {
  return [
    authenticateRequest,
    (req, res, next) => {
      if (!roles.includes(req.userRole)) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
      next();
    }
  ];
}

async function requireProductAccess(req, res, next) {
  try {
    if (req.userRole === 'admin' || req.userRole === 'super_user') return next();

    const { data: product, error } = await req.supabase
      .from('products')
      .select('id, created_by')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!product || product.created_by !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You can only manage products you created' });
    }

    next();
  } catch (error) {
    console.error('Product access check error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify product access' });
  }
}

function normalizePlainText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
}

function hasMarkupCharacters(value) {
  return /[<>]/.test(value);
}

function normalizeTagline(value = {}) {
  return {
    quoteText: normalizePlainText(value.quoteText, 240),
    attribution: normalizePlainText(value.attribution, 80)
  };
}

function getTaglinePayload(row) {
  const value = row?.value && typeof row.value === 'object' ? row.value : {};
  const tagline = normalizeTagline({
    quoteText: value.quoteText || DEFAULT_SITE_TAGLINE.quoteText,
    attribution: value.attribution || DEFAULT_SITE_TAGLINE.attribution
  });

  return {
    quoteText: tagline.quoteText || DEFAULT_SITE_TAGLINE.quoteText,
    attribution: tagline.attribution || DEFAULT_SITE_TAGLINE.attribution
  };
}

function isMissingSiteSettingsTableError(error) {
  const message = error?.message || '';
  return (
    message.includes("Could not find the table 'public.site_settings'") ||
    message.includes('relation "public.site_settings" does not exist') ||
    message.includes("Could not find the 'site_settings' table")
  );
}

const gootenAxios = axios.create({
  baseURL: GOOTEN_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Connection': 'keep-alive'
  },
  timeout: 30000,
  maxRedirects: 5,
  validateStatus: (status) => status < 600
});

const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 30;
const GOOTEN_CATALOG_URL = 'https://gtnadminassets.blob.core.windows.net/productdatav3/catalog.json';
const GOOTEN_CATALOG_TTL_MS = 24 * 60 * 60 * 1000;

const gootenCatalogCache = {
  fetchedAt: 0,
  descriptionByProductId: new Map()
};

async function hasColumn(table, column) {
  const { error } = await supabase.from(table).select(column).limit(1);
  if (!error) return true;

  const message = error.message || '';
  if (
    message.includes(`column ${table}.${column} does not exist`) ||
    message.includes(`Could not find the '${column}' column`)
  ) {
    return false;
  }

  throw error;
}

async function getProductColumnSupport() {
  const [source, status, deleted_at] = await Promise.all([
    hasColumn('products', 'source'),
    hasColumn('products', 'status'),
    hasColumn('products', 'deleted_at')
  ]);
  return { source, status, deleted_at };
}

async function getGootenCatalogDescriptions() {
  const now = Date.now();
  if (
    gootenCatalogCache.descriptionByProductId.size > 0 &&
    (now - gootenCatalogCache.fetchedAt) < GOOTEN_CATALOG_TTL_MS
  ) {
    return gootenCatalogCache.descriptionByProductId;
  }

  const response = await axios.get(GOOTEN_CATALOG_URL, { timeout: 30000 });
  const catalog = response.data?.['product-catalog'];
  const categories = Array.isArray(catalog) ? catalog : [];
  const descriptionByProductId = new Map();

  for (const category of categories) {
    const items = Array.isArray(category?.items) ? category.items : [];
    for (const item of items) {
      const productId = item?.product_id;
      if (!productId) continue;

      const description = (item?.meta_description || item?.description || '').trim();
      if (description.length === 0) continue;

      if (!descriptionByProductId.has(productId)) {
        descriptionByProductId.set(productId, description);
      }
    }
  }

  gootenCatalogCache.fetchedAt = now;
  gootenCatalogCache.descriptionByProductId = descriptionByProductId;
  return descriptionByProductId;
}

async function getGootenDescriptionForProduct(gootenProduct) {
  const productId =
    gootenProduct?.Items?.[0]?.ProductId ||
    gootenProduct?.ProductId ||
    gootenProduct?.Id ||
    null;
  if (!productId) return null;

  try {
    const descriptions = await getGootenCatalogDescriptions();
    return descriptions.get(productId) || null;
  } catch (error) {
    console.warn('[DESCRIPTION] Failed to load Gooten catalog description:', error.message);
    return null;
  }
}

function extractPrintReadyProducts(data) {
  const candidates = [
    data?.PrintReadyProducts,
    data?.PreconfiguredProducts,
    data?.Products
  ];
  const productList = candidates.find(Array.isArray);
  return productList || [];
}

function extractPrintReadyVariants(data) {
  const candidates = [
    data?.PrintReadyProductVariants,
    data?.ProductVariants,
    data?.Variants,
    data?.PreconfiguredProducts,
    data?.PrintReadyProducts
  ];
  const variantList = candidates.find(Array.isArray);
  return variantList || [];
}

function extractImageUrlsFromData(data) {
  const urls = new Set();
  const keysWithImageHints = ['url', 'imageurl', 'previewurl', 'thumbnailurl', 'thumburl', 'mockupurl', 'src'];

  function walk(value, parentKey = '') {
    if (value === null || value === undefined) return;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^https?:\/\//i.test(trimmed)) {
        const key = parentKey.toLowerCase();
        const looksLikeImageField = keysWithImageHints.some((hint) => key.includes(hint) || key.includes('image'));
        const looksLikeImageUrl = /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(trimmed) || trimmed.includes('images');
        if (looksLikeImageField || looksLikeImageUrl) {
          urls.add(trimmed);
        }
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, parentKey);
      }
      return;
    }

    if (typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        walk(child, key);
      }
    }
  }

  walk(data);
  return Array.from(urls);
}

function getImageUrl(image) {
  if (typeof image === 'string') {
    return /^https?:\/\//i.test(image) ? image : null;
  }

  if (!image || typeof image !== 'object') return null;

  const directUrl =
    image.Url ||
    image.url ||
    image.ImageUrl ||
    image.imageUrl ||
    image.PreviewUrl ||
    image.previewUrl ||
    image.ThumbnailUrl ||
    image.thumbnailUrl ||
    image.MockupUrl ||
    image.mockupUrl;

  return typeof directUrl === 'string' && /^https?:\/\//i.test(directUrl) ? directUrl : null;
}

function getGootenImageIndex(image, fallbackIndex) {
  if (!image || typeof image !== 'object') return fallbackIndex;

  const index = Number(
    image.Index ??
    image.index ??
    image.SortOrder ??
    image.sortOrder ??
    image.Sort ??
    image.sort
  );

  return Number.isFinite(index) ? index : fallbackIndex;
}

function getGootenPrimaryFlag(image) {
  if (!image || typeof image !== 'object') return null;

  const explicitFlag =
    image.IsPrimary ??
    image.isPrimary ??
    image.is_primary ??
    image.Primary ??
    image.primary ??
    image.IsDefault ??
    image.isDefault ??
    image.Default ??
    image.default ??
    image.IsMain ??
    image.isMain;

  return typeof explicitFlag === 'boolean' ? explicitFlag : null;
}

function extractGootenImageRecords(source, startingSortOrder = 0) {
  const imageRecordsByUrl = new Map();
  const sourceImages = Array.isArray(source?.Images) ? source.Images : [];

  for (const [index, image] of sourceImages.entries()) {
    const url = getImageUrl(image);
    if (!url) continue;

    const sortOrder = getGootenImageIndex(image, startingSortOrder + index);
    const isPrimary = getGootenPrimaryFlag(image);
    const existing = imageRecordsByUrl.get(url);

    if (!existing || sortOrder < existing.sort_order || (isPrimary === true && existing.gooten_is_primary !== true)) {
      imageRecordsByUrl.set(url, {
        url,
        sort_order: sortOrder,
        gooten_is_primary: isPrimary,
        width: Number.isFinite(Number(image?.Width ?? image?.width)) ? Number(image.Width ?? image.width) : null,
        height: Number.isFinite(Number(image?.Height ?? image?.height)) ? Number(image.Height ?? image.height) : null
      });
    }
  }

  const imageRecords = Array.from(imageRecordsByUrl.values())
    .sort((a, b) => a.sort_order - b.sort_order);

  const hasGootenPrimary = imageRecords.some((image) => image.gooten_is_primary === true);
  return imageRecords.map((image, index) => ({
    ...image,
    sort_order: Number.isFinite(image.sort_order) ? image.sort_order : index,
    is_primary: hasGootenPrimary ? image.gooten_is_primary === true : index === 0,
    primary_source: hasGootenPrimary ? 'gooten' : 'sort_order'
  }));
}

function mergeImageRecords(...imageRecordLists) {
  const mergedByUrl = new Map();

  for (const imageRecords of imageRecordLists) {
    for (const image of imageRecords) {
      if (!image?.url) continue;

      const existing = mergedByUrl.get(image.url);
      if (!existing || image.sort_order < existing.sort_order || (image.is_primary && !existing.is_primary)) {
        mergedByUrl.set(image.url, image);
      }
    }
  }

  const merged = Array.from(mergedByUrl.values())
    .sort((a, b) => a.sort_order - b.sort_order);

  const gootenPrimary =
    merged.find((image) => image.is_primary && image.primary_source === 'gooten') ||
    merged.find((image) => image.is_primary);
  return merged.map((image, index) => ({
    ...image,
    sort_order: index,
    is_primary: gootenPrimary ? image.url === gootenPrimary.url : index === 0
  }));
}

async function fetchVariantTemplateImageRecords(variantSku, countryCode = 'US') {
  try {
    const response = await gootenAxios.get('/api/v/5/source/api/producttemplates/', {
      params: {
        RecipeId: GOOTEN_RECIPE_ID,
        sku: variantSku,
        countryCode
      }
    });

    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
      return [];
    }

    return extractImageUrlsFromData(response.data).map((url, index) => ({
      url,
      sort_order: index,
      is_primary: index === 0,
      primary_source: 'sort_order',
      width: null,
      height: null
    }));
  } catch (error) {
    console.warn(`[IMAGE FALLBACK] Failed to load template images for SKU ${variantSku}:`, error.message);
    return [];
  }
}

async function saveVariantImageRecords(variantId, variantName, imageRecords, db = supabase) {
  if (!variantId || !Array.isArray(imageRecords) || imageRecords.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  const { data: existingImages, error: existingImagesError } = await db
    .from('product_images')
    .select('id, url')
    .eq('variant_id', variantId);

  if (existingImagesError) {
    throw new Error(`Failed to load existing images for ${variantName}: ${existingImagesError.message}`);
  }

  const existingImageByUrl = new Map((existingImages || []).map((image) => [image.url, image]));

  const { error: clearPrimaryError } = await db
    .from('product_images')
    .update({ is_primary: false })
    .eq('variant_id', variantId);

  if (clearPrimaryError) {
    throw new Error(`Failed resetting primary images for ${variantName}: ${clearPrimaryError.message}`);
  }

  let updated = 0;
  const imagesToInsert = [];

  for (const imageRecord of imageRecords) {
    const existingImage = existingImageByUrl.get(imageRecord.url);
    const imagePayload = {
      alt_text: variantName,
      sort_order: imageRecord.sort_order,
      is_primary: imageRecord.is_primary,
      width: imageRecord.width,
      height: imageRecord.height
    };

    if (existingImage) {
      const { error: updateImageError } = await db
        .from('product_images')
        .update(imagePayload)
        .eq('id', existingImage.id);

      if (updateImageError) {
        throw new Error(`Failed updating image for ${variantName}: ${updateImageError.message}`);
      }
      updated++;
    } else {
      imagesToInsert.push({
        ...imagePayload,
        variant_id: variantId,
        url: imageRecord.url
      });
    }
  }

  if (imagesToInsert.length > 0) {
    const { error: insertImagesError } = await db
      .from('product_images')
      .insert(imagesToInsert);

    if (insertImagesError) {
      throw new Error(`Failed inserting images for ${variantName}: ${insertImagesError.message}`);
    }
  }

  return { inserted: imagesToInsert.length, updated };
}

function parseGootenPrice(value) {
  const candidate =
    value?.Pricing?.Price ??
    value?.Pricing?.UnitPrice ??
    value?.UnitPrice ??
    value?.Price?.Price ??
    value?.Price ??
    null;

  const parsed = Number(candidate);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

async function checkRateLimit(endpoint) {
  const now = new Date();

  const { data: rateLimitData, error } = await supabase
    .from('api_rate_limit')
    .select('*')
    .eq('endpoint', endpoint)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Rate limit check error:', error);
    return { allowed: true };
  }

  if (!rateLimitData) {
    await supabase.from('api_rate_limit').insert({
      endpoint,
      request_count: 1,
      window_start: now.toISOString(),
      last_request: now.toISOString()
    });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  const windowStart = new Date(rateLimitData.window_start);
  const timeSinceWindowStart = now - windowStart;

  if (timeSinceWindowStart > RATE_LIMIT_WINDOW) {
    await supabase
      .from('api_rate_limit')
      .update({
        request_count: 1,
        window_start: now.toISOString(),
        last_request: now.toISOString()
      })
      .eq('endpoint', endpoint);
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (rateLimitData.request_count >= MAX_REQUESTS_PER_WINDOW) {
    const resetIn = RATE_LIMIT_WINDOW - timeSinceWindowStart;
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil(resetIn / 1000)
    };
  }

  await supabase
    .from('api_rate_limit')
    .update({
      request_count: rateLimitData.request_count + 1,
      last_request: now.toISOString()
    })
    .eq('endpoint', endpoint);

  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - rateLimitData.request_count - 1
  };
}

async function getCachedData(table, keyColumn, keyValue, additionalKey = null) {
  let query = supabase
    .from(table)
    .select('*')
    .eq(keyColumn, keyValue)
    .gt('expires_at', new Date().toISOString());

  if (additionalKey) {
    query = query.eq(Object.keys(additionalKey)[0], Object.values(additionalKey)[0]);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error(`Cache lookup error for ${table}:`, error);
    return null;
  }

  return data;
}

async function setCachedData(table, data, keyColumn, keyValue, additionalKeys = {}) {
  const cacheData = {
    [keyColumn]: keyValue,
    ...additionalKeys,
    data: data,
    cached_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  console.log(`[CACHE WRITE] Table: ${table}, Key: ${keyColumn}=${keyValue}`);
  console.log(`[CACHE WRITE] Additional keys:`, additionalKeys);

  const { data: result, error } = await supabase
    .from(table)
    .upsert(cacheData, { onConflict: keyColumn });

  if (error) {
    console.error(`[CACHE ERROR] Failed to write to ${table}:`, error);
  } else {
    console.log(`[CACHE SUCCESS] Data written to ${table}`);
  }
}

function handleApiError(error, defaultUrl) {
  console.error('Gooten API Error:', error.response?.data || error.message);
  console.error('Error code:', error.code);

  let statusCode = 500;
  let errorMessage = error.message;

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    statusCode = 504;
    errorMessage = 'Request timeout - Gooten API did not respond in time';
  } else if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorMessage = 'Connection error - Unable to reach Gooten API';
  } else if (error.response) {
    statusCode = error.response.status;
  }

  return {
    statusCode,
    body: {
      success: false,
      url: error.config?.url || defaultUrl,
      statusCode,
      error: errorMessage,
      errorCode: error.code,
      details: error.response?.data || null
    }
  };
}

app.get('/api/prp-products', async (req, res) => {
  try {
    const { countryCode = 'US', productName } = req.query;
    const endpoint = 'prp-products';

    const rateLimit = await checkRateLimit(endpoint);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        resetIn: rateLimit.resetIn
      });
    }

    const cacheKey = productName || 'all_products';
    const cached = await getCachedData('gooten_product_cache', 'product_name', cacheKey, { country_code: countryCode });

    if (cached) {
      return res.json({
        success: true,
        cached: true,
        data: cached.data,
        rateLimit: { remaining: rateLimit.remaining }
      });
    }

    const url = GOOTEN_PRP_PRODUCTS_PATH;
    const params = {
      RecipeId: GOOTEN_RECIPE_ID,
      countryCode
    };

    if (productName) {
      params.productName = productName;
    }

    console.log('[API REQUEST] Gooten API:', `${GOOTEN_BASE_URL}${url}`, params);

    await new Promise(resolve => setTimeout(resolve, 500));

    const response = await gootenAxios.get(url, { params });
    console.log('[API RESPONSE] Status:', response.status, 'Data type:', typeof response.data);

    await setCachedData('gooten_product_cache', response.data, 'product_name', cacheKey, { country_code: countryCode });

    res.json({
      success: true,
      cached: false,
      url: `${GOOTEN_BASE_URL}${url}?${new URLSearchParams(params).toString()}`,
      statusCode: response.status,
      data: response.data,
      rateLimit: { remaining: rateLimit.remaining }
    });
  } catch (error) {
    const errorResponse = handleApiError(error, `${GOOTEN_BASE_URL}${GOOTEN_PRP_PRODUCTS_PATH}`);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
});

app.get('/api/prp-variants', async (req, res) => {
  try {
    const { productName, countryCode = 'US' } = req.query;

    if (!productName) {
      return res.status(400).json({
        success: false,
        error: 'productName query parameter is required'
      });
    }

    const endpoint = 'prp-variants';

    const rateLimit = await checkRateLimit(endpoint);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        resetIn: rateLimit.resetIn
      });
    }

    const cached = await getCachedData('gooten_variant_cache', 'product_name', productName, { country_code: countryCode });

    if (cached) {
      return res.json({
        success: true,
        cached: true,
        data: cached.data,
        rateLimit: { remaining: rateLimit.remaining }
      });
    }

    const url = GOOTEN_PRP_VARIANTS_PATH;
    const params = {
      RecipeId: GOOTEN_RECIPE_ID,
      countryCode,
      productName
    };

    console.log('[API REQUEST] Gooten Variants API:', `${GOOTEN_BASE_URL}${url}`, params);

    await new Promise(resolve => setTimeout(resolve, 500));

    const response = await gootenAxios.get(url, { params });
    console.log('[API RESPONSE] Status:', response.status, 'Data type:', typeof response.data);

    await setCachedData('gooten_variant_cache', response.data, 'product_name', productName, { country_code: countryCode });

    res.json({
      success: true,
      cached: false,
      url: `${GOOTEN_BASE_URL}${url}?${new URLSearchParams(params).toString()}`,
      statusCode: response.status,
      data: response.data,
      rateLimit: { remaining: rateLimit.remaining }
    });
  } catch (error) {
    const errorResponse = handleApiError(error, `${GOOTEN_BASE_URL}${GOOTEN_PRP_VARIANTS_PATH}`);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
});

app.get('/api/product-content/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    const { countryCode = 'US' } = req.query;
    const endpoint = 'product-content';

    const rateLimit = await checkRateLimit(endpoint);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        resetIn: rateLimit.resetIn
      });
    }

    const cached = await getCachedData('gooten_content_cache', 'sku', sku);

    if (cached) {
      return res.json({
        success: true,
        cached: true,
        data: cached.content_data,
        rateLimit: { remaining: rateLimit.remaining }
      });
    }

    const url = `/api/v/5/source/api/producttemplates/`;
    const params = {
      RecipeId: GOOTEN_RECIPE_ID,
      sku: sku,
      countryCode
    };

    console.log('[API REQUEST] Gooten Product Template API:', `${GOOTEN_BASE_URL}${url}`, params);

    await new Promise(resolve => setTimeout(resolve, 500));

    const response = await gootenAxios.get(url, { params });
    console.log('[API RESPONSE] Status:', response.status, 'Content-Type:', response.headers['content-type']);
    console.log('[API RESPONSE] Data type:', typeof response.data, 'Is HTML:', typeof response.data === 'string' && response.data.includes('<!DOCTYPE'));

    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
      throw new Error('Received HTML instead of JSON from Gooten API. Check API endpoint and parameters.');
    }

    const { error: cacheError } = await supabase.from('gooten_content_cache').upsert({
      sku,
      content_data: response.data,
      cached_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }, { onConflict: 'sku' });

    if (cacheError) {
      console.error('[CACHE ERROR] Failed to cache content:', cacheError);
    } else {
      console.log('[CACHE SUCCESS] Content data cached for SKU:', sku);
    }

    res.json({
      success: true,
      cached: false,
      url: `${GOOTEN_BASE_URL}${url}?${new URLSearchParams(params).toString()}`,
      statusCode: response.status,
      data: response.data,
      rateLimit: { remaining: rateLimit.remaining }
    });
  } catch (error) {
    const errorResponse = handleApiError(error, `${GOOTEN_BASE_URL}/api/v/5/source/api/producttemplates/`);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
});

app.get('/api/product-images/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    const endpoint = 'product-images';

    const rateLimit = await checkRateLimit(endpoint);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        resetIn: rateLimit.resetIn
      });
    }

    const cached = await getCachedData('gooten_image_cache', 'sku', sku);

    if (cached) {
      return res.json({
        success: true,
        cached: true,
        data: cached.image_data,
        rateLimit: { remaining: rateLimit.remaining }
      });
    }

    const url = `/api/v/5/source/api/producttemplates/`;
    const params = {
      RecipeId: GOOTEN_RECIPE_ID,
      sku: sku
    };

    console.log('[API REQUEST] Gooten Product Template API (Images):', `${GOOTEN_BASE_URL}${url}`, params);

    await new Promise(resolve => setTimeout(resolve, 500));

    const response = await gootenAxios.get(url, { params });
    console.log('[API RESPONSE] Status:', response.status, 'Content-Type:', response.headers['content-type']);
    console.log('[API RESPONSE] Data type:', typeof response.data, 'Is HTML:', typeof response.data === 'string' && response.data.includes('<!DOCTYPE'));

    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
      throw new Error('Received HTML instead of JSON from Gooten API. Check API endpoint and parameters.');
    }

    const { error: cacheError } = await supabase.from('gooten_image_cache').upsert({
      sku,
      image_data: response.data,
      cached_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }, { onConflict: 'sku' });

    if (cacheError) {
      console.error('[CACHE ERROR] Failed to cache images:', cacheError);
    } else {
      console.log('[CACHE SUCCESS] Image data cached for SKU:', sku);
    }

    res.json({
      success: true,
      cached: false,
      url: `${GOOTEN_BASE_URL}${url}?${new URLSearchParams(params).toString()}`,
      statusCode: response.status,
      data: response.data,
      rateLimit: { remaining: rateLimit.remaining }
    });
  } catch (error) {
    const errorResponse = handleApiError(error, `${GOOTEN_BASE_URL}/api/v/5/source/api/producttemplates/`);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
});

app.get('/api/product-skus', async (req, res) => {
  try {
    const { productName, countryCode = 'US' } = req.query;

    if (!productName) {
      return res.status(400).json({
        success: false,
        error: 'productName query parameter is required'
      });
    }

    const url = `/api/v/1/source/api/productvariantswithskus/`;
    const params = {
      RecipeId: GOOTEN_RECIPE_ID,
      countryCode,
      productName
    };

    console.log('Requesting Gooten SKUs:', `${GOOTEN_BASE_URL}${url}`, params);

    await new Promise(resolve => setTimeout(resolve, 500));

    const response = await gootenAxios.get(url, { params });

    res.json({
      success: true,
      url: `${GOOTEN_BASE_URL}${url}?${new URLSearchParams(params).toString()}`,
      statusCode: response.status,
      data: response.data
    });
  } catch (error) {
    const errorResponse = handleApiError(error, `${GOOTEN_BASE_URL}/api/v/1/source/api/productvariantswithskus/`);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
});

app.get('/api/cache/clear', ...requireRoles(['admin', 'super_user']), async (req, res) => {
  try {
    const { table } = req.query;

    if (table) {
      const validTables = ['gooten_product_cache', 'gooten_variant_cache', 'gooten_content_cache', 'gooten_image_cache'];
      if (!validTables.includes(table)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid table name'
        });
      }

      await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      return res.json({
        success: true,
        message: `Cleared cache for ${table}`
      });
    }

    await Promise.all([
      supabase.from('gooten_product_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('gooten_variant_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('gooten_content_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('gooten_image_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    ]);

    res.json({
      success: true,
      message: 'All caches cleared'
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/auth/me', ...requireRoles(['admin', 'super_user', 'publisher', 'shopper']), async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email
    },
    role: req.userRole
  });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'email and password are required'
      });
    }

    if (!DEV_AUTO_CONFIRM_USERS) {
      return res.status(409).json({
        success: false,
        error: 'Developer auto-confirm signup is disabled'
      });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY is required for developer auto-confirm signup'
      });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error) throw error;

    res.status(201).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email
      }
    });
  } catch (error) {
    console.error('Developer signup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/account/orders', ...requireRoles(['admin', 'super_user', 'publisher', 'shopper']), async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('orders')
      .select(`
        id, status, total_amount, created_at, metadata,
        items:order_items(id, product_name, product_slug, quantity, unit_price, image_url)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      orders: data || []
    });
  } catch (error) {
    console.error('Account orders fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/store/orders', optionalAuthenticateRequest, async (req, res) => {
  try {
    const { items, email, customer, shippingAddress, payment } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'items are required'
      });
    }

    const normalizedItems = items.map((item) => ({
      product_id: item.productId || null,
      variant_id: item.variantId || null,
      product_name: String(item.productName || 'Product').slice(0, 200),
      product_slug: item.productSlug || null,
      variant_name: item.variantName || null,
      sku: item.sku || null,
      quantity: Math.max(1, Number(item.quantity) || 1),
      unit_price: Math.max(0, Number(item.price) || 0),
      image_url: item.imageUrl || null
    }));
    const totalAmount = normalizedItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const db = supabaseAdmin || req.supabase || supabase;
    const orderMetadata = {
      flow: 'mock_checkout',
      customer: customer || null,
      shippingAddress: shippingAddress || null,
      payment: payment
        ? {
            provider: payment.provider || 'mock',
            label: payment.label || 'Mock payment',
            last4: payment.last4 || null
          }
        : null
    };

    const { data: order, error: orderError } = await db
      .from('orders')
      .insert({
        user_id: req.user?.id || null,
        email: req.user?.email || email || customer?.email || null,
        status: 'completed',
        total_amount: totalAmount,
        metadata: orderMetadata
      })
      .select('id, status, total_amount, created_at')
      .single();

    if (orderError) throw orderError;

    const { error: itemsError } = await db
      .from('order_items')
      .insert(normalizedItems.map((item) => ({
        ...item,
        order_id: order.id
      })));

    if (itemsError) throw itemsError;

    res.status(201).json({
      success: true,
      order: {
        ...order,
        items: normalizedItems
      }
    });
  } catch (error) {
    console.error('Order create error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/store/products', async (req, res) => {
  try {
    const { category, featured, limit = 50, offset = 0 } = req.query;
    const productColumns = await getProductColumnSupport();

    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, slug, image_url),
        variants:product_variants(
          id, name, sku, price, compare_at_price, size, color,
          images:product_images(id, url, alt_text, is_primary, sort_order)
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (productColumns.status) {
      query = query.neq('status', 'deleted');
    }

    if (category) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', category)
        .single();

      if (cat) {
        query = query.eq('category_id', cat.id);
      }
    }

    if (featured === 'true') {
      query = query.eq('is_featured', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      products: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/store/products/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const productColumns = await getProductColumnSupport();

    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, slug, image_url),
        variants:product_variants(
          id, name, sku, gooten_sku, price, compare_at_price,
          size, color, material, inventory_quantity, is_active,
          images:product_images(id, url, alt_text, is_primary, sort_order),
          template:product_templates(id, template_data, spaces, layers)
        )
      `)
      .eq('slug', slug)
      .eq('is_active', true);

    if (productColumns.status) {
      query = query.neq('status', 'deleted');
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      product: data
    });
  } catch (error) {
    console.error('Product fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/store/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;

    res.json({
      success: true,
      categories: data || []
    });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/store/site-tagline', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', SITE_TAGLINE_KEY)
      .maybeSingle();

    if (error) throw error;

    res.json({
      success: true,
      tagline: getTaglinePayload(data)
    });
  } catch (error) {
    console.error('Site tagline fetch error:', error);
    res.json({
      success: true,
      tagline: DEFAULT_SITE_TAGLINE
    });
  }
});

app.get('/api/admin/site-tagline', ...requireRoles(['admin', 'super_user']), async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('site_settings')
      .select('value')
      .eq('key', SITE_TAGLINE_KEY)
      .maybeSingle();

    if (error) throw error;

    res.json({
      success: true,
      tagline: getTaglinePayload(data)
    });
  } catch (error) {
    console.error('Admin site tagline fetch error:', error);
    if (isMissingSiteSettingsTableError(error)) {
      return res.status(503).json({
        success: false,
        error: 'Site tagline settings are not installed yet. Apply the latest Supabase migration, then restart the API server.'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/admin/site-tagline', ...requireRoles(['admin', 'super_user']), async (req, res) => {
  try {
    const { quoteText, attribution } = req.body || {};

    if (typeof quoteText !== 'string' || typeof attribution !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Quote text and attribution are required'
      });
    }

    if (hasMarkupCharacters(quoteText) || hasMarkupCharacters(attribution)) {
      return res.status(400).json({
        success: false,
        error: 'Only plain text is allowed'
      });
    }

    const tagline = normalizeTagline({ quoteText, attribution });

    if (!tagline.quoteText || !tagline.attribution) {
      return res.status(400).json({
        success: false,
        error: 'Quote text and attribution cannot be blank'
      });
    }

    const { data, error } = await req.supabase
      .from('site_settings')
      .upsert({
        key: SITE_TAGLINE_KEY,
        value: tagline,
        updated_at: new Date().toISOString()
      })
      .select('value')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      tagline: getTaglinePayload(data)
    });
  } catch (error) {
    console.error('Admin site tagline update error:', error);
    if (isMissingSiteSettingsTableError(error)) {
      return res.status(503).json({
        success: false,
        error: 'Site tagline settings are not installed yet. Apply the latest Supabase migration, then restart the API server.'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/admin/categories', ...requireRoles(STAFF_ROLES), async (req, res) => {
  try {
    const db = req.supabase;
    const { activeOnly = 'false' } = req.query;

    let query = db
      .from('categories')
      .select('*')
      .order('sort_order');

    if (activeOnly === 'true') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      categories: data || []
    });
  } catch (error) {
    console.error('Admin categories fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/admin/categories/upload-image', ...requireRoles(['admin']), express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { filename, dataUrl } = req.body;

    if (!filename || !dataUrl || typeof filename !== 'string' || typeof dataUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'filename and dataUrl are required'
      });
    }

    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({
        success: false,
        error: 'Invalid image data format'
      });
    }

    const mimeType = match[1].toLowerCase();
    const base64Payload = match[2];
    const allowedMimeTypes = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif'
    };

    const extension = allowedMimeTypes[mimeType];
    if (!extension) {
      return res.status(400).json({
        success: false,
        error: `Unsupported image type: ${mimeType}`
      });
    }

    const safeName = filename
      .toLowerCase()
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'category';

    const outputFileName = `${safeName}-${Date.now()}.${extension}`;
    const relativeImagePath = `images/categories/${outputFileName}`;
    const outputPath = path.join(__dirname, 'public', relativeImagePath);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, Buffer.from(base64Payload, 'base64'));

    res.json({
      success: true,
      image_path: outputFileName,
      image_url: `/${relativeImagePath.replace(/\\/g, '/')}`
    });
  } catch (error) {
    console.error('Category image upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/admin/categories', ...requireRoles(['admin']), async (req, res) => {
  try {
    const db = req.supabase;
    const { name, slug, description, image_url, sort_order = 0, is_active = true } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'name is required'
      });
    }

    const normalizedName = name.trim();
    const normalizedSlug = (typeof slug === 'string' && slug.trim().length > 0
      ? slug
      : normalizedName
    )
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const { data, error } = await db
      .from('categories')
      .insert({
        name: normalizedName,
        slug: normalizedSlug,
        description: typeof description === 'string' ? description : null,
        image_url: typeof image_url === 'string' ? image_url : null,
        sort_order: Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
        is_active: Boolean(is_active)
      })
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      category: data
    });
  } catch (error) {
    console.error('Admin category create error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/admin/categories/:id', ...requireRoles(['admin']), async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const { name, slug, description, image_url, sort_order, is_active } = req.body;
    const updatePayload = {};

    if (typeof name === 'string') {
      updatePayload.name = name.trim();
    }

    if (typeof slug === 'string') {
      updatePayload.slug = slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    if (typeof description === 'string' || description === null) {
      updatePayload.description = description;
    }

    if (typeof image_url === 'string' || image_url === null) {
      updatePayload.image_url = image_url;
    }

    if (sort_order !== undefined) {
      updatePayload.sort_order = Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0;
    }

    if (is_active !== undefined) {
      updatePayload.is_active = Boolean(is_active);
    }

    const { data, error } = await db
      .from('categories')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    res.json({
      success: true,
      category: data
    });
  } catch (error) {
    console.error('Admin category update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/admin/categories/:id', ...requireRoles(['admin']), async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;

    const { data, error } = await db
      .from('categories')
      .update({ is_active: false })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    res.json({
      success: true,
      category: data
    });
  } catch (error) {
    console.error('Admin category remove error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/admin/products', ...requireRoles(PRODUCT_MANAGER_ROLES), async (req, res) => {
  try {
    const db = req.supabase;
    let query = db
      .from('products')
      .select(`
        id, name, slug, description, is_active, category_id, created_at, created_by,
        category:categories(id, name, slug),
        variants:product_variants(
          id,
          images:product_images(id, url, is_primary, sort_order)
        )
      `)
      .order('created_at', { ascending: false });

    if (req.userRole === 'publisher') {
      query = query.eq('created_by', req.user.id);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      products: data || []
    });
  } catch (error) {
    console.error('Admin products fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/admin/products', ...requireRoles(PRODUCT_MANAGER_ROLES), async (req, res) => {
  try {
    const db = req.supabase;
    const productColumns = await getProductColumnSupport();
    const timestamp = Date.now();
    const insertPayload = {
      name: 'Untitled Product',
      slug: `untitled-product-${timestamp}`,
      description: '',
      short_description: '',
      category_id: null,
      base_price: 0,
      is_active: false,
      is_featured: false,
      metadata: {},
      created_by: req.user.id
    };

    if (productColumns.source) {
      insertPayload.source = 'manual';
    }
    if (productColumns.status) {
      insertPayload.status = 'pending';
    }

    const { data, error } = await db
      .from('products')
      .insert(insertPayload)
      .select('id, name, slug')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      product: data
    });
  } catch (error) {
    console.error('Admin product create error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/admin/products/:id', ...requireRoles(PRODUCT_MANAGER_ROLES), requireProductAccess, async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;

    const { data, error } = await db
      .from('products')
      .select(`
        id, name, slug, description, short_description, is_active, category_id, created_at, updated_at,
        category:categories(id, name, slug),
        variants:product_variants(
          id, name, sku, gooten_sku, price, is_active, sort_order,
          images:product_images(id, url, alt_text, is_primary, sort_order)
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      product: data
    });
  } catch (error) {
    console.error('Admin product fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/admin/products/:id/images/refresh', ...requireRoles(PRODUCT_MANAGER_ROLES), requireProductAccess, async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;

    const { data: product, error: productError } = await db
      .from('products')
      .select(`
        id, name, metadata,
        variants:product_variants(id, name, gooten_sku)
      `)
      .eq('id', id)
      .maybeSingle();

    if (productError) throw productError;

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const variants = product.variants || [];
    const variantsResponse = await axios.get(
      `${GOOTEN_BASE_URL}${GOOTEN_PRP_VARIANTS_PATH}`,
      {
        params: {
          RecipeId: GOOTEN_RECIPE_ID,
          countryCode: 'US',
          productName: product.name
        }
      }
    );

    const gootenVariants = extractPrintReadyVariants(variantsResponse.data);
    const gootenVariantBySku = new Map(
      gootenVariants
        .filter((variant) => variant?.Sku)
        .map((variant) => [String(variant.Sku).trim(), variant])
    );

    let imagesInserted = 0;
    let imagesUpdated = 0;
    const errors = [];

    for (const variant of variants) {
      try {
        if (!variant.gooten_sku) continue;

        const gootenVariant = gootenVariantBySku.get(String(variant.gooten_sku).trim());
        const variantImageRecords = extractGootenImageRecords(gootenVariant);
        const productImageRecords = String(product.metadata?.Sku || '').trim() === String(variant.gooten_sku || '').trim()
          ? extractGootenImageRecords(product.metadata)
          : [];
        let imageRecords = mergeImageRecords(productImageRecords, variantImageRecords);

        if (imageRecords.length === 0) {
          const templateImageRecords = await fetchVariantTemplateImageRecords(variant.gooten_sku, 'US');
          imageRecords = mergeImageRecords(templateImageRecords);
        }

        if (imageRecords.length === 0) continue;

        const result = await saveVariantImageRecords(variant.id, variant.name, imageRecords, db);
        imagesInserted += result.inserted;
        imagesUpdated += result.updated;
      } catch (variantError) {
        errors.push({
          variant_id: variant.id,
          gooten_sku: variant.gooten_sku,
          error: variantError.message
        });
      }
    }

    res.json({
      success: errors.length === 0,
      imagesInserted,
      imagesUpdated,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    console.error('Admin product image refresh error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/admin/products/:id/variants', ...requireRoles(PRODUCT_MANAGER_ROLES), requireProductAccess, async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const { variants } = req.body;

    if (!Array.isArray(variants)) {
      return res.status(400).json({
        success: false,
        error: 'variants must be an array'
      });
    }

    const { data: existingVariants, error: variantsError } = await db
      .from('product_variants')
      .select('id')
      .eq('product_id', id);

    if (variantsError) throw variantsError;

    const allowedVariantIds = new Set((existingVariants || []).map((variant) => variant.id));
    const requestedVariantIds = variants
      .map((variant) => variant?.id)
      .filter((variantId) => typeof variantId === 'string' && allowedVariantIds.has(variantId));

    const { data: existingImages, error: imagesError } = requestedVariantIds.length > 0
      ? await db
        .from('product_images')
        .select('id, variant_id')
        .in('variant_id', requestedVariantIds)
      : { data: [], error: null };

    if (imagesError) throw imagesError;

    const allowedImageIds = new Set((existingImages || []).map((image) => image.id));

    for (const [index, variant] of variants.entries()) {
      if (!variant || !allowedVariantIds.has(variant.id)) continue;

      const name = typeof variant.name === 'string' ? variant.name.trim() : '';
      const sku = typeof variant.sku === 'string' ? variant.sku.trim() : '';
      const price = Number(variant.price);

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'variant name is required'
        });
      }

      if (!sku) {
        return res.status(400).json({
          success: false,
          error: 'variant sku is required'
        });
      }

      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({
          success: false,
          error: 'variant price must be a non-negative number'
        });
      }

      const { error: updateVariantError } = await db
        .from('product_variants')
        .update({
          name,
          sku,
          price,
          is_active: Boolean(variant.is_active),
          sort_order: Number.isFinite(Number(variant.sort_order)) ? Number(variant.sort_order) : index
        })
        .eq('id', variant.id)
        .eq('product_id', id);

      if (updateVariantError) throw updateVariantError;

      const images = Array.isArray(variant.images) ? variant.images : [];
      for (const image of images) {
        if (!image || !allowedImageIds.has(image.id)) continue;

        const url = typeof image.url === 'string' ? image.url.trim() : '';
        if (!url) {
          return res.status(400).json({
            success: false,
            error: 'image url is required'
          });
        }

        const { error: updateImageError } = await db
          .from('product_images')
          .update({
            url,
            alt_text: typeof image.alt_text === 'string' ? image.alt_text : null
          })
          .eq('id', image.id)
          .eq('variant_id', variant.id);

        if (updateImageError) throw updateImageError;
      }
    }

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Admin product variant update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/admin/products/:id/images', ...requireRoles(PRODUCT_MANAGER_ROLES), requireProductAccess, async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const { images } = req.body;

    if (!Array.isArray(images)) {
      return res.status(400).json({
        success: false,
        error: 'images must be an array'
      });
    }

    const { data: variants, error: variantsError } = await db
      .from('product_variants')
      .select('id')
      .eq('product_id', id);

    if (variantsError) throw variantsError;

    const variantIds = (variants || []).map((variant) => variant.id);
    if (variantIds.length === 0) {
      return res.json({ success: true });
    }

    const { data: existingImages, error: existingImagesError } = await db
      .from('product_images')
      .select('id')
      .in('variant_id', variantIds);

    if (existingImagesError) throw existingImagesError;

    const allowedImageIds = new Set((existingImages || []).map((image) => image.id));
    const normalizedImages = images
      .filter((image) => allowedImageIds.has(image.id))
      .map((image, index) => ({
        id: image.id,
        sort_order: Number.isFinite(Number(image.sort_order)) ? Number(image.sort_order) : index,
        is_primary: Boolean(image.is_primary)
      }))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image, index) => ({
        ...image,
        sort_order: index
      }));

    const primaryImage = normalizedImages.find((image) => image.is_primary) || normalizedImages[0];

    const { error: clearPrimaryError } = await db
      .from('product_images')
      .update({ is_primary: false })
      .in('variant_id', variantIds);

    if (clearPrimaryError) throw clearPrimaryError;

    for (const image of normalizedImages) {
      const { error: updateImageError } = await db
        .from('product_images')
        .update({
          sort_order: image.sort_order,
          is_primary: primaryImage ? image.id === primaryImage.id : false
        })
        .eq('id', image.id);

      if (updateImageError) throw updateImageError;
    }

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Admin product image update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/admin/products/:id', ...requireRoles(PRODUCT_MANAGER_ROLES), requireProductAccess, async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const { name, description, short_description, category_id, is_active } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'name is required'
      });
    }

    const updatePayload = {
      name: name.trim(),
      description: typeof description === 'string' ? description : null,
      short_description: typeof short_description === 'string' ? short_description : null,
      category_id: category_id || null,
      is_active: Boolean(is_active)
    };

    const { data, error } = await db
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select('id, name, slug, description, short_description, is_active, category_id, updated_at')
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      product: data
    });
  } catch (error) {
    console.error('Admin product update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/admin/sync-products', ...requireRoles(['admin', 'super_user']), async (req, res) => {
  try {
    const db = req.supabase;
    const startTime = Date.now();
    const productColumns = await getProductColumnSupport();

    const { data: logEntry } = await db
      .from('sync_logs')
      .insert({
        sync_type: 'full_products',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    const syncLogId = logEntry?.id;
    let productsSynced = 0;
    let variantsSynced = 0;
    let productsDeleted = 0;
    const errors = [];

    function slugify(text) {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    const productsResponse = await axios.get(`${GOOTEN_BASE_URL}${GOOTEN_PRP_PRODUCTS_PATH}`, {
      params: { RecipeId: GOOTEN_RECIPE_ID, countryCode: 'US' }
    });

    const gootenProducts = extractPrintReadyProducts(productsResponse.data);
    const seenGootenProductIds = new Set();

    for (const gootenProduct of gootenProducts) {
      try {
        const productName = gootenProduct.Name || gootenProduct.ProductName || 'Unknown Product';
        const productSlug = slugify(productName);
        const gootenDescription = await getGootenDescriptionForProduct(gootenProduct);
        const productPrice = parseGootenPrice(gootenProduct);

        if (productPrice !== null && productPrice <= 0) {
          console.log(`[SYNC SKIP] Skipping product with non-positive price: ${productName}`);
          continue;
        }

        const nameBasedKey = `name:${productSlug}`;
        const gootenProductId = String(
          gootenProduct.Id ||
          gootenProduct.ProductId ||
          nameBasedKey
        ).trim();

        if (!gootenProductId) {
          throw new Error(`Skipping product "${productName}" because no stable Gooten identifier was provided`);
        }
        seenGootenProductIds.add(gootenProductId);

        const { data: category, error: categoryError } = await db
          .from('categories')
          .select('id')
          .eq('slug', 'print-on-demand')
          .maybeSingle();

        let categoryId;
        if (!category) {
          const { data: newCategory, error: insertError } = await db
            .from('categories')
            .insert({
              name: 'Print on Demand',
              slug: 'print-on-demand',
              description: 'Custom print-on-demand products from Gooten',
              is_active: true,
              sort_order: 0
            })
            .select()
            .single();

          if (insertError) {
            throw new Error(`Failed to create category: ${insertError.message}`);
          }
          categoryId = newCategory.id;
        } else {
          categoryId = category.id;
        }

        let existingProductQuery = db
          .from('products')
          .select(productColumns.status ? 'id, status, category_id, is_active, description' : 'id, category_id, is_active, description')
          .eq('gooten_product_id', gootenProductId);

        if (productColumns.source) {
          existingProductQuery = existingProductQuery.eq('source', 'gooten');
        }

        let { data: existingProduct } = await existingProductQuery.maybeSingle();

        if (!existingProduct) {
          let fallbackQuery = db
            .from('products')
            .select(productColumns.status ? 'id, status, gooten_product_id, category_id, is_active, description' : 'id, gooten_product_id, category_id, is_active, description')
            .eq('slug', productSlug);

          if (productColumns.source) {
            fallbackQuery = fallbackQuery.eq('source', 'gooten');
          }

          const { data: slugMatchedProduct } = await fallbackQuery.maybeSingle();

          if (slugMatchedProduct) {
            existingProduct = slugMatchedProduct;
          }
        }

        let productId;
        if (existingProduct) {
          const statusUpdate = {};
          if (productColumns.status && existingProduct.status === 'deleted') {
            statusUpdate.status = 'pending';
            statusUpdate.is_active = false;
            if (productColumns.deleted_at) {
              statusUpdate.deleted_at = null;
            }
          }

          await db
            .from('products')
            .update({
              gooten_product_id: gootenProductId,
              name: productName,
              slug: productSlug,
              description: gootenDescription || existingProduct.description,
              // Category is local-source-of-truth; never overwrite on sync updates.
              // Preserve published state on standard Gooten updates.
              is_active: existingProduct.is_active,
              metadata: gootenProduct,
              synced_at: new Date().toISOString(),
              ...statusUpdate
            })
            .eq('id', existingProduct.id);
          productId = existingProduct.id;
        } else {
          const insertPayload = {
            gooten_product_id: gootenProductId,
            name: productName,
            slug: productSlug,
            description: gootenDescription || `Custom ${productName} - Print your designs on high-quality products`,
            category_id: categoryId,
            base_price: 19.99,
            is_active: false,
            metadata: gootenProduct,
            synced_at: new Date().toISOString()
          };

          if (productColumns.source) {
            insertPayload.source = 'gooten';
          }
          if (productColumns.status) {
            insertPayload.status = 'pending';
          }

          const { data: newProduct, error: insertError } = await db
            .from('products')
            .insert(insertPayload)
            .select()
            .single();

          if (insertError || !newProduct) {
            throw new Error(`Failed to insert product: ${insertError?.message || 'Unknown error'}`);
          }
          productId = newProduct.id;
          productsSynced++;
        }

        const variantsResponse = await axios.get(
          `${GOOTEN_BASE_URL}${GOOTEN_PRP_VARIANTS_PATH}`,
          {
            params: {
              RecipeId: GOOTEN_RECIPE_ID,
              countryCode: 'US',
              productName: productName
            }
          }
        );

        const rawVariants = extractPrintReadyVariants(variantsResponse.data);

        const gootenVariants = rawVariants.filter((variant) => {
          const variantProductName = String(variant.Name || variant.ProductName || '').trim();
          return variantProductName.length > 0 && variantProductName === productName;
        });

        if (gootenVariants.length === 0) {
          console.log(`[SYNC SKIP] No variants matched for product: ${productName}`);
          continue;
        }

        for (const gootenVariant of gootenVariants) {
          try {
            const variantName = gootenVariant.Name || gootenVariant.ProductName || 'Unknown Variant';
            const variantSku = gootenVariant.Sku || `gooten-${Date.now()}`;
            const parsedVariantPrice = parseGootenPrice(gootenVariant);
            if (parsedVariantPrice === null || parsedVariantPrice <= 0) {
              console.log(`[SYNC SKIP] Skipping variant with non-positive price: ${variantSku}`);
              continue;
            }

            const variantPayload = {
              product_id: productId,
              gooten_sku: variantSku,
              name: variantName,
              sku: `store-${variantSku}`,
              price: parsedVariantPrice,
              inventory_quantity: 999,
              track_inventory: false,
              allow_backorder: true,
              is_active: true,
              metadata: gootenVariant
            };

            const { data: upsertedVariant, error: upsertVariantError } = await db
              .from('product_variants')
              .upsert(variantPayload, { onConflict: 'gooten_sku' })
              .select('id')
              .maybeSingle();

            if (upsertVariantError) {
              throw new Error(`Failed to upsert variant ${variantSku}: ${upsertVariantError.message}`);
            }

            let variantId;
            if (upsertedVariant?.id) {
              variantId = upsertedVariant.id;
              variantsSynced++;
            } else {
              throw new Error(
                `Variant ${variantSku} upserted but ID was not returned. Ensure anon SELECT policy exists on product_variants.`
              );
            }

            const variantImageRecords = extractGootenImageRecords(gootenVariant);
            const productImageRecords = String(gootenProduct.Sku || '').trim() === String(variantSku || '').trim()
              ? extractGootenImageRecords(gootenProduct)
              : [];
            let imageRecords = mergeImageRecords(productImageRecords, variantImageRecords);

            if (imageRecords.length === 0 && variantSku) {
              const templateImageRecords = await fetchVariantTemplateImageRecords(variantSku, 'US');
              imageRecords = mergeImageRecords(templateImageRecords);
            }

            if (imageRecords.length > 0 && variantId) {
              await saveVariantImageRecords(variantId, variantName, imageRecords, db);
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

    let trackedProductsQuery = db
      .from('products')
      .select('id, gooten_product_id');

    if (productColumns.source) {
      trackedProductsQuery = trackedProductsQuery.eq('source', 'gooten');
    } else {
      trackedProductsQuery = trackedProductsQuery.not('gooten_product_id', 'is', null);
    }

    if (productColumns.status) {
      trackedProductsQuery = trackedProductsQuery.neq('status', 'deleted');
    }

    const { data: trackedGootenProducts, error: trackedProductsError } = await trackedProductsQuery;

    if (trackedProductsError) {
      throw new Error(`Failed to load tracked Gooten products: ${trackedProductsError.message}`);
    }

    const productIdsToSoftDelete = (trackedGootenProducts || [])
      .filter((product) => product.gooten_product_id && !seenGootenProductIds.has(String(product.gooten_product_id)))
      .map((product) => product.id);

    const { data: invalidKeyProducts } = await db
      .from('products')
      .select('id, gooten_product_id')
      .in('gooten_product_id', ['undefined', 'null', ''])
      .not('gooten_product_id', 'is', null);

    const invalidProductIds = (invalidKeyProducts || []).map((product) => product.id);
    for (const invalidId of invalidProductIds) {
      if (!productIdsToSoftDelete.includes(invalidId)) {
        productIdsToSoftDelete.push(invalidId);
      }
    }

    if (productIdsToSoftDelete.length > 0) {
      const softDeletePayload = {
        is_active: false,
        synced_at: new Date().toISOString()
      };
      if (productColumns.status) {
        softDeletePayload.status = 'deleted';
      }
      if (productColumns.deleted_at) {
        softDeletePayload.deleted_at = new Date().toISOString();
      }

      const { error: softDeleteError } = await db
        .from('products')
        .update(softDeletePayload)
        .in('id', productIdsToSoftDelete);

      if (softDeleteError) {
        errors.push({
          type: 'soft_delete',
          error: `Failed to soft-delete removed Gooten products: ${softDeleteError.message}`
        });
      } else {
        productsDeleted = productIdsToSoftDelete.length;
      }
    }

    const completedAt = new Date();
    const duration = completedAt - startTime;

    if (syncLogId) {
      await db
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

    res.json({
      success: true,
      productsSynced,
      variantsSynced,
      productsDeleted,
      duration_ms: duration,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    console.error('Sync failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/admin/stats', ...requireRoles(['admin', 'super_user']), async (req, res) => {
  try {
    const db = req.supabase;
    const [products, variants, images, categories] = await Promise.all([
      db.from('products').select('id', { count: 'exact', head: true }),
      db.from('product_variants').select('id', { count: 'exact', head: true }),
      db.from('product_images').select('id', { count: 'exact', head: true }),
      db.from('categories').select('id', { count: 'exact', head: true })
    ]);

    const error = products.error || variants.error || images.error || categories.error;
    if (error) throw error;

    res.json({
      success: true,
      stats: {
        products: products.count || 0,
        variants: variants.count || 0,
        images: images.count || 0,
        categories: categories.count || 0
      }
    });
  } catch (error) {
    console.error('Admin stats fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/admin/sync-logs', ...requireRoles(['admin', 'super_user']), async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('sync_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    res.json({
      success: true,
      logs: data || []
    });
  } catch (error) {
    console.error('Sync logs fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'API route not found'
  });
});

app.use((req, res, next) => {
  if (req.method !== 'GET' || !req.accepts('html') || !existsSync(distIndexPath)) {
    return next();
  }

  res.sendFile(distIndexPath);
});

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Upload payload too large. Please use a smaller image file.'
    });
  }
  return next(err);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gooten API Server running on http://localhost:${PORT}`);
  console.log(`Recipe ID configured: ${GOOTEN_RECIPE_ID ? 'Yes' : 'No (Please add to .env)'}`);
  console.log(`Supabase caching: Enabled`);
  console.log(`Rate limiting: ${MAX_REQUESTS_PER_WINDOW} requests per ${RATE_LIMIT_WINDOW / 1000}s`);
});
