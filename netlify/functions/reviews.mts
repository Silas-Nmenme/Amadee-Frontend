import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { getUser } from '@netlify/identity';
import { db } from '../../db/index.js';
import { reviews } from '../../db/schema.js';

export default async (req: Request) => {
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  const pending = new URL(req.url).searchParams.get('pending') === 'true';
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) return reply({ message: 'Method not allowed' }, 405);
  if (req.method !== 'GET' && req.headers.get('origin') !== new URL(req.url).origin) return reply({ message: 'Invalid request origin' }, 403);
  try {
    if (pending || req.method === 'PATCH') {
      // The SDK uses Netlify's request context when available. Verify the cookie
      // against Identity as a fallback for runtimes without that context.
      let user = await getUser();
      if (!user) {
        const token = req.headers.get('cookie')?.match(/(?:^|;\s*)nf_jwt=([^;]+)/)?.[1];
        if (token) {
          const response = await fetch(new URL('/.netlify/identity/user', req.url), { headers: { Authorization: `Bearer ${decodeURIComponent(token)}` } });
          if (response.ok) {
            const verified = await response.json();
            user = { id: verified.id, roles: verified.app_metadata?.roles };
          }
        }
      }
      if (!user?.roles?.includes('admin')) return reply({ message: 'An administrator account is required.' }, 403);
    }
    if (req.method === 'GET') {
      const list = await db.select({ id: reviews.id, name: reviews.name, rating: reviews.rating, message: reviews.message, createdAt: reviews.createdAt }).from(reviews).where(eq(reviews.approved, !pending)).orderBy(desc(reviews.createdAt)).limit(100);
      return reply({ reviews: list });
    }
    const text = await req.text();
    if (text.length > 6000) return reply({ message: 'Review is too long.' }, 413);
    let data;
    try { data = JSON.parse(text); } catch { return reply({ message: 'Invalid review.' }, 400); }
    if (!data || typeof data !== 'object') return reply({ message: 'Invalid review.' }, 400);
    if (req.method === 'PATCH') {
      if (typeof data.id !== 'string' || typeof data.approved !== 'boolean') return reply({ message: 'Invalid moderation request.' }, 400);
      const updated = data.approved
        ? await db.update(reviews).set({ approved: true }).where(eq(reviews.id, data.id)).returning({ id: reviews.id })
        : await db.delete(reviews).where(eq(reviews.id, data.id)).returning({ id: reviews.id });
      return updated.length ? reply({ success: true }) : reply({ message: 'Review not found.' }, 404);
    }
    if (data.website) return reply({ success: true }, 202);
    if (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 80 || typeof data.message !== 'string' || !data.message.trim() || data.message.trim().length > 1500 || !Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) return reply({ message: 'Enter your name, a rating from 1 to 5, and a review of up to 1,500 characters.' }, 400);
    await db.insert(reviews).values({ id: randomUUID(), name: data.name.trim(), rating: data.rating, message: data.message.trim() });
    return reply({ success: true }, 202);
  } catch {
    return reply({ message: 'Reviews are unavailable. Please try again.' }, 503);
  }
};
export const config = { path: '/api/reviews', rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
