import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { carts } from '../../db/schema.js';
import { products } from '../../public/js/data/products.js';

export default async (req: Request) => {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
  if (!['GET', 'PUT'].includes(req.method)) return reply({ message: 'Method not allowed' }, 405);
  if (req.method === 'PUT' && req.headers.get('origin') !== new URL(req.url).origin) return reply({ message: 'Invalid request origin' }, 403);
  const cookie = req.headers.get('cookie')?.match(/(?:^|;\s*)amadee_cart=([a-f0-9-]{36})(?:;|$)/)?.[1];
  const id = cookie || randomUUID();
  if (!cookie) headers.set('Set-Cookie', `amadee_cart=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`);
  try {
    if (req.method === 'GET') {
      const [cart] = await db.select().from(carts).where(eq(carts.id, id));
      return reply({ items: cart?.items || [] });
    }
    if (Number(req.headers.get('content-length')) > 30000) return reply({ message: 'Cart is too large.' }, 413);
    const body = await req.text();
    if (body.length > 30000) return reply({ message: 'Cart is too large.' }, 413);
    let items;
    try { items = JSON.parse(body).items; } catch { return reply({ message: 'Invalid cart.' }, 400); }
    if (!Array.isArray(items) || items.length > 100) return reply({ message: 'Invalid cart.' }, 400);
    const clean: { id: string; size: string; colour: string; quantity: number }[] = [];
    for (const item of items) {
      const p = products.find(p => p.id === item?.id);
      if (!p || !p.inStock || !p.sizes.includes(item.size) || !p.colours.includes(item.colour) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) return reply({ message: 'Please choose an available item, size, colour and quantity from 1 to 20.' }, 400);
      const existing = clean.find(x => x.id === item.id && x.size === item.size && x.colour === item.colour);
      if (existing) existing.quantity = Math.min(20, existing.quantity + item.quantity);
      else clean.push({ id: p.id, size: item.size, colour: item.colour, quantity: item.quantity });
    }
    await db.insert(carts).values({ id, items: clean }).onConflictDoUpdate({ target: carts.id, set: { items: clean, updatedAt: new Date() } });
    return reply({ items: clean });
  } catch {
    return reply({ message: 'Your cart could not be saved. Please try again.' }, 503);
  }
};
export const config = { path: '/api/cart' };
