import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import StoreHome from './components/StoreHome';
import CategoriesPage from './components/CategoriesPage';
import CategoryProductsPage from './components/CategoryProductsPage';
import ProductDetail from './components/ProductDetail';
import CartPage from './components/CartPage';
import AdminSync from './components/AdminSync';
import ProductManagementList from './components/ProductManagementList';
import ProductEditor from './components/ProductEditor';
import CategoryManager from './components/CategoryManager';
import LoginPage from './components/LoginPage';
import AccountPage from './components/AccountPage';
import ProtectedRoute from './components/ProtectedRoute';
import CheckoutPage from './components/CheckoutPage';
import { Settings, Search, User, ShoppingBag } from 'lucide-react';
import type { AddToCartInput, CartItem, CheckoutInput } from './types/cart';
import { useAuth } from './lib/auth';
import { apiFetch, readJsonResponse } from './lib/api';

const CART_STORAGE_KEY = 'grace_dwelling_cart_v1';
const SITE_TITLE = 'Grace & Dwelling';
const DEFAULT_SITE_TAGLINE = {
  quoteText: 'Your word is a lamp to my feet and a light to my path.',
  attribution: 'PSALM 119:105'
};

function titleCaseSlug(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getPageTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return SITE_TITLE;

  if (segments[0] === 'category' && segments[1]) {
    return `${SITE_TITLE} | ${titleCaseSlug(segments[1])}`;
  }

  if (segments[0] === 'product' && segments[1]) {
    return `${SITE_TITLE} | ${titleCaseSlug(segments[1])}`;
  }

  const pageTitles: Record<string, string> = {
    categories: 'Shop',
    cart: 'Cart',
    checkout: 'Checkout',
    login: 'Sign In',
    account: 'Account',
    'my-account': 'Sign In',
    admin: 'Admin',
    'admin/manage-products': 'Manage Products',
    'admin/manage-categories': 'Manage Categories'
  };

  const routeKey = segments.join('/');
  const routeTitle =
    pageTitles[routeKey] ||
    (segments[0] === 'admin' && segments[1] === 'edit-product' ? 'Edit Product' : titleCaseSlug(segments[segments.length - 1] || ''));

  return `${SITE_TITLE} | ${routeTitle}`;
}

function CategoryProductsWrapper() {
  const { slug } = useParams();
  const location = useLocation();
  const categoryName = location.state?.name || 'Category';
  if (!slug) return null;
  return <CategoryProductsPage categorySlug={slug} categoryName={categoryName} />;
}

function ProductDetailWrapper({ onAddToCart }: { onAddToCart: (item: AddToCartInput) => void }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  if (!slug) return null;
  // Use a simple fallback back-button, or rely on browser back
  return <ProductDetail slug={slug} onBack={() => navigate(-1)} onAddToCart={onAddToCart} />;
}

function ProductEditorWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  if (!id) return null;
  return <ProductEditor productId={id} onSaved={() => navigate('/admin/manage-products')} />;
}

