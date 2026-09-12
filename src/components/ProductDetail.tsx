import { useState, useEffect } from 'react';
import { ArrowLeft, ShoppingCart, Check, Star, ChevronDown, ChevronUp } from 'lucide-react';
import type { AddToCartInput } from '../types/cart';
import {
  FALLBACK_PRODUCT_IMAGE_URL,
  findVariantWithDefaultImage,
  sortProductImages
} from '../lib/productImages';

interface ProductImage {
  id?: string;
  url: string;
  alt_text: string;
  is_primary?: boolean;
  sort_order?: number;
}

interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  compare_at_price?: number;
  size?: string;
  color?: string;
  inventory_quantity: number;
  images: ProductImage[];
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  base_price: number;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  variants: ProductVariant[];
}

interface ProductDetailProps {
  slug: string;
  onBack: () => void;
  onAddToCart: (item: AddToCartInput) => void;
}

const FALLBACK_IMAGE_URL = FALLBACK_PRODUCT_IMAGE_URL;

function getDisplayImages(variant: ProductVariant | null, fallbackAlt: string): ProductImage[] {
  const images = variant?.images || [];

  if (images.length === 0) {
    return [{ url: FALLBACK_IMAGE_URL, alt_text: fallbackAlt, is_primary: true, sort_order: 0 }];
  }

  return sortProductImages(images);
}

