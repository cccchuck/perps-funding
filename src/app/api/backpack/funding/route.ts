import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch("https://api.backpack.exchange/api/v1/markPrices", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { code: res.status, error: "Failed to fetch Backpack funding rates" },
        { status: 502 },
      );
    }

    const data = await res.json();
    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { code: 500, error: (err as Error).message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