// --- Main App ---
function App() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [siteTagline, setSiteTagline] = useState(DEFAULT_SITE_TAGLINE);
  const { user, isStaff } = useAuth();
  const location = useLocation();

  useEffect(() => {
    document.title = getPageTitle(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;

    const fetchSiteTagline = async () => {
      try {
        const response = await fetch('/api/store/site-tagline');
        const data = await readJsonResponse(response);
        if (active && data.tagline?.quoteText && data.tagline?.attribution) {
          setSiteTagline({
            quoteText: data.tagline.quoteText,
            attribution: data.tagline.attribution
          });
        }
      } catch (error) {
        console.warn('Failed to load site tagline:', error);
      }
    };

    fetchSiteTagline();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as CartItem[];
      if (!Array.isArray(parsed)) return;
      setCartItems(parsed);
    } catch (error) {
      console.warn('Failed to load cart from storage:', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  const totalCartQuantity = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const handleAddToCart = (item: AddToCartInput) => {
    const variantId = item.variantId || null;
    const cartItemId = `${item.productId}:${variantId || 'default'}`;

    setCartItems((previous) => {
      const existing = previous.find((cartItem) => cartItem.id === cartItemId);
      if (existing) {
        return previous.map((cartItem) =>
          cartItem.id === cartItemId
            ? { ...cartItem, quantity: cartItem.quantity + (item.quantity || 1) }
            : cartItem
        );
      }

      const nextItem: CartItem = {
        id: cartItemId,
        productId: item.productId,
        productSlug: item.productSlug,
        productName: item.productName,
        variantId,
        variantName: item.variantName || 'Default',
        sku: item.sku || 'N/A',
        price: item.price,
        quantity: item.quantity || 1,
        imageUrl: item.imageUrl || 'https://images.pexels.com/photos/1939485/pexels-photo-1939485.jpeg'
      };

      return [...previous, nextItem];
    });
  };

  const handleUpdateCartItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems((previous) => previous.filter((item) => item.id !== itemId));
      return;
    }

    setCartItems((previous) =>
      previous.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    );
  };

  const handleRemoveCartItem = (itemId: string) => {
    setCartItems((previous) => previous.filter((item) => item.id !== itemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleCheckout = async (checkout: CheckoutInput) => {
    const response = await apiFetch('/api/store/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cartItems,
        ...checkout
      })
    });
    const data = await readJsonResponse(response);
    setCartItems([]);
    return data.order as { id: string; total_amount: number };
  };

  return (
    <div className="min-h-screen bg-[#f6f4f1]">
      <div className="border-b border-[#243762] bg-[#13284e] px-4 py-2 text-center text-sm tracking-wide text-[#e4b246]">
        ✦ Free shipping on orders over $65 | Scripture-inspired gifts for every season ✦
      </div>

      <nav className="sticky top-0 z-50 border-b border-[#243762] bg-[#162d57]">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center justify-between">
            <Link
              to="/"
              className="font-editorial text-4xl text-[#e4b246] transition-opacity hover:opacity-90"
            >
              Grace <span className="text-slate-100">&amp; Dwelling</span>
            </Link>

            <div className="hidden items-center gap-6 text-sm font-semibold uppercase tracking-[0.16em] text-slate-100 md:flex">
              <Link to="/" className="transition-colors hover:text-[#f0be57]">Home</Link>
              <Link to="/categories" className="transition-colors hover:text-[#f0be57]">Shop</Link>
              <Link to="/my-account" className="transition-colors hover:text-[#f0be57]">Apparel</Link>
              <Link to="/" className="transition-colors hover:text-[#f0be57]">About</Link>
            </div>

            <div className="flex items-center gap-4 text-slate-100">
              <Search className="h-4 w-4" />
              <Link
                to={user ? '/account' : '/login'}
                className="transition-opacity hover:opacity-90"
                title={user ? 'Account' : 'Sign in'}
              >
                <User className="h-4 w-4" />
              </Link>
              <Link
                to="/cart"
                className="relative transition-opacity hover:opacity-90"
                title="Cart"
              >
                <ShoppingBag className="h-4 w-4" />
                <span className="absolute -right-2 -top-2 rounded-full bg-[#e4b246] px-1.5 text-[10px] font-bold text-[#162d57]">
                  {totalCartQuantity}
                </span>
              </Link>
              {isStaff && (
                <Link
                  to="/admin"
                  className="inline-flex items-center text-slate-300 transition-colors hover:text-[#f0be57]"
                  title="Admin"
                >
                  <Settings className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="bg-[#d3a33c] px-4 py-3 text-center text-sm italic text-[#1c2b4a]">
        &ldquo;{siteTagline.quoteText}&rdquo; &nbsp; <span className="not-italic font-bold tracking-widest">- {siteTagline.attribution}</span>
      </div>

      <main className="min-h-[calc(100vh-170px)]">
        <Routes>
          <Route path="/" element={<StoreHome />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/category/:slug" element={<CategoryProductsWrapper />} />
          <Route path="/product/:slug" element={<ProductDetailWrapper onAddToCart={handleAddToCart} />} />
          <Route path="/cart" element={
            <CartPage
              items={cartItems}
              onUpdateQuantity={handleUpdateCartItemQuantity}
              onRemoveItem={handleRemoveCartItem}
              onClearCart={handleClearCart}
            />
          } />
          <Route path="/checkout" element={<CheckoutPage items={cartItems} onPlaceOrder={handleCheckout} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/account" element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          } />
          <Route path="/my-account" element={<LoginPage />} />
          
          <Route path="/admin" element={
            <ProtectedRoute roles={['admin', 'super_user']}>
              <AdminSync />
            </ProtectedRoute>
          } />
          <Route path="/admin/manage-products" element={
            <ProtectedRoute roles={['admin', 'super_user', 'publisher']}>
              <ProductManagementList />
            </ProtectedRoute>
          } />
          <Route path="/admin/edit-product/:id" element={
            <ProtectedRoute roles={['admin', 'super_user', 'publisher']}>
              <ProductEditorWrapper />
            </ProtectedRoute>
          } />
          <Route path="/admin/manage-categories" element={
            <ProtectedRoute roles={['admin']}>
              <CategoryManager />
            </ProtectedRoute>
          } />
        </Routes>
      </main>

      <footer className="mt-14 border-t border-slate-300 bg-[#f1efec] py-10">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 text-sm text-slate-600 md:grid-cols-4">
          <div>
            <p className="font-editorial text-3xl text-slate-900">Print Shop</p>
            <p className="mt-2 text-slate-600">Artful comfort pieces created on demand.</p>
          </div>
          <div>
            <p className="mb-2 font-semibold uppercase tracking-wider text-slate-900">Shop</p>
            <div className="flex flex-col gap-2">
              <Link to="/" className="text-left hover:text-slate-900">Home</Link>
              <Link to="/categories" className="text-left hover:text-slate-900">Categories</Link>
            </div>
          </div>
          <div>
            <p className="mb-2 font-semibold uppercase tracking-wider text-slate-900">Support</p>
            <p>Email: support@printshop.example</p>
            <p>Mon-Fri 9a-5p PT</p>
          </div>
          <div>
            <p className="mb-2 font-semibold uppercase tracking-wider text-slate-900">Get the List</p>
            <div className="flex gap-2">
              <input className="w-full rounded-full border border-slate-300 bg-white px-4 py-2" placeholder="Email address" />
              <button className="rounded-full bg-slate-900 px-4 py-2 text-white">Join</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