export default function ProductDetail({ slug, onBack, onAddToCart }: ProductDetailProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('description');

  useEffect(() => {
    fetchProduct();
  }, [slug]);

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/store/products/${slug}`);
      const data = await response.json();

      if (data.success && data.product) {
        const fetchedProduct: Product = data.product;
        setProduct(fetchedProduct);
        if (fetchedProduct.variants && fetchedProduct.variants.length > 0) {
          setSelectedVariant(findVariantWithDefaultImage(fetchedProduct.variants));
          setSelectedImage(0);
        }
      }
    } catch (error) {
      console.error('Failed to fetch product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    const selectedPrice = getDisplayPrice(selectedVariant?.price, product.base_price);
    const selectedImageUrl =
      displayImages[selectedImage]?.url ||
      displayImages[0]?.url ||
      FALLBACK_IMAGE_URL;

    onAddToCart({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      variantId: selectedVariant?.id || null,
      variantName: selectedVariant?.name || 'Default',
      sku: selectedVariant?.sku || null,
      price: selectedPrice,
      imageUrl: selectedImageUrl,
      quantity: 1
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const getDisplayPrice = (price: number | null | undefined, fallback: number) => {
    return typeof price === 'number' && Number.isFinite(price) ? price : fallback;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Product Not Found</h2>
          <p className="text-slate-600">The product you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const displayImages = getDisplayImages(selectedVariant, product.name);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[#162d57] hover:text-[#f0be57] mb-8 transition-colors font-medium tracking-wide uppercase text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Products
      </button>

      <div className="flex flex-col lg:flex-row gap-16 relative">
        <div className="w-full lg:w-3/5 space-y-6">
          <div className="bg-[#f1efec] rounded-lg overflow-hidden aspect-[4/5] md:aspect-square">
            <img
              src={displayImages[selectedImage]?.url === FALLBACK_IMAGE_URL ? '/premium-fallback.png' : displayImages[selectedImage]?.url}
              alt={displayImages[selectedImage]?.alt_text || product.name}
              className="w-full h-full object-cover mix-blend-multiply"
            />
          </div>

          {displayImages.length > 1 && (
            <div className="grid grid-cols-4 gap-4">
              {displayImages.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`aspect-square bg-[#f1efec] rounded-lg overflow-hidden transition-all ${
                    selectedImage === index
                      ? 'ring-2 ring-[#162d57] ring-offset-2'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={image.url === FALLBACK_IMAGE_URL ? '/premium-fallback.png' : image.url}
                    alt={`${product.name} ${index + 1}`}
                    className="w-full h-full object-cover mix-blend-multiply"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-full lg:w-2/5">
          <div className="sticky top-24">
            {product.category && (
              <span className="text-xs font-bold tracking-widest uppercase text-[#d3a33c]">
                {product.category.name}
              </span>
            )}

            <h1 className="font-editorial text-4xl lg:text-5xl text-[#162d57] mt-3 mb-4 leading-tight">
              {product.name}
            </h1>

            <div className="flex items-center gap-2 mb-6 text-sm text-[#d3a33c]">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <span className="text-slate-500 underline decoration-slate-300 decoration-1 underline-offset-4 cursor-pointer hover:text-slate-800">43 Reviews</span>
            </div>

            <div className="flex items-baseline gap-4 mb-8">
              <span className="text-2xl font-semibold text-[#162d57]">
                ${getDisplayPrice(selectedVariant?.price, product.base_price).toFixed(2)}
              </span>
              {typeof selectedVariant?.compare_at_price === 'number' &&
                selectedVariant.compare_at_price > getDisplayPrice(selectedVariant?.price, product.base_price) && (
                <span className="text-lg text-slate-400 line-through">
                  ${selectedVariant.compare_at_price.toFixed(2)}
                </span>
              )}
            </div>

            {product.variants && product.variants.length > 1 && (
              <div className="mb-8">
                <label className="block text-sm font-semibold tracking-wider uppercase text-[#162d57] mb-3">
                  Select Style:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => {
                        setSelectedVariant(variant);
                        setSelectedImage(0);
                      }}
                      className={`px-4 py-3 rounded text-left transition-all border ${
                        selectedVariant?.id === variant.id
                          ? 'border-[#162d57] bg-[#162d57] text-[#f0be57]'
                          : 'border-slate-300 text-slate-700 hover:border-[#162d57]'
                      }`}
                    >
                      <div className="font-medium text-sm">{variant.name}</div>
                      <div className={`text-xs mt-1 ${selectedVariant?.id === variant.id ? 'text-[#f0be57]/80' : 'text-slate-500'}`}>
                        ${getDisplayPrice(variant.price, product.base_price).toFixed(2)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-10">
              <button
                onClick={handleAddToCart}
                className={`w-full px-6 py-4 rounded font-bold tracking-wider uppercase flex items-center justify-center gap-3 transition-all ${
                  addedToCart
                    ? 'bg-green-600 text-white'
                    : 'bg-[#162d57] text-[#f0be57] hover:bg-[#203f7a]'
                }`}
                disabled={addedToCart}
              >
                {addedToCart ? (
                  <>
                    <Check className="w-5 h-5" />
                    Added to Cart!
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart
                  </>
                )}
              </button>
            </div>

            <div className="border-t border-slate-200 divide-y divide-slate-200">
              <div className="py-4">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'description' ? null : 'description')}
                  className="flex items-center justify-between w-full text-left font-semibold tracking-wider uppercase text-[#162d57] text-sm"
                >
                  Description
                  {expandedSection === 'description' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSection === 'description' && (
                  <div className="mt-4 text-slate-600 leading-relaxed text-sm">
                    {product.description}
                  </div>
                )}
              </div>

              <div className="py-4">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'materials' ? null : 'materials')}
                  className="flex items-center justify-between w-full text-left font-semibold tracking-wider uppercase text-[#162d57] text-sm"
                >
                  Materials & Care
                  {expandedSection === 'materials' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSection === 'materials' && (
                  <div className="mt-4 text-slate-600 text-sm">
                    <ul className="space-y-2 list-disc list-inside">
                      <li>High-quality materials sourced ethically</li>
                      <li>Handle with care to maintain longevity</li>
                      <li>Spot clean preferable when possible</li>
                      {selectedVariant && (
                        <li>SKU Reference: {selectedVariant.sku}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <div className="py-4">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'shipping' ? null : 'shipping')}
                  className="flex items-center justify-between w-full text-left font-semibold tracking-wider uppercase text-[#162d57] text-sm"
                >
                  Shipping & Returns
                  {expandedSection === 'shipping' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSection === 'shipping' && (
                  <div className="mt-4 text-slate-600 text-sm leading-relaxed">
                    <p className="mb-2">Free shipping on all orders over $65.</p>
                    <p>Since each piece is created on demand specifically for you, please allow 3-7 business days for production before your order ships. We accept returns for damaged or defective items within 30 days of receipt.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-24 pt-16 border-t border-slate-200">
        <h2 className="font-editorial text-3xl text-[#162d57] text-center mb-12">Customer Reviews</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { name: "Sarah J.", review: "Absolutely stunning quality. It completely transformed my living space and feels so premium. Highly recommend!", rating: 5 },
            { name: "Michael T.", review: "The colors are vivid and the material is sturdy. Arrived well-packaged and earlier than expected.", rating: 5 },
            { name: "Emily R.", review: "Beautiful piece. The aesthetic perfectly matches my neutral decor. Will definitely be purchasing another one as a gift.", rating: 5 }
          ].map((review, i) => (
            <div key={i} className="bg-white p-6 rounded-lg border border-slate-100 shadow-sm">
              <div className="flex gap-1 mb-3 text-[#d3a33c]">
                {[...Array(review.rating)].map((_, j) => <Star key={j} className="w-4 h-4 fill-current" />)}
              </div>
              <h4 className="font-bold text-[#162d57] mb-2">{review.name}</h4>
              <p className="text-slate-600 text-sm italic">"{review.review}"</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
