import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { nanoid } from 'nanoid';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { fileName } = body;

    if (!fileName) {
      return new Response(JSON.stringify({ error: 'Filename is required' }), { status: 400 });
    }

    const id = nanoid(10);
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${id}-${safeFileName}`;

    const { data, error } = await supabase.storage
      .from('uploads')
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      console.error('Error creating signed URL:', error);
      return new Response(JSON.stringify({ error: 'Failed to generate upload URL' }), { status: 500 });
    }

    return new Response(JSON.stringify({
      signedUrl: data.signedUrl,
      path: data.path,
      id: id,
    }), { status: 200 });
  } catch (error) {
    console.error('Signed URL API error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
