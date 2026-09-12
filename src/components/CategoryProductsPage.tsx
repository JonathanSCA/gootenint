import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { readJsonResponse } from '../lib/api';
import { getDefaultProductImageUrl } from '../lib/productImages';

interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  base_price: number;
  variants: Array<{
    id: string;
    price: number;
    images: Array<{
      url: string;
      is_primary: boolean;
      sort_order?: number | null;
    }>;
  }>;
}

interface CategoryProductsPageProps {
  categorySlug: string;
  categoryName: string;
}

function getPrimaryImage(product: Product): string {
  return getDefaultProductImageUrl(product.variants);
}

function getMinPrice(product: Product): number {
  if (!product.variants || product.variants.length === 0) return product.base_price;
  return Math.min(...product.variants.map((variant) => variant.price));
}

export default function CategoryProductsPage({ categorySlug, categoryName }: CategoryProductsPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchProducts();
  }, [categorySlug]);

  async function fetchProducts() {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`/api/store/products?category=${encodeURIComponent(categorySlug)}`);
      const data = await readJsonResponse(response);
      if (data.success) {
        setProducts(data.products || []);
      } else {
        setProducts([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load products.';
      setError(message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="font-editorial mb-2 text-5xl text-slate-900">{categoryName}</h1>
      <p className="mb-6 text-slate-600">Products in this category.</p>

      {loading ? (
        <p className="text-slate-600">Loading products...</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      ) : products.length === 0 ? (
        <p className="text-slate-600">No products found in this category.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Link
              key={product.id}
              to={`/product/${product.slug}`}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <img src={getPrimaryImage(product)} alt={product.name} className="aspect-square w-full object-cover" />
              <div className="p-4">
                <h3 className="font-editorial text-3xl leading-tight text-slate-900">{product.name}</h3>
                <p className="mt-1 text-sm text-slate-600 line-clamp-2">{product.description}</p>
                <p className="mt-3 text-sm font-bold uppercase tracking-widest text-slate-900">${getMinPrice(product).toFixed(2)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
