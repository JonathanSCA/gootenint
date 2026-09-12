import { useState, useEffect } from 'react';
import { ShoppingCart, Search, Tag } from 'lucide-react';
import { readJsonResponse } from '../lib/api';
import { getDefaultProductImageUrl } from '../lib/productImages';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  base_price: number;
  category: {
    name: string;
    slug: string;
    image_url?: string | null;
  };
  variants: Array<{
    id: string;
    price: number;
    images: Array<{
      url: string;
      alt_text: string;
      is_primary: boolean;
      sort_order?: number | null;
    }>;
  }>;
}

function buildCategoryImageUrl(imageValue?: string | null): string {
  if (!imageValue) return 'https://images.pexels.com/photos/1939485/pexels-photo-1939485.jpeg';
  if (imageValue.startsWith('http://') || imageValue.startsWith('https://') || imageValue.startsWith('/')) {
    return imageValue;
  }
  return `/images/categories/${imageValue}`;
}

interface StorefrontProps {
  onProductSelect: (slug: string) => void;
}

export default function Storefront({ onProductSelect }: StorefrontProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setError('');
      const response = await fetch('/api/store/products');
      const data = await readJsonResponse(response);

      if (data.success) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch products.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPrimaryImage = (product: Product) => {
    return getDefaultProductImageUrl(product.variants);
  };

  const getMinPrice = (product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      return product.base_price;
    }

    const prices = product.variants.map(v => v.price);
    return Math.min(...prices);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
        <p className="text-center mt-4 text-slate-600">Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center">
          <Tag className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">No Products Yet</h2>
          <p className="text-slate-600 mb-6">
            Sync products from Gooten using the Admin panel to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">
          Custom Print Products
        </h1>
        <p className="text-lg text-slate-600">
          High-quality print-on-demand products for your creative designs
        </p>
      </div>

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
            onClick={() => onProductSelect(product.slug)}
          >
            <div className="aspect-square bg-slate-100 overflow-hidden">
              <img
                src={getPrimaryImage(product)}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>

            <div className="p-4">
              {product.category && (
                <span className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  <img
                    src={buildCategoryImageUrl(product.category.image_url)}
                    alt={product.category.name}
                    className="h-4 w-4 rounded-full object-cover"
                  />
                  {product.category.name}
                </span>
              )}

              <h3 className="text-lg font-bold text-slate-900 mt-2 mb-1">
                {product.name}
              </h3>

              <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                {product.description}
              </p>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-slate-900">
                    ${getMinPrice(product).toFixed(2)}
                  </span>
                  {product.variants && product.variants.length > 1 && (
                    <span className="text-sm text-slate-500 ml-1">+</span>
                  )}
                </div>

                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  View
                </button>
              </div>

              {product.variants && (
                <p className="text-xs text-slate-500 mt-2">
                  {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''} available
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && searchTerm && (
        <div className="text-center py-12">
          <p className="text-slate-600">No products found matching "{searchTerm}"</p>
        </div>
      )}
    </div>
  );
}
