import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, RefreshCw, Star } from 'lucide-react';
import { apiFetch, readJsonResponse } from '../lib/api';

interface Category {
  id: string;
  name: string;
}

interface ProductImage {
  id: string;
  url: string;
  alt_text?: string;
  is_primary: boolean;
  sort_order: number;
  variant_id?: string;
  variant_name?: string;
}

interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  gooten_sku?: string | null;
  price: number;
  is_active: boolean;
  sort_order?: number | null;
  images: ProductImage[];
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  is_active: boolean;
  category_id: string | null;
  variants: ProductVariant[];
}

interface ProductEditorProps {
  productId: string;
  onSaved: () => void;
}

export default function ProductEditor({ productId, onSaved }: ProductEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingImages, setSavingImages] = useState(false);
  const [refreshingImages, setRefreshingImages] = useState(false);
  const [error, setError] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  useEffect(() => {
    void loadPageData();
  }, [productId]);

  const hasImages = useMemo(() => images.length > 0, [images]);

  function sortImagesForEditor(nextImages: ProductImage[]) {
    return [...nextImages].sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.sort_order - b.sort_order;
    });
  }

  async function loadPageData() {
    try {
      setLoading(true);
      setError('');

      const [productResponse, categoriesResponse] = await Promise.all([
        apiFetch(`/api/admin/products/${productId}`),
        apiFetch('/api/admin/categories?activeOnly=true')
      ]);

      const productData = await readJsonResponse(productResponse);
      const categoriesData = await readJsonResponse(categoriesResponse);

      if (!productResponse.ok || !productData.success) {
        throw new Error(productData.error || 'Failed to load product');
      }
      if (!categoriesResponse.ok || !categoriesData.success) {
        throw new Error(categoriesData.error || 'Failed to load categories');
      }

      const product: Product = productData.product;
      const allImages = (product.variants || []).flatMap((variant) =>
        (variant.images || []).map((image) => ({
          ...image,
          variant_id: variant.id,
          variant_name: variant.name
        }))
      );
      const sortedImages = sortImagesForEditor(allImages);

      setName(product.name || '');
      setDescription(product.description || '');
      setShortDescription(product.short_description || '');
      setCategoryId(product.category_id || '');
      setIsPublished(Boolean(product.is_active));
      setImages(sortedImages);
      setVariants([...(product.variants || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      setCategories(categoriesData.categories || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError('');

      const response = await apiFetch(`/api/admin/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          short_description: shortDescription,
          category_id: categoryId || null,
          is_active: isPublished
        })
      });

      const data = await readJsonResponse(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save product');
      }

      if (variants.length > 0) {
        await saveVariantSettings();
      }

      if (hasImages) {
        await saveImageSettings();
      }

      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function moveImage(imageId: string, direction: -1 | 1) {
    setImages((current) => {
      const next = [...current];
      const index = next.findIndex((image) => image.id === imageId);
      const targetIndex = index + direction;

      if (index < 0 || targetIndex < 0 || targetIndex >= next.length) {
        return current;
      }

      const [image] = next.splice(index, 1);
      next.splice(targetIndex, 0, image);
      return next.map((item, itemIndex) => ({
        ...item,
        sort_order: itemIndex
      }));
    });
  }

  function setPrimaryImage(imageId: string) {
    setImages((current) =>
      current.map((image) => ({
        ...image,
        is_primary: image.id === imageId
      }))
    );
  }

  function updateVariantField<K extends keyof Pick<ProductVariant, 'name' | 'sku' | 'price' | 'is_active'>>(
    variantId: string,
    field: K,
    value: ProductVariant[K]
  ) {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === variantId ? { ...variant, [field]: value } : variant
      )
    );
  }

  function updateVariantImageField<K extends keyof Pick<ProductImage, 'url' | 'alt_text'>>(
    variantId: string,
    imageId: string,
    field: K,
    value: ProductImage[K]
  ) {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              images: variant.images.map((image) =>
                image.id === imageId ? { ...image, [field]: value } : image
              )
            }
          : variant
      )
    );

    setImages((current) =>
      current.map((image) =>
        image.id === imageId ? { ...image, [field]: value } : image
      )
    );
  }

  async function handleRefreshImages() {
    try {
      setRefreshingImages(true);
      setError('');

      const response = await apiFetch(`/api/admin/products/${productId}/images/refresh`, {
        method: 'POST'
      });

      const data = await readJsonResponse(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to refresh images from Gooten');
      }

      await loadPageData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setRefreshingImages(false);
    }
  }

  async function saveVariantSettings() {
    const response = await apiFetch(`/api/admin/products/${productId}/variants`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        variants: variants.map((variant, index) => ({
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          price: variant.price,
          is_active: variant.is_active,
          sort_order: index,
          images: variant.images.map((image) => ({
            id: image.id,
            url: image.url,
            alt_text: image.alt_text || null
          }))
        }))
      })
    });

    const data = await readJsonResponse(response);
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to save child SKU settings');
    }
  }

  async function saveImageSettings() {
    const response = await apiFetch(`/api/admin/products/${productId}/images`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        images: images.map((image, index) => ({
          id: image.id,
          sort_order: index,
          is_primary: image.is_primary
        }))
      })
    });

    const data = await readJsonResponse(response);
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to save image settings');
    }
  }

  async function handleSaveImages() {
    try {
      setSavingImages(true);
      setError('');

      await saveImageSettings();
      await loadPageData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setSavingImages(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <p className="text-slate-600">Loading product editor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link
        to="/admin/manage-products"
        className="mb-6 inline-flex items-center gap-2 text-blue-600 transition-colors hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Product List
      </Link>

      <h1 className="mb-6 text-3xl font-bold text-slate-900">Edit Product</h1>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">Product Images</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleRefreshImages}
                disabled={refreshingImages || savingImages}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshingImages ? 'animate-spin' : ''}`} />
                {refreshingImages ? 'Fetching...' : 'Fetch Gooten Images'}
              </button>
              <button
                onClick={handleSaveImages}
                disabled={!hasImages || refreshingImages || savingImages}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                {savingImages ? 'Saving...' : 'Save Image Order'}
              </button>
            </div>
          </div>
          {hasImages ? (
            <div className="space-y-3">
              {images.map((image, index) => (
                <div key={image.id} className="grid grid-cols-[88px_1fr] gap-3 rounded-lg border border-slate-200 p-3">
                  <img
                    src={image.url}
                    alt={image.alt_text || name}
                    className="h-20 w-20 rounded-md object-cover"
                  />
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {image.variant_name || 'Product image'}
                        </p>
                        <p className="text-xs text-slate-500">Position {index + 1}</p>
                      </div>
                      {image.is_primary && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                          <Star className="h-3 w-3" />
                          Default
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveImage(image.id, -1)}
                        disabled={index === 0 || savingImages || refreshingImages}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40"
                        aria-label="Move image up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(image.id, 1)}
                        disabled={index === images.length - 1 || savingImages || refreshingImages}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40"
                        aria-label="Move image down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
                        <input
                          type="radio"
                          name="primary-product-image"
                          checked={image.is_primary}
                          onChange={() => setPrimaryImage(image.id)}
                          className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        Default image
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600">No images found for this product.</p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Product Information</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Short Description</label>
              <input
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-slate-800">Published</span>
              </label>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || savingImages || refreshingImages}
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              to="/admin/manage-products"
              className={`rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition-colors hover:bg-slate-100 ${saving ? 'opacity-60 pointer-events-none' : ''}`}
            >
              Cancel
            </Link>
          </div>
        </section>

        <section className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Child SKUs</h2>

          {variants.length === 0 ? (
            <p className="text-slate-600">No child SKUs found for this product.</p>
          ) : (
            <div className="space-y-5">
              {variants.map((variant) => (
                <div key={variant.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_140px_120px]">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">SKU Copy</label>
                      <input
                        value={variant.name}
                        onChange={(event) => updateVariantField(variant.id, 'name', event.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Store SKU</label>
                      <input
                        value={variant.sku}
                        onChange={(event) => updateVariantField(variant.id, 'sku', event.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Price</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={variant.price}
                        onChange={(event) => updateVariantField(variant.id, 'price', Number(event.target.value))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="inline-flex h-[42px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
                        <input
                          type="checkbox"
                          checked={variant.is_active}
                          onChange={(event) => updateVariantField(variant.id, 'is_active', event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-800">Active</span>
                      </label>
                    </div>
                  </div>

                  {variant.gooten_sku && (
                    <p className="mt-2 text-xs text-slate-500">Gooten SKU: {variant.gooten_sku}</p>
                  )}

                  <div className="mt-4 space-y-3">
                    {variant.images.length > 0 ? (
                      variant.images.map((image) => (
                        <div key={image.id} className="grid grid-cols-[72px_1fr] gap-3 rounded-lg bg-slate-50 p-3">
                          <img
                            src={image.url}
                            alt={image.alt_text || variant.name}
                            className="h-16 w-16 rounded-md object-cover"
                          />
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Image URL</label>
                              <input
                                value={image.url}
                                onChange={(event) => updateVariantImageField(variant.id, image.id, 'url', event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Alt Text</label>
                              <input
                                value={image.alt_text || ''}
                                onChange={(event) => updateVariantImageField(variant.id, image.id, 'alt_text', event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No images found for this child SKU.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
