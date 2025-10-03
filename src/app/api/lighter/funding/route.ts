import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch(
      'https://mainnet.zklighter.elliot.ai/api/v1/funding-rates',
      {
        headers: { accept: 'application/json' },
        // do not cache, always fetch fresh
        cache: 'no-store',
      },
    )

    if (!res.ok) {
      return NextResponse.json(
        { code: res.status, error: 'Failed to fetch Lighter funding rates' },
        { status: 502 },
      )
    }

    const data = await res.json()
    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        // disable CDN cache
        'cache-control': 'no-store',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { code: 500, error: (err as Error).message ?? 'Unknown error' },
      { status: 500 },
    )
  }
}

