import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COREHUB_API_URL =
  process.env.COREHUB_API_URL || 'https://brainpool-corehub.vercel.app';

function coreHubUrl(ownerKey: string) {
  const url = new URL('/api/corehub/opportunities', COREHUB_API_URL);
  url.searchParams.set('owner_key', ownerKey);
  return url;
}

export async function GET(request: NextRequest) {
  const traceId = crypto.randomUUID();
  const ownerKey = request.nextUrl.searchParams.get('owner_key');

  if (!ownerKey) {
    return NextResponse.json(
      { data: [], _error: 'owner_key_required', traceId },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(coreHubUrl(ownerKey), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { data: [], _error: body?._error || 'corehub_fetch_failed', traceId },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { data: Array.isArray(body?.data) ? body.data : [], _error: null, traceId },
      { status: 200 },
    );
  } catch (error: any) {
    console.warn(`[corehub/opportunities] GET failed traceId=${traceId}`, error?.message);
    return NextResponse.json(
      { data: [], _error: 'corehub_unavailable', traceId },
      { status: 502 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const traceId = crypto.randomUUID();

  try {
    const body = await request.json();
    const opportunityId = body?.opportunity_id;
    if (!opportunityId) {
      return NextResponse.json(
        { data: null, _error: 'opportunity_id_required', traceId },
        { status: 400 },
      );
    }

    const url = new URL('/api/corehub/opportunities', COREHUB_API_URL);
    url.searchParams.set('id', opportunityId);
    const response = await fetch(url, {
      method: 'PATCH',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ opportunity_id: opportunityId, outcome: body?.outcome || 'shown' }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { data: null, _error: result?._error || 'corehub_consume_failed', traceId },
        { status: 502 },
      );
    }

    return NextResponse.json({ data: result?.data || null, _error: null, traceId });
  } catch (error: any) {
    console.warn(`[corehub/opportunities] PATCH failed traceId=${traceId}`, error?.message);
    return NextResponse.json(
      { data: null, _error: 'corehub_unavailable', traceId },
      { status: 502 },
    );
  }
}
