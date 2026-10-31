import { products } from '../data/products.js';
import { byId, formatNaira } from './utils.js';
import { toast } from './toast.js';
import { getWhatsappNumber } from '../config.js';
let cart = [];
let queue = Promise.resolve();
let loaded = false;

async function request(options) {
  const response = await fetch('/api/cart', { credentials: 'same-origin', ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Your cart is unavailable. Please try again.');
  return data.items;
}
function notify() {
  const count = cart.reduce((sum, x) => sum + x.quantity, 0);
  if (byId('cart-count')) byId('cart-count').textContent = String(count);
  window.dispatchEvent(new CustomEvent('amadee:cart-change'));
}
export async function loadCart() {
  cart = await request();
  cart = cart.filter(x => products.some(p => p.id === x.id));
  // Import carts saved by the earlier storefront only after server access succeeds.
  try {
    const legacy = JSON.parse(localStorage.getItem('amadee-stiches-cart-v1') || '[]');
    if (!cart.length && Array.isArray(legacy) && legacy.length) {
      const items = legacy.filter(x => {
        const p = products.find(p => p.id === x?.id);
        return p?.inStock && p.sizes.includes(x.size) && p.colours.includes(x.colour) && Number.isInteger(x.quantity) && x.quantity >= 1 && x.quantity <= 20;
      });
      if (items.length) cart = await request({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
    }
    localStorage.removeItem('amadee-stiches-cart-v1');
  } catch { /* An unavailable legacy store must not block the saved server cart. */ }
  loaded = true;
  notify();
}
function mutate(change) {
  queue = queue.catch(() => {}).then(async () => {
    if (!loaded) await loadCart();
    const next = cart.map(x => ({ ...x }));
    change(next);
    cart = await request({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: next }) });
    notify();
  });
  return queue.catch(err => { toast(err.message, 'error'); throw err; });
}
export const getCart = () => cart.map(x => ({ ...x, product: products.find(p => p.id === x.id) }));
export const getSubtotal = () => getCart().reduce((sum, x) => sum + x.product.price * x.quantity, 0);
export async function addToCart(id, quantity = 1, options = {}) {
  const p = products.find(x => x.id === id);
  if (!p?.inStock || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return toast('Choose an available item and a quantity from 1 to 20.', 'error');
  try {
    await mutate(next => {
      const size = options.size || p.sizes[0], colour = options.colour || p.colours[0];
      const existing = next.find(x => x.id === id && x.size === size && x.colour === colour);
      if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
      else next.push({ id, size, colour, quantity });
    });
    toast('Added to your cart.');
  } catch { /* Error is displayed by mutate. */ }
}
export const updateQuantity = (index, delta) => mutate(next => { if (next[index]) next[index].quantity = Math.max(1, Math.min(20, next[index].quantity + delta)); });
export const updateOptions = (index, options) => mutate(next => { if (next[index]) Object.assign(next[index], options); });
export const removeItem = index => mutate(next => { next.splice(index, 1); });
export const clearCart = () => mutate(next => { next.splice(0); });
export function openCart() { window.location.assign('/cart.html'); }
export function whatsappUrl(extra = '') {
  const lines = getCart().map(x => `${x.product.name} (${x.size}, ${x.colour}) × ${x.quantity} — ${formatNaira(x.product.price * x.quantity)}`);
  return `https://wa.me/${getWhatsappNumber()}?text=${encodeURIComponent(`Hello Amadee-Stiches, I'd like to order:\n${lines.join('\n')}\nSubtotal: ${formatNaira(getSubtotal())}${extra}`)}`;
}
export function initCart() {
  byId('open-cart')?.addEventListener('click', openCart);
  return loadCart().catch(err => { toast(err.message, 'error'); throw err; });
}
