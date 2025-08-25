import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

function getContentType(filename: string) {
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  if (filename.endsWith('.svg')) return 'image/svg+xml';
  if (filename.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get('name');
    if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
      return NextResponse.json({ error: 'Invalid or missing name parameter' }, { status: 400 });
    }

    const imagePath = path.join(process.cwd(), 'pics', name);
    const buffer = await fs.readFile(imagePath);
    const contentType = getContentType(name);

  // convert Buffer to Uint8Array for Web/Next response body
  const body = new Uint8Array(buffer);

  return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('Error serving news image:', err);
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }
}
