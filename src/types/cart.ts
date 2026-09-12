export interface CartItem {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantId: string | null;
  variantName: string;
  sku: string;
  price: number;
  quantity: number;
  imageUrl: string;
}

export interface AddToCartInput {
  productId: string;
  productSlug: string;
  productName: string;
  variantId?: string | null;
  variantName?: string | null;
  sku?: string | null;
  price: number;
  imageUrl?: string | null;
  quantity?: number;
}

export interface CheckoutInput {
  email: string;
  customer: {
    fullName: string;
    email: string;
  };
  shippingAddress: {
    name: string;
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  payment: {
    provider: 'mock';
    label: string;
    last4: string;
    testCardNumber: string;
  };
}
