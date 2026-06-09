import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const snippets = pgTable('snippets', {
  id: text('id').primaryKey(), // nanoid short link
  content: text('content').notNull(), // HTML content from Tiptap
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'), // null means no expiry
});

export const files = pgTable('files', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  size: integer('size').notNull(),
  path: text('path').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
});
