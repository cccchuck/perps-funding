import type { AdapterControl, ExchangeAdapter, FundingDatum, StartContext } from './types'

function normalizeSymbolFromContract(contractName?: string): string | null {
  if (!contractName) return null
  const u = contractName.toUpperCase()
  if (u.endsWith('USD')) return u.slice(0, -3)
  return u
}

export function createEdgeXAdapter(): ExchangeAdapter {
  const id = 'edgex'
  const label = 'EdgeX'
  const kind: 'push' = 'push'

  return {
    id,
    label,
    kind,
    start: ({ onData, onStatus }: StartContext): AdapterControl => {
      let ws: WebSocket | null = null
      let active = true
      // symbol -> datum map
      const map = new Map<string, FundingDatum>()

      const open = () => {
        if (ws) return
        onStatus?.('connecting', id)
        ws = new WebSocket(`wss://quote.edgex.exchange/api/v1/public/ws?timestamp=${Date.now()}`)

        ws.onopen = () => {
          onStatus?.('open', id)
          ws?.send(
            JSON.stringify({ type: 'subscribe', channel: 'ticker.all.1s' }),
          )
        }

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data)
            if (msg?.type === 'ping') {
              const t =
                typeof msg.time === 'string' || typeof msg.time === 'number'
                  ? String(msg.time)
                  : String(Date.now())
              ws?.send(JSON.stringify({ type: 'pong', time: t }))
              return
            }
            if (msg?.type === 'quote-event' && msg?.content?.data) {
              const arr = msg.content.data as Array<{
                contractName?: string
                fundingRate?: string | number
                fundingTime?: string | number
                nextFundingTime?: string | number
              }>
              let changed = false
              for (const item of arr) {
                const sym = normalizeSymbolFromContract(item.contractName)
                if (!sym) continue
                const ft = item.fundingTime != null ? Number(item.fundingTime) : undefined
                const nft = item.nextFundingTime != null ? Number(item.nextFundingTime) : undefined
                const rate = item.fundingRate != null ? Number(item.fundingRate) : undefined
                const periodMs = ft != null && nft != null ? nft - ft : undefined
                if (periodMs == null || periodMs <= 0 || rate == null) continue
                const hours = periodMs / 3600000
                if (!isFinite(hours) || hours <= 0) continue
                const ratePerHour = rate / hours
                const prev = map.get(sym)
                if (!prev || prev.rawRate !== rate || prev.periodMs !== periodMs) {
                  map.set(sym, {
                    exchange: label,
                    symbol: sym,
                    rawRate: rate,
                    periodMs,
                    ratePerHour,
                  })
                  changed = true
                }
              }
              if (changed && active) {
                onData(Array.from(map.values()), id)
              }
            }
          } catch {
            // ignore
          }
        }

        ws.onclose = () => {
          onStatus?.('closed', id)
          ws = null
          if (active) {
            // try reconnect after short delay
            setTimeout(open, 2000)
          }
        }
        ws.onerror = () => onStatus?.('error', id)
      }

      open()

      return {
        stop: () => {
          active = false
          try {
            ws?.close()
          } catch {}
          ws = null
        },
      }
    },
  }
}

