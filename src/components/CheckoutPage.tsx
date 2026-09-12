import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CreditCard, ShoppingBag } from 'lucide-react';
import type { CartItem, CheckoutInput } from '../types/cart';
import { useAuth } from '../lib/auth';

interface CheckoutPageProps {
  items: CartItem[];
  onPlaceOrder: (checkout: CheckoutInput) => Promise<{ id: string; total_amount: number }>;
}

const TEST_CARD_NUMBER = '4242 4242 4242 4242';

function getSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export default function CheckoutPage({ items, onPlaceOrder }: CheckoutPageProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [fullName, setFullName] = useState('');
  const [address1, setAddress1] = useState('123 Test Street');
  const [city, setCity] = useState('San Diego');
  const [state, setState] = useState('CA');
  const [postalCode, setPostalCode] = useState('92101');
  const [paymentLabel, setPaymentLabel] = useState('Mock Visa');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [completedOrder, setCompletedOrder] = useState<{ id: string; total_amount: number } | null>(null);

  const subtotal = useMemo(() => getSubtotal(items), [items]);

  if (items.length === 0 && !completedOrder) {
    return <Navigate to="/cart" replace />;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setBusy(true);
      setError('');
      const order = await onPlaceOrder({
        email,
        customer: {
          fullName,
          email
        },
        shippingAddress: {
          name: fullName,
          address1,
          city,
          state,
          postalCode,
          country: 'US'
        },
        payment: {
          provider: 'mock',
          label: paymentLabel,
          last4: '4242',
          testCardNumber: TEST_CARD_NUMBER
        }
      });
      setCompletedOrder(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setBusy(false);
    }
  }

  if (completedOrder) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-green-700" />
          <h1 className="mt-4 font-editorial text-5xl text-slate-900">Order Complete</h1>
          <p className="mt-3 text-slate-700">Test order {completedOrder.id.slice(0, 8)} was created.</p>
          <p className="mt-1 font-semibold text-slate-900">${Number(completedOrder.total_amount || 0).toFixed(2)}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/account" className="rounded-lg bg-[#162d57] px-5 py-3 text-sm font-semibold text-white">
              View Order History
            </Link>
            <Link to="/categories" className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="font-editorial text-5xl text-slate-900">Checkout</h1>
      <p className="mt-2 text-slate-600">Mock checkout for testing order creation and account history.</p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-5">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

          <section>
            <h2 className="text-xl font-semibold text-slate-900">Customer</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Full name
                <input
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">Shipping</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                Address
                <input
                  required
                  value={address1}
                  onChange={(event) => setAddress1(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                City
                <input
                  required
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-medium text-slate-700">
                  State
                  <input
                    required
                    value={state}
                    onChange={(event) => setState(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  ZIP
                  <input
                    required
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>
            </div>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              <CreditCard className="h-5 w-5" />
              Payment Stub
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Payment label
                <input
                  value={paymentLabel}
                  onChange={(event) => setPaymentLabel(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Test card
                <input
                  value={TEST_CARD_NUMBER}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-500"
                />
              </label>
            </div>
          </section>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#d3a33c] px-4 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#18294c] transition hover:bg-[#e1b95e] disabled:opacity-60"
          >
            {busy ? 'Placing Test Order...' : 'Place Test Order'}
          </button>
        </form>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <img src={item.imageUrl} alt={item.productName} className="h-14 w-14 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.productName}</p>
                  <p className="text-xs text-slate-500">Qty {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">${(item.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-slate-200 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-semibold text-slate-900">${subtotal.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-slate-600">Mock shipping</span>
              <span className="font-semibold text-slate-900">$0.00</span>
            </div>
            <div className="mt-3 flex justify-between text-base font-bold text-slate-900">
              <span>Total</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
