import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { files } from '../../schema';
import { nanoid } from 'nanoid';
import { supabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const expiryMinutes = parseInt(formData.get('expiryMinutes') as string);

    if (!file) {
      return new Response(JSON.stringify({ error: 'File is required' }), { status: 400 });
    }

    if (file.size > 100 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File exceeds 100MB' }), { status: 400 });
    }

    const id = nanoid(10);
    const fileName = `${id}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = fileName;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(filePath, buffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Failed to upload file to storage' }), { status: 500 });
    }

    const expiresAt = expiryMinutes ? new Date(Date.now() + expiryMinutes * 60 * 1000) : null;

    await db.insert(files).values({
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      path: filePath,
      expiresAt,
    });

    return new Response(JSON.stringify({ id }), { status: 200 });
  } catch (error) {
    console.error('Upload API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to upload file' }), { status: 500 });
  }
};
