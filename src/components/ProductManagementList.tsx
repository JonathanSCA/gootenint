import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Edit, Package, Plus } from 'lucide-react';
import { apiFetch, readJsonResponse } from '../lib/api';
import { getDefaultProductImageUrl } from '../lib/productImages';

interface ProductImage {
  id: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
}

interface ProductVariant {
  id: string;
  images: ProductImage[];
}

interface Product {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  variants: ProductVariant[];
}


function getProductThumbnail(product: Product): string {
  return getDefaultProductImageUrl(product.variants);
}

export default function ProductManagementList() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    void fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      setLoading(true);
      setError('');
      const response = await apiFetch('/api/admin/products');
      const data = await readJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load products');
      }

      setProducts(data.products || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProduct() {
    try {
      setCreating(true);
      setError('');
      const response = await apiFetch('/api/admin/products', {
        method: 'POST'
      });
      const data = await readJsonResponse(response);
      navigate(`/admin/edit-product/${data.product.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <p className="text-slate-600">Loading products...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Manage Products</h1>
        <p className="text-slate-600">All products across sources. Edit details and publish status.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={handleCreateProduct}
            disabled={creating}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            <Plus className="mr-2 h-4 w-4" />
            {creating ? 'Creating...' : 'New Product'}
          </button>
          <Link
            to="/admin/manage-categories"
            className="inline-block rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Manage Categories
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-600">No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <div key={product.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="aspect-square bg-slate-100">
                <img
                  src={getProductThumbnail(product)}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="line-clamp-2 font-semibold text-slate-900">{product.name}</h3>
                </div>
                <div className="mb-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      product.is_active ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {product.is_active ? 'Published' : 'Unpublished'}
                  </span>
                </div>
                <Link
                  to={`/admin/edit-product/${product.id}`}
                  className="w-full inline-flex justify-center rounded-lg bg-blue-600 px-3 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Edit className="mr-2 inline-block h-4 w-4" />
                  Edit Product
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
