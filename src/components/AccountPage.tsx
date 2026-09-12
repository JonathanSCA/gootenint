import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ShieldCheck } from 'lucide-react';
import { apiFetch, readJsonResponse } from '../lib/api';
import { useAuth } from '../lib/auth';

const FALLBACK_IMAGE_URL = 'https://images.pexels.com/photos/1939485/pexels-photo-1939485.jpeg';

interface OrderSummary {
  id: string;
  status: string;
  created_at: string;
  metadata?: {
    customer?: {
      fullName?: string;
      email?: string;
    } | null;
    shippingAddress?: {
      city?: string;
      state?: string;
      postalCode?: string;
    } | null;
    payment?: {
      label?: string;
      last4?: string;
    } | null;
  };
  items?: Array<{
    product_slug?: string | null;
    product_name: string;
    quantity: number;
    image_url?: string | null;
  }>;
}

function formatStatus(status: string) {
  return status
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getStatusClassName(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-green-50 text-green-700 ring-green-200';
    case 'cancelled':
    case 'failed':
      return 'bg-red-50 text-red-700 ring-red-200';
    case 'processing':
      return 'bg-blue-50 text-blue-700 ring-blue-200';
    default:
      return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
}

export default function AccountPage() {
  const { user, role, isStaff, signOut } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      setError('');
      const response = await apiFetch('/api/account/orders');
      const data = await readJsonResponse(response);
      setOrders(data.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order history.');
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-editorial text-5xl text-slate-900">My Account</h1>
          <p className="mt-2 text-slate-600">{user?.email}</p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-slate-500">{role || 'shopper'}</p>
        </div>
        <button
          onClick={() => void signOut()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Sign out
        </button>
      </div>

      {isStaff && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 font-semibold text-amber-800">
            <ShieldCheck className="h-5 w-5" />
            Staff access enabled
          </div>
          <Link to="/admin" className="mt-3 inline-block rounded-lg bg-[#162d57] px-4 py-2 text-sm font-semibold text-white">
            Open Admin
          </Link>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-slate-900">Order History</h2>
        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
        {orders.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-8 text-center">
            <Package className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-slate-600">No completed orders yet.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex gap-4">
                    <div className="flex -space-x-3">
                      {(order.items || []).slice(0, 4).map((item, index) => (
                        <img
                          key={`${order.id}-thumb-${index}`}
                          src={item.image_url || FALLBACK_IMAGE_URL}
                          alt={item.product_name}
                          className="h-14 w-14 rounded-lg border-2 border-white bg-slate-100 object-cover shadow-sm"
                        />
                      ))}
                      {(order.items || []).length > 4 && (
                        <span className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-white bg-slate-100 text-xs font-semibold text-slate-600 shadow-sm">
                          +{(order.items || []).length - 4}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Order {order.id.slice(0, 8)}</p>
                      <p className="text-sm text-slate-500">{new Date(order.created_at).toLocaleString()}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {(order.items || []).reduce((sum, item) => sum + item.quantity, 0)} item{(order.items || []).reduce((sum, item) => sum + item.quantity, 0) === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ring-1 ${getStatusClassName(order.status)}`}>
                    {formatStatus(order.status)}
                  </span>
                </div>

                <div className="mt-4">
                  <div>
                    {order.metadata?.customer?.fullName && (
                      <p className="mt-1 text-sm text-slate-600">{order.metadata.customer.fullName}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  {order.metadata?.shippingAddress && (
                    <span className="rounded-full bg-slate-50 px-3 py-1">
                      Ship to {order.metadata.shippingAddress.city}, {order.metadata.shippingAddress.state} {order.metadata.shippingAddress.postalCode}
                    </span>
                  )}
                  {order.metadata?.payment && (
                    <span className="rounded-full bg-slate-50 px-3 py-1">
                      {order.metadata.payment.label || 'Mock payment'} ending {order.metadata.payment.last4 || '4242'}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(order.items || []).map((item, index) => (
                    item.product_slug ? (
                      <Link
                        key={`${order.id}-${index}`}
                        to={`/product/${item.product_slug}`}
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
                      >
                        {item.product_name} x{item.quantity}
                      </Link>
                    ) : (
                      <span key={`${order.id}-${index}`} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                        {item.product_name} x{item.quantity}
                      </span>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
