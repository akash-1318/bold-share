import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { files } from '../../schema';
import { supabase } from '../../lib/supabase';
import { getUsageBytes, getSubscriptionStatus } from '../../lib/usage';
import { getLimitBytes, hasQuota } from '../../lib/plans';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, fileName, fileType, fileSize, filePath, expiryMinutes } = body;

    if (!id || !fileName || !fileType || typeof fileSize !== 'number' || !Number.isFinite(fileSize) || fileSize <= 0 || !filePath) {
      return new Response(JSON.stringify({ error: 'Missing or invalid required fields' }), { status: 400 });
    }

    // Ensure filePath is actually derived from this id + fileName, so a caller can't
    // claim ownership of a storage object (e.g. another user's file) by supplying a
    // filePath that get-upload-url never issued for this id.
    const expectedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const expectedPath = `${id}-${expectedFileName}`;

    if (filePath !== expectedPath) {
      return new Response(JSON.stringify({ error: 'Invalid file path' }), { status: 400 });
    }

    // Verify the actual file size in Supabase Storage
    const { data: listData, error: listError } = await supabase.storage
      .from('uploads')
      .list('', { search: filePath });

    if (listError || !listData || listData.length === 0) {
      return new Response(JSON.stringify({ error: 'Could not verify uploaded file' }), { status: 500 });
    }

    const actualFile = listData.find((f) => f.name === filePath);
    if (!actualFile || typeof actualFile.metadata?.size !== 'number') {
      return new Response(JSON.stringify({ error: 'Could not verify uploaded file' }), { status: 500 });
    }

    const actualSize = actualFile.metadata.size;

    // Re-check quota with the actual file size
    const [usage, status] = await Promise.all([
      getUsageBytes(locals.user.id),
      getSubscriptionStatus(locals.user.id),
    ]);

    if (!hasQuota(usage, actualSize, status)) {
      // Delete the file from storage since it exceeds quota
      await supabase.storage.from('uploads').remove([filePath]);
      const limit = getLimitBytes(status);
      return new Response(
        JSON.stringify({ error: 'quota_exceeded', usage, limit }),
        { status: 403 }
      );
    }

    const expiresAt = expiryMinutes ? new Date(Date.now() + expiryMinutes * 60 * 1000) : null;

    await db.insert(files).values({
      id,
      userId: locals.user.id,
      name: fileName,
      type: fileType,
      size: actualSize,
      path: filePath,
      expiresAt,
    });

    return new Response(JSON.stringify({ success: true, id }), { status: 200 });
  } catch (error) {
    console.error('Finalize Upload API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save file metadata' }), { status: 500 });
  }
};
