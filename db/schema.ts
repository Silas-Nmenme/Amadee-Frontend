import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
export const carts = pgTable('shopping_carts', {
  id: text().primaryKey(),
  items: jsonb().notNull().default([]),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
