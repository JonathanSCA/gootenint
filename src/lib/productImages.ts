export const FALLBACK_PRODUCT_IMAGE_URL = 'https://images.pexels.com/photos/1939485/pexels-photo-1939485.jpeg';

export interface ProductImageLike {
  id?: string;
  url?: string | null;
  alt_text?: string | null;
  is_primary?: boolean | null;
  sort_order?: number | null;
}

export interface ProductVariantWithImages<TImage extends ProductImageLike = ProductImageLike> {
  images?: TImage[] | null;
}

export function sortProductImages<TImage extends ProductImageLike>(images: TImage[]): TImage[] {
  return [...images].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

export function getDefaultProductImage<TImage extends ProductImageLike>(
  variants?: Array<ProductVariantWithImages<TImage>> | null
): TImage | null {
  const images = (variants || []).flatMap((variant) => variant.images || []).filter((image) => image.url);
  if (images.length === 0) return null;

  const primary = images.find((image) => image.is_primary);
  if (primary) return primary;

  return sortProductImages(images)[0] || null;
}

export function getDefaultProductImageUrl(
  variants?: ProductVariantWithImages[] | null,
  fallbackUrl = FALLBACK_PRODUCT_IMAGE_URL
): string {
  return getDefaultProductImage(variants)?.url || fallbackUrl;
}

export function findVariantWithDefaultImage<TVariant extends ProductVariantWithImages>(
  variants?: TVariant[] | null
): TVariant | null {
  const defaultImage = getDefaultProductImage(variants);
  if (!defaultImage) return variants?.[0] || null;

  return (
    (variants || []).find((variant) =>
      (variant.images || []).some((image) =>
        defaultImage.id ? image.id === defaultImage.id : image.url === defaultImage.url
      )
    ) ||
    variants?.[0] ||
    null
  );
}
