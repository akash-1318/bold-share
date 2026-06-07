import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { files } from '../../schema';
import { nanoid } from 'nanoid';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

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
    const uploadDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadDir, `${id}-${file.name}`);

    // Ensure directory exists
    await mkdir(uploadDir, { recursive: true });

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

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
