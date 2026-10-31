import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { wishlists } from '../../db/schema.js';
import { products } from '../../public/js/data/products.js';

export default async (req: Request) => {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
  if (!['GET', 'PUT'].includes(req.method)) return reply({ message: 'Method not allowed' }, 405);
  if (req.method === 'PUT' && req.headers.get('origin') !== new URL(req.url).origin) return reply({ message: 'Invalid request origin' }, 403);
  const cookie = req.headers.get('cookie')?.match(/(?:^|;\s*)amadee_wishlist=([a-f0-9-]{36})(?:;|$)/)?.[1];
  const id = cookie || randomUUID();
  if (!cookie) headers.set('Set-Cookie', `amadee_wishlist=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`);
  try {
    if (req.method === 'GET') {
      const [list] = await db.select().from(wishlists).where(eq(wishlists.id, id));
      return reply({ items: list?.items || [] });
    }
    const text = await req.text();
    if (text.length > 5000) return reply({ message: 'Wishlist is too large.' }, 413);
    let items;
    try { items = JSON.parse(text).items; } catch { return reply({ message: 'Invalid wishlist.' }, 400); }
    if (!Array.isArray(items) || items.length > 100 || items.some(id => typeof id !== 'string' || !products.some(p => p.id === id))) return reply({ message: 'Choose products from the collection.' }, 400);
    items = [...new Set(items)];
    await db.insert(wishlists).values({ id, items }).onConflictDoUpdate({ target: wishlists.id, set: { items, updatedAt: new Date() } });
    return reply({ items });
  } catch {
    return reply({ message: 'Your wishlist is unavailable. Please try again.' }, 503);
  }
};
export const config = { path: '/api/wishlist' };
