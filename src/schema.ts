import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const snippets = sqliteTable('snippets', {
  id: text('id').primaryKey(), // nanoid short link
  content: text('content').notNull(), // HTML content from Tiptap
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer('expires_at', { mode: 'timestamp' }), // null means no expiry
});

export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  size: integer('size').notNull(),
  path: text('path').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
});
