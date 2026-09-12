import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Star, Truck, Shield, Sparkles } from 'lucide-react';
import { readJsonResponse } from '../lib/api';
import { FALLBACK_PRODUCT_IMAGE_URL, getDefaultProductImageUrl } from '../lib/productImages';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  base_price: number;
  category?: {
    name: string;
    slug: string;
  };
  variants?: Array<{
    price: number | null;
    images?: Array<{
      url: string;
      is_primary: boolean;
      sort_order?: number | null;
    }>;
  }>;
}



function buildCategoryImageUrl(imageValue?: string | null): string {
  if (!imageValue) return 'https://images.pexels.com/photos/6186825/pexels-photo-6186825.jpeg';
  if (imageValue.startsWith('http://') || imageValue.startsWith('https://') || imageValue.startsWith('/')) {
    return imageValue;
  }
  return `/images/categories/${imageValue}`;
}

function getProductImage(product: Product): string {
  return getDefaultProductImageUrl(product.variants, FALLBACK_PRODUCT_IMAGE_URL);
}

function getProductPrice(product: Product): number {
  const prices = (product.variants || [])
    .map((variant) => variant.price)
    .filter((price): price is number => typeof price === 'number' && Number.isFinite(price));
  if (prices.length === 0) return product.base_price || 0;
  return Math.min(...prices);
}

function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      to={`/product/${product.slug}`}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="aspect-[4/5] overflow-hidden">
        <img src={getProductImage(product)} alt={product.name} className="h-full w-full object-cover" />
      </div>
      <div className="p-4">
        <p className="mb-1 text-xs uppercase tracking-widest text-slate-500">{product.category?.name || 'Print Shop'}</p>
        <h3 className="font-editorial text-2xl leading-tight text-slate-900">{product.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{product.description}</p>
        <p className="mt-3 text-sm font-bold tracking-wide text-slate-900">${getProductPrice(product).toFixed(2)}</p>
      </div>
    </Link>
  );
}

