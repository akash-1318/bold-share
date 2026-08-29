import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { files } from '../../../schema';
import { and, eq } from 'drizzle-orm';
import { supabase } from '../../../lib/supabase';

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
  }

  const fileInfo = await db.query.files.findFirst({ where: eq(files.id, id) });

  if (!fileInfo || fileInfo.userId !== locals.user.id) {
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
  }

  const { error: storageError } = await supabase.storage.from('uploads').remove([fileInfo.path]);
  if (storageError) {
    console.error('Failed to delete from storage:', storageError);
  }

  await db.delete(files).where(and(eq(files.id, id), eq(files.userId, locals.user.id)));

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
