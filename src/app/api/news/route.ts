import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const newsPath = path.join(process.cwd(), 'docs/News.md');
    const content = await fs.readFile(newsPath, 'utf-8');

    // SHA-256 Hash
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    return NextResponse.json({ hash, content });
  } catch (error) {
    console.error('Error reading or hashing docs/News.md:', error);
    return NextResponse.json({ error: 'Could not retrieve news content.' }, { status: 500 });
  }
}
