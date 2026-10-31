import { pgTable, text, jsonb, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
export const carts = pgTable('shopping_carts', {
  id: text().primaryKey(),
  items: jsonb().notNull().default([]),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const wishlists = pgTable('wishlists', {
  id: text().primaryKey(),
  items: jsonb().notNull().default([]),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
export const reviews = pgTable('reviews', {
  id: text().primaryKey(),
  name: text().notNull(),
  rating: integer().notNull(),
  message: text().notNull(),
  approved: boolean().notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
