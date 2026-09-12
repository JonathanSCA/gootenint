# eCommerce Store with Gooten Integration

## Overview

This is a complete eCommerce storefront integrated with Gooten's print-on-demand API. Products from Gooten are automatically synced to a Supabase database and displayed in a beautiful storefront interface.

## Architecture

### Database Schema

The system uses the following main tables:

1. **categories** - Product categories
2. **products** - Main products (e.g., "Canvas Prints")
3. **product_variants** - Specific SKUs with sizes, colors, prices
4. **product_images** - Product and variant images
5. **product_templates** - Gooten design templates
6. **sync_logs** - Track synchronization history

### API Endpoints

#### Storefront Endpoints (Public)
- `GET /api/store/products` - List all active products
- `GET /api/store/products/:slug` - Get product details
- `GET /api/store/categories` - List categories

#### Admin Endpoints
- `POST /api/admin/sync-products` - Sync products from Gooten
- `GET /api/admin/sync-logs` - View sync history

#### Gooten API Proxy Endpoints
- `GET /api/prp-products` - Get preconfigured products
- `GET /api/prp-variants` - Get product variants
- `GET /api/product-content/:sku` - Get product templates
- `GET /api/product-images/:sku` - Get product images

## Setup Instructions

### 1. Start the Backend Server

```bash
npm run server
```

The server runs on `http://localhost:3001`

### 2. Start the Frontend

```bash
npm run dev
```

The frontend runs on `http://localhost:5173`

### 3. Sync Products from Gooten

1. Open your browser to `http://localhost:5173`
2. Click the "Admin" button in the navigation
3. Click "Sync Now" to import products from Gooten
4. Wait for the sync to complete (this may take 30-60 seconds)

### 4. View Your Storefront

1. Click "Store" in the navigation
2. Browse imported products
3. Click any product to see details

## Data Flow

```
Gooten API
    ↓
Backend Server (server.js)
    ↓
Supabase Database
    ↓
Storefront UI (React)
```

### Sync Process

1. Backend fetches preconfigured products from Gooten
2. For each product:
   - Creates/updates product in database
   - Fetches all variants for that product
   - Creates/updates variants with pricing and images
   - Associates images with variants
3. All data is cached in Supabase for fast access
4. Storefront reads from Supabase (not Gooten directly)

## Database Mapping

### Gooten → Database

**Products:**
- `PreconfiguredProducts.Id` → `products.gooten_product_id`
- `PreconfiguredProducts.Name` → `products.name`
- Product name slugified → `products.slug`

**Variants:**
- `ProductVariants.Sku` → `product_variants.gooten_sku`
- `ProductVariants.Name` → `product_variants.name`
- `ProductVariants.Price` → `product_variants.price`
- `ProductVariants.Images` → `product_images` table

**Categories:**
- Automatically creates "Print on Demand" category
- Can manually add more categories in database

## Features

### Storefront
- Product grid with images and pricing
- Search functionality
- Product detail pages with variants
- Variant selection with price updates
- Image galleries
- Responsive design

### Admin Panel
- One-click product sync
- Database statistics
- Sync history with timestamps
- Error logging
- Progress tracking

### Backend
- Rate limiting (30 requests/minute)
- Response caching (24 hours)
- Error handling
- Automatic retry logic
- Database transactions

## Security

All tables have Row Level Security (RLS) enabled:

- **Public access**: Anyone can view active products
- **Admin access**: Only authenticated users can sync products
- **Write access**: Protected by authentication

## Customization

### Adding Categories

```sql
INSERT INTO categories (name, slug, description, is_active)
VALUES ('Canvas Art', 'canvas-art', 'High-quality canvas prints', true);
```

### Updating Product Prices

```sql
UPDATE product_variants
SET price = price * 1.2
WHERE product_id IN (
  SELECT id FROM products WHERE category_id = '...'
);
```

### Marking Products as Featured

```sql
UPDATE products
SET is_featured = true
WHERE name LIKE '%Canvas%';
```

## Monitoring

### Check Sync Status

```sql
SELECT * FROM sync_logs
ORDER BY started_at DESC
LIMIT 10;
```

### View Product Counts

```sql
SELECT
  (SELECT COUNT(*) FROM products WHERE is_active = true) as active_products,
  (SELECT COUNT(*) FROM product_variants WHERE is_active = true) as active_variants,
  (SELECT COUNT(*) FROM product_images) as total_images;
```

### Check Cache Status

```sql
SELECT
  'products' as cache_type,
  COUNT(*) as cached_items,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as valid_items
FROM gooten_product_cache

UNION ALL

SELECT
  'variants',
  COUNT(*),
  COUNT(*) FILTER (WHERE expires_at > NOW())
FROM gooten_variant_cache;
```

## Troubleshooting

### Products not syncing?

1. Check backend server is running on port 3001
2. Verify Gooten Recipe ID in `.env` is correct
3. Check sync logs in Admin panel for errors
4. Look at server console for error messages

### Images not displaying?

1. Check `product_images` table has data
2. Verify image URLs are accessible
3. Check browser console for CORS errors

### Rate limit errors?

The system has built-in rate limiting:
- Wait 60 seconds between sync attempts
- Rate limits reset automatically
- Check `api_rate_limit` table for status

## Production Deployment

### Railway Deployment

This project is ready for a Git-linked Railway deployment.

1. In Railway, create a new project from the GitHub repository.
2. Use the repository root for the service.
3. Railway will read `railway.json` and run:
   - Build command: `npm run build`
   - Start command: `npm start`
   - Healthcheck path: `/api/health`
4. Add the required environment variables in the Railway service.
5. Generate a Railway domain from the service settings after the first successful deploy.

The Express server serves API routes, files in `public`, and the built Vite app from `dist`.

### Environment Variables Required

```env
GOOTEN_RECIPE_ID=your-recipe-id
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DEV_AUTO_CONFIRM_USERS=false
```

### Build Commands

```bash
# Build frontend
npm run build

# Start backend
npm start

# Or use a process manager like PM2
pm2 start server.js --name "gooten-api"
```

### Recommended Deployment Stack

- **Frontend**: Vercel, Netlify, or Cloudflare Pages
- **Backend**: Railway, Render, or DigitalOcean App Platform
- **Database**: Supabase (already configured)

## API Rate Limits

- Gooten API: 30 requests per minute (enforced by server)
- Caching: 24-hour cache on all Gooten responses
- Database: No limits (Supabase handles scaling)

## Support

For issues or questions:
1. Check sync logs in Admin panel
2. Review server console logs
3. Check Supabase logs for database errors
4. Verify Gooten API credentials
