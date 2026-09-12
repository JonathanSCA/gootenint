import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CartItem } from '../types/cart';

interface CartPageProps {
  items: CartItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
}

function getSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export default function CartPage({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart
}: CartPageProps) {
  const subtotal = getSubtotal(items);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <h1 className="font-editorial text-5xl text-slate-900">Your Cart</h1>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-lg font-semibold text-slate-900">Your cart is empty.</p>
          <p className="mt-1 text-slate-600">Add a product to get started.</p>
          <Link
            to="/categories"
            className="mt-6 inline-block rounded-lg bg-[#162d57] px-5 py-3 text-sm font-semibold uppercase tracking-wider text-white transition hover:bg-[#1e3c73]"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-editorial text-5xl text-slate-900">Your Cart</h1>
          <p className="mt-2 text-slate-600">{items.length} item type(s)</p>
        </div>
        <button
          onClick={onClearCart}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          <Trash2 className="h-4 w-4" />
          Clear cart
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[96px_1fr] gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="h-24 w-24 overflow-hidden rounded-lg bg-slate-100">
                <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{item.productName}</p>
                  <p className="text-sm text-slate-600">{item.variantName}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">${item.price.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center rounded-lg border border-slate-300">
                    <button
                      onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      className="p-2 text-slate-700 transition hover:bg-slate-100"
                      aria-label={`Decrease quantity for ${item.productName}`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-8 px-2 text-center text-sm font-semibold text-slate-900">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      className="p-2 text-slate-700 transition hover:bg-slate-100"
                      aria-label={`Increase quantity for ${item.productName}`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="p-2 text-slate-500 transition hover:text-red-600"
                    aria-label={`Remove ${item.productName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-900">${subtotal.toFixed(2)}</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">Shipping and taxes calculated at checkout.</p>
          <Link
            to="/checkout"
            className="mt-5 block w-full rounded-lg bg-[#d3a33c] px-4 py-3 text-center text-sm font-bold uppercase tracking-[0.14em] text-[#18294c] transition hover:bg-[#e1b95e]"
          >
            Checkout
          </Link>
          <Link
            to="/categories"
            className="mt-3 block text-center w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
