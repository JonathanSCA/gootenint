import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { readJsonResponse } from '../lib/api';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
}


function buildCategoryImageUrl(imageValue?: string | null): string {
  if (!imageValue) return 'https://images.pexels.com/photos/1939485/pexels-photo-1939485.jpeg';
  if (imageValue.startsWith('http://') || imageValue.startsWith('https://') || imageValue.startsWith('/')) {
    return imageValue;
  }
  return `/images/categories/${imageValue}`;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      setError('');
      const [categoriesResponse, productsResponse] = await Promise.all([
        fetch('/api/store/categories'),
        fetch('/api/store/products')
      ]);
      const categoriesData = await readJsonResponse(categoriesResponse);
      const productsData = await readJsonResponse(productsResponse);

      if (categoriesData.success) {
        const categorySlugSet = new Set(
          (productsData?.products || [])
            .map((product: { category?: { slug?: string } }) => product.category?.slug)
            .filter(Boolean)
        );

        const filteredCategories = (categoriesData.categories || []).filter(
          (category: Category) => categorySlugSet.has(category.slug)
        );
        setCategories(filteredCategories);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load categories.';
      setError(message);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="font-editorial mb-2 text-5xl text-slate-900">Categories</h1>
      <p className="mb-6 text-slate-600">Explore all product groups.</p>

      {loading ? (
        <p className="text-slate-600">Loading categories...</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/category/${category.slug}`}
              state={{ name: category.name }}
              className="group text-left"
            >
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <img
                  src={buildCategoryImageUrl(category.image_url)}
                  alt={category.name}
                  className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <p className="mt-2 font-editorial text-3xl text-slate-900">{category.name}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
