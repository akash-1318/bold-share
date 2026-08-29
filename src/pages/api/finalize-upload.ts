import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { files } from '../../schema';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, fileName, fileType, fileSize, filePath, expiryMinutes } = body;

    if (!id || !fileName || !fileType || !fileSize || !filePath) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const expiresAt = expiryMinutes ? new Date(Date.now() + expiryMinutes * 60 * 1000) : null;

    await db.insert(files).values({
      id,
      userId: locals.user.id,
      name: fileName,
      type: fileType,
      size: fileSize,
      path: filePath,
      expiresAt,
    });

    return new Response(JSON.stringify({ success: true, id }), { status: 200 });
  } catch (error) {
    console.error('Finalize Upload API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save file metadata' }), { status: 500 });
  }
};
