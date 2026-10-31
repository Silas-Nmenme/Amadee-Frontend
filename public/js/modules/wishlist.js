import { api } from './utils.js';
import { products } from '../data/products.js';
let items = [], loaded = false, loading, queue = Promise.resolve();
const notify = () => window.dispatchEvent(new CustomEvent('amadee:wishlist-change'));
export const getWishlist = () => [...items];
export function initWishlist() {
  if (loaded) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    items = (await api('/wishlist')).items;
    try {
      const legacy = JSON.parse(localStorage.getItem('amadee-stiches-wishlist-v1') || '[]');
      if (Array.isArray(legacy) && legacy.length) {
        const merged = [...new Set([...items, ...legacy.filter(id => products.some(p => p.id === id))])];
        items = (await api('/wishlist', { method: 'PUT', body: JSON.stringify({ items: merged }) })).items;
      }
      localStorage.removeItem('amadee-stiches-wishlist-v1');
    } catch { /* Keep an unimported legacy wishlist available for the next visit. */ }
    loaded = true; notify();
  })().finally(() => { loading = null; });
  return loading;
}
export function toggleWishlist(id) {
  const operation = queue.catch(() => {}).then(async () => {
    await initWishlist();
    const next = items.includes(id) ? items.filter(value => value !== id) : [...items, id];
    items = (await api('/wishlist', { method: 'PUT', body: JSON.stringify({ items: next }) })).items;
    notify();
    return items.includes(id);
  });
  queue = operation;
  return operation;
}
