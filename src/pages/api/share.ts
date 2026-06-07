import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { snippets } from '../../schema';
import { nanoid } from 'nanoid';
import { lt } from 'drizzle-orm';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { content, expiryMinutes } = body;

    if (!content) {
      return new Response(JSON.stringify({ error: 'Content is required' }), { status: 400 });
    }

    // Maximum 24 hours (1440 minutes)
    if (expiryMinutes && expiryMinutes > 1440) {
      return new Response(JSON.stringify({ error: 'Maximum expiry is 24 hours' }), { status: 400 });
    }

    const id = nanoid(10);
    const expiresAt = expiryMinutes ? new Date(Date.now() + expiryMinutes * 60 * 1000) : null;

    // Automatic cleanup of expired snippets before inserting new one
    await db.delete(snippets).where(lt(snippets.expiresAt, new Date()));

    await db.insert(snippets).values({
      id,
      content,
      expiresAt,
    });

    return new Response(JSON.stringify({ id }), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Failed to share snippet' }), { status: 500 });
  }
};
