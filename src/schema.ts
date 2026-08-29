import { pgTable, text, timestamp, integer, uuid, index } from 'drizzle-orm/pg-core';

export const snippets = pgTable('snippets', {
  id: text('id').primaryKey(), // nanoid short link
  content: text('content').notNull(), // HTML content from Tiptap
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'), // null means no expiry
});

export const files = pgTable('files', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  size: integer('size').notNull(),
  path: text('path').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
}, (table) => ({
  userIdIdx: index('files_user_id_idx').on(table.userId),
}));

export const subscriptions = pgTable('subscriptions', {
  userId: uuid('user_id').primaryKey(),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: text('status').notNull().default('free'), // 'free' | 'active' | 'past_due' | 'canceled'
  currentPeriodEnd: timestamp('current_period_end'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