export default function StoreHome() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchStoreData();
  }, []);

  async function fetchStoreData() {
    try {
      setError('');
      const [categoriesResponse, productsResponse] = await Promise.all([
        fetch('/api/store/categories'),
        fetch('/api/store/products')
      ]);
      const categoriesData = await readJsonResponse(categoriesResponse);
      const productsData = await readJsonResponse(productsResponse);

      const fetchedProducts = productsData?.success ? (productsData.products || []) : [];
      const categorySlugSet = new Set(
        fetchedProducts
          .map((product: Product) => product.category?.slug)
          .filter(Boolean)
      );
      const fetchedCategories = categoriesData?.success ? (categoriesData.categories || []) : [];
      const filteredCategories = fetchedCategories.filter((category: Category) => categorySlugSet.has(category.slug));

      setProducts(fetchedProducts);
      setCategories(filteredCategories);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load store data.';
      setError(message);
      setProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }

  const featuredProducts = useMemo(() => products.slice(0, 4), [products]);
  const newArrivals = useMemo(() => products.slice(0, 6), [products]);

  return (
    <div className="pb-12">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#223d73_0%,#12264b_52%,#0f2144_100%)]">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#ffffff22 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="pointer-events-none absolute right-[8%] top-1/2 hidden h-[380px] w-[380px] -translate-y-1/2 opacity-20 md:block">
          <div className="absolute left-1/2 top-0 h-full w-14 -translate-x-1/2 bg-[#d7b36a]" />
          <div className="absolute left-1/2 top-1/4 h-14 w-[65%] -translate-x-1/2 -translate-y-1/2 bg-[#d7b36a]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-16 md:py-24">
          <div className="max-w-3xl">
            <span className="inline-block rounded-full bg-[#d3a33c] px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#18294c]">
              New Arrivals - Spring Collection
            </span>
            <h1 className="mt-8 font-editorial text-5xl leading-[1] text-white md:text-7xl">
              Wear Your <span className="italic text-[#e4b246]">Faith.</span><br />
              Bless Your Home.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-100">
              Thoughtfully designed Christian apparel and home goods rooted in Scripture, crafted with care, and made to last.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              {categories.length > 0 && (
                <Link
                  to={`/category/${categories[0].slug}`}
                  state={{ name: categories[0].name }}
                  className="rounded-lg bg-[#d3a33c] px-8 py-4 text-sm font-bold uppercase tracking-[0.14em] text-[#18294c] transition hover:bg-[#e1b95e]"
                >
                  Shop Now
                </Link>
              )}
              <Link to="/about" className="rounded-lg border border-slate-300/60 px-8 py-4 text-sm font-bold uppercase tracking-[0.14em] text-slate-100 transition hover:bg-slate-100/10 flex items-center justify-center">
                Our Story
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-10">
        <div className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_20%_20%,#223d73_0%,#12264b_52%,#0f2144_100%)] px-5 py-7 md:px-7 md:py-8">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#ffffff22 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          <div className="relative mb-4 flex items-center justify-between">
            <h2 className="font-editorial text-4xl text-white">Shop by Category</h2>
            <button className="inline-flex items-center gap-1 text-sm font-semibold text-slate-200">
            View all <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {loading ? (
            <p className="relative text-slate-200">Loading categories...</p>
          ) : error ? (
            <p className="relative rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : (
            <div className="relative grid grid-cols-2 gap-4 md:grid-cols-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/category/${category.slug}`}
                  state={{ name: category.name }}
                  className="group relative overflow-hidden rounded-xl border border-[#d7b36a]/45 bg-[#0f2144]/70 text-left shadow-[0_14px_30px_-18px_rgba(0,0,0,0.75)] transition duration-300 hover:-translate-y-1 hover:border-[#d7b36a]/80"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f2144] via-[#0f2144]/35 to-transparent" />
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={buildCategoryImageUrl(category.image_url)}
                      alt={category.name}
                      className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d7b36a]">Category</p>
                    <p className="font-semibold text-white">{category.name}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-editorial text-4xl text-slate-900">Best In Bed</h2>
          <button className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
            Explore <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-7xl rounded-2xl bg-[#ece9e2] px-5 py-8 md:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <p className="font-editorial text-4xl leading-tight text-slate-900">150k+ 5-Star Reviews Don&apos;t Lie</p>
            <button className="mt-4 rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white">
              Read Reviews
            </button>
          </div>
          <div className="rounded-xl bg-white p-4">
            <p className="font-editorial text-2xl text-slate-900">Like Sleeping On A Cloud</p>
            <p className="mt-2 text-sm text-slate-600">“The quality is incredible and delivery was seamless. We reordered right away.”</p>
            <p className="mt-3 inline-flex items-center gap-1 text-amber-500">
              <Star className="h-4 w-4 fill-current" />
              <Star className="h-4 w-4 fill-current" />
              <Star className="h-4 w-4 fill-current" />
              <Star className="h-4 w-4 fill-current" />
              <Star className="h-4 w-4 fill-current" />
            </p>
          </div>
          <div className="rounded-xl bg-white p-4">
            <p className="font-editorial text-2xl text-slate-900">Designed To Keep</p>
            <p className="mt-2 text-sm text-slate-600">“Artwork printed beautifully and feels premium in person. Absolutely gift-worthy.”</p>
            <p className="mt-3 inline-flex items-center gap-1 text-amber-500">
              <Star className="h-4 w-4 fill-current" />
              <Star className="h-4 w-4 fill-current" />
              <Star className="h-4 w-4 fill-current" />
              <Star className="h-4 w-4 fill-current" />
              <Star className="h-4 w-4 fill-current" />
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-12">
        <h2 className="font-editorial text-4xl text-slate-900">New Arrivals</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {newArrivals.map((product) => (
            <Link key={product.id} to={`/product/${product.slug}`} className="text-left">
              <div className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white">
                <img src={getProductImage(product)} alt={product.name} className="h-full w-full object-cover" />
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{product.name}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-7xl px-4">
        <h2 className="font-editorial text-4xl text-slate-900">Why Print Shop?</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <Sparkles className="h-5 w-5 text-slate-700" />
            <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-slate-500">Premium Materials</p>
            <p className="mt-2 text-sm text-slate-600">Curated substrates and inks chosen for comfort, color, and durability.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <Shield className="h-5 w-5 text-slate-700" />
            <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-slate-500">Quality Guaranteed</p>
            <p className="mt-2 text-sm text-slate-600">Every order is checked for print fidelity and finish before shipping.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <Truck className="h-5 w-5 text-slate-700" />
            <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-slate-500">Fast Shipping</p>
            <p className="mt-2 text-sm text-slate-600">Distributed production network keeps fulfillment reliable and quick.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-7xl px-4">
        <div className="grid grid-cols-1 items-center gap-8 rounded-2xl bg-[#dfe8f6] p-6 md:grid-cols-2 md:p-10">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.3em] text-slate-600">Need Help?</p>
            <h2 className="font-editorial text-4xl leading-tight text-slate-900">Chat with a comfort expert.</h2>
            <p className="mt-3 text-slate-700">Get tailored recommendations for your category, style, and budget.</p>
            <button className="mt-5 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">Let&apos;s Chat</button>
          </div>
          <div className="overflow-hidden rounded-xl">
            <img
              src="https://images.pexels.com/photos/6311604/pexels-photo-6311604.jpeg"
              alt="Comfort expert"
              className="h-72 w-full object-cover"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
