import type { AdapterControl, ExchangeAdapter, FundingDatum, StartContext } from './types'

const MARKET_DETAILS_URL = 'https://mainnet.zklighter.elliot.ai/api/v1/orderBookDetails'

let cachedMarketMap: Map<number, string> | null = null
let marketMapPromise: Promise<Map<number, string>> | null = null

function normalizeSymbol(sym?: string | null): string | null {
  if (!sym) return null
  return sym.toUpperCase()
}

function toNumber(val: unknown): number | null {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null
  }
  if (typeof val === 'string' && val.trim() !== '') {
    const num = Number(val)
    return Number.isFinite(num) ? num : null
  }
  return null
}

async function loadMarketMap(): Promise<Map<number, string>> {
  if (cachedMarketMap) return cachedMarketMap
  if (!marketMapPromise) {
    marketMapPromise = (async () => {
      const res = await fetch(MARKET_DETAILS_URL, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const list = (data?.order_book_details ?? []) as Array<{
        market_id?: number
        symbol?: string
      }>
      const map = new Map<number, string>()
      for (const entry of list) {
        if (typeof entry?.market_id !== 'number') continue
        const symbol = normalizeSymbol(entry.symbol)
        if (!symbol) continue
        map.set(entry.market_id, symbol)
      }
      cachedMarketMap = map
      return map
    })().finally(() => {
      marketMapPromise = null
    })
  }
  return marketMapPromise
}

export function createLighterAdapter(): ExchangeAdapter {
  const id = 'lighter'
  const label = 'Lighter'
  const kind: 'push' = 'push'

  return {
    id,
    label,
    kind,
    start: ({ onData, onStatus }: StartContext): AdapterControl => {
      let ws: WebSocket | null = null
      let active = true
      let marketMap: Map<number, string> | null = cachedMarketMap
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null
      const mapBySymbol = new Map<string, FundingDatum>()

      const ensureMarketMap = async () => {
        try {
          marketMap = await loadMarketMap()
        } catch (err) {
          // ignore fetch errors; we'll retry lazily
        }
      }

      ensureMarketMap()

      const handleMarketStats = (stats: Record<string, unknown>) => {
        let changed = false

        for (const [key, value] of Object.entries(stats)) {
          if (!value || typeof value !== 'object') continue
          const entry = value as {
            market_id?: number
            symbol?: string
            funding_rate?: unknown
            current_funding_rate?: unknown
          }

          const marketId =
            typeof entry.market_id === 'number'
              ? entry.market_id
              : Number.isFinite(Number(key))
                ? Number(key)
                : null

          if (marketId == null) continue

          let symbol = marketMap?.get(marketId) ?? null
          if (!symbol) {
            const fallback = normalizeSymbol(entry.symbol)
            if (fallback) {
              symbol = fallback
              if (marketMap) {
                marketMap.set(marketId, symbol)
              } else {
                const map = new Map<number, string>()
                map.set(marketId, symbol)
                marketMap = map
                cachedMarketMap = map
              }
            } else {
              if (!marketMapPromise) ensureMarketMap()
              continue
            }
          }

          const ratePercent =
            toNumber(entry.funding_rate) ?? toNumber(entry.current_funding_rate)
          if (ratePercent == null) continue

          const rawRate = ratePercent / 100
          const periodMs = 3600000
          const ratePerHour = rawRate

          const prev = mapBySymbol.get(symbol)
          if (!prev || prev.rawRate !== rawRate || prev.periodMs !== periodMs) {
            mapBySymbol.set(symbol, {
              exchange: label,
              symbol,
              rawRate,
              periodMs,
              ratePerHour,
            })
            changed = true
          }
        }

        if (changed && active) {
          onData(Array.from(mapBySymbol.values()), id)
          onStatus?.('ok', id)
        }
      }

      const open = () => {
        if (ws) return
        onStatus?.('connecting', id)
        ws = new WebSocket('wss://mainnet.zklighter.elliot.ai/stream')

        ws.onopen = () => {
          onStatus?.('open', id)
          ws?.send(JSON.stringify({ type: 'subscribe', channel: 'market_stats/all' }))
        }

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)

            if (msg?.type === 'ping') {
              ws?.send(JSON.stringify({ type: 'pong' }))
              return
            }

            if (
              msg?.type === 'subscribed/market_stats' ||
              msg?.type === 'update/market_stats'
            ) {
              const stats = msg?.market_stats
              if (stats && typeof stats === 'object') {
                handleMarketStats(stats as Record<string, unknown>)
              }
            } else if (msg?.market_stats && msg?.channel === 'market_stats:all') {
              handleMarketStats(msg.market_stats as Record<string, unknown>)
            }
          } catch {
            // ignore malformed message
          }
        }

        ws.onclose = () => {
          onStatus?.('closed', id)
          ws = null
          if (!active) return
          if (reconnectTimer) clearTimeout(reconnectTimer)
          reconnectTimer = setTimeout(open, 2000)
        }

        ws.onerror = () => onStatus?.('error', id)
      }

      open()

      return {
        stop: () => {
          active = false
          if (reconnectTimer) {
            clearTimeout(reconnectTimer)
            reconnectTimer = null
          }
          try {
            ws?.close()
          } catch {}
          ws = null
        },
      }
    },
  }
}
