import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { nanoid } from 'nanoid';
import { getUsageBytes, getSubscriptionStatus } from '../../lib/usage';
import { getLimitBytes, hasQuota } from '../../lib/plans';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { fileName, fileSize } = body;

    if (!fileName || !fileSize) {
      return new Response(JSON.stringify({ error: 'Filename and file size are required' }), { status: 400 });
    }

    const [usage, status] = await Promise.all([
      getUsageBytes(locals.user.id),
      getSubscriptionStatus(locals.user.id),
    ]);

    if (!hasQuota(usage, fileSize, status)) {
      return new Response(
        JSON.stringify({ error: 'quota_exceeded', usage, limit: getLimitBytes(status) }),
        { status: 403 }
      );
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
