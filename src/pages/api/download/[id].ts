import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { files } from '../../../schema';
import { eq } from 'drizzle-orm';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;

  if (!id) {
    return new Response('ID required', { status: 400 });
  }

  const fileInfo = await db.query.files.findFirst({
    where: eq(files.id, id),
  });

  if (!fileInfo || (fileInfo.expiresAt && new Date() > fileInfo.expiresAt)) {
    return new Response('File not found or expired', { status: 404 });
  }

  try {
    const { data, error } = await supabase.storage
      .from('uploads')
      .download(fileInfo.path);

    if (error || !data) {
      console.error('Supabase download error:', error);
      return new Response('Error retrieving file from storage', { status: 500 });
    }

    return new Response(data as any, {
      headers: {
        'Content-Type': fileInfo.type,
        'Content-Length': fileInfo.size.toString(),
        'Content-Disposition': `attachment; filename="${fileInfo.name}"`,
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return new Response('Error retrieving file', { status: 500 });
  }
};
