import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiFetch, readJsonResponse } from '../lib/api';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}



interface FormState {
  name: string;
  slug: string;
  description: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

const emptyForm: FormState = {
  name: '',
  slug: '',
  description: '',
  image_url: '',
  sort_order: 0,
  is_active: true
};

function buildCategoryImageUrl(imageValue: string | null | undefined): string {
  if (!imageValue) return 'https://images.pexels.com/photos/1939485/pexels-photo-1939485.jpeg';
  if (imageValue.startsWith('http://') || imageValue.startsWith('https://') || imageValue.startsWith('/')) {
    return imageValue;
  }
  return `/images/categories/${imageValue}`;
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    void fetchCategories();
  }, []);

  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed reading image file'));
      reader.readAsDataURL(file);
    });
  }

  async function fetchCategories() {
    try {
      setLoading(true);
      setError('');
      const response = await apiFetch('/api/admin/categories');
      const data = await readJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load categories');
      }

      setCategories(data.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      image_url: category.image_url || '',
      sort_order: category.sort_order || 0,
      is_active: category.is_active
    });
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError('');

      const url = editingId ? `/api/admin/categories/${editingId}` : '/api/admin/categories';
      const method = editingId ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await readJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save category');
      }

      await fetchCategories();
      startCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(categoryId: string) {
    try {
      setError('');
      const response = await apiFetch(`/api/admin/categories/${categoryId}`, {
        method: 'DELETE'
      });
      const data = await readJsonResponse(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove category');
      }
      await fetchCategories();
      if (editingId === categoryId) startCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function handleImageUpload(file: File) {
    try {
      setUploadingImage(true);
      setError('');
      const maxFileBytes = 8 * 1024 * 1024;
      if (file.size > maxFileBytes) {
        throw new Error('Image is too large. Please upload a file smaller than 8MB.');
      }
      const dataUrl = await fileToDataUrl(file);
      const response = await apiFetch('/api/admin/categories/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          dataUrl
        })
      });

      const data = await readJsonResponse(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload image');
      }

      setForm((prev) => ({
        ...prev,
        image_url: data.image_path || data.image_url || ''
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUploadingImage(false);
    }
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

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Manage Categories</h1>
          <p className="text-slate-600">Add, update, or remove categories used in product editing.</p>
        </div>
        <button
          onClick={startCreate}
          className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-900"
        >
          <Plus className="mr-2 inline-block h-4 w-4" />
          New Category
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">{editingId ? 'Edit Category' : 'Add Category'}</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Slug</label>
              <input
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="optional-auto-from-name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Category Image</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImageUpload(file);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {uploadingImage && <p className="mt-2 text-sm text-slate-500">Uploading image...</p>}
              {form.image_url && (
                <img
                  src={buildCategoryImageUrl(form.image_url)}
                  alt="Category preview"
                  className="mt-3 h-20 w-20 rounded-md border border-slate-200 object-cover"
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Sort Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((prev) => ({ ...prev, sort_order: Number(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span className="font-medium text-slate-800">Active</span>
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Category'}
            </button>
            {editingId && (
              <button
                onClick={startCreate}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">All Categories</h2>
          {loading ? (
            <p className="text-slate-600">Loading categories...</p>
          ) : categories.length === 0 ? (
            <p className="text-slate-600">No categories yet.</p>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <div key={category.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <img
                        src={buildCategoryImageUrl(category.image_url)}
                        alt={category.name}
                        className="h-14 w-14 rounded-md border border-slate-200 object-cover"
                      />
                      <div>
                      <p className="font-semibold text-slate-900">{category.name}</p>
                      <p className="text-xs text-slate-500">/{category.slug}</p>
                      {category.description && <p className="mt-1 text-sm text-slate-600">{category.description}</p>}
                      <div className="mt-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            category.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {category.is_active ? 'Active' : 'Removed'}
                        </span>
                      </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(category)}
                        className="rounded border border-slate-300 p-2 text-slate-700 hover:bg-slate-100"
                        title="Edit category"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRemove(category.id)}
                        className="rounded border border-red-300 p-2 text-red-700 hover:bg-red-50"
                        title="Remove category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
