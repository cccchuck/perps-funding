import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Example API route for Hyperliquid funding rates.
// Replace the placeholder implementation with a real proxy when the
// public endpoint is finalized.
export async function GET() {
  try {
    // Placeholder: return empty list by default.
    return NextResponse.json(
      { code: 200, funding_rates: [] },
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
      },
    )
  } catch (err) {
    return NextResponse.json(
      { code: 500, error: (err as Error).message ?? 'Unknown error' },
      { status: 500 },
    )
  }
}

