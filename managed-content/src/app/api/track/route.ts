import { NextRequest, NextResponse } from 'next/server';
import { recordMetric, store } from '@/lib/store';
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';
const validEvents = new Set(['page_view', 'sample_play', 'checkout_click']);
const validSamples = new Set(['sample-01', 'sample-02', 'sample-03']);

export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length') || 0) > 1000) return new NextResponse(null, { status: 413 });
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return new NextResponse(null, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return new NextResponse(null, { status: 400 }); }
  if (!body || typeof body !== 'object') return new NextResponse(null, { status: 400 });
  const { name, sampleId } = body as { name?: unknown; sampleId?: unknown };
  if (typeof name !== 'string' || !validEvents.has(name) || (name === 'sample_play' && (typeof sampleId !== 'string' || !validSamples.has(sampleId)))) return new NextResponse(null, { status: 400 });
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipHash = createHash('sha256').update(`${process.env.METRICS_SALT || 'development-only'}:${ip}`).digest('hex').slice(0, 20);
    const minute = Math.floor(Date.now() / 60000);
    const limiter = `managed:track-limit:${ipHash}:${minute}`;
    const count = Number(await store(['INCR', limiter]));
    if (count === 1) await store(['EXPIRE', limiter, 90]);
    if (count > 60) return new NextResponse(null, { status: 429 });
    await recordMetric(name === 'sample_play' ? `${name}:${sampleId}` : name);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Analytics unavailable' }, { status: 503 });
  }
}
