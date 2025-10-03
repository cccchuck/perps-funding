import type { AdapterControl, ExchangeAdapter, FundingDatum, StartContext } from './types'

function normalizeSymbol(sym: string): string {
  return sym.toUpperCase()
}

export function createHyperliquidAdapter(): ExchangeAdapter {
  const id = 'hyperliquid'
  const label = 'Hyperliquid'
  const kind: 'pull' = 'pull'

  return {
    id,
    label,
    kind,
    start: ({ onData, onStatus, intervalSec }: StartContext): AdapterControl => {
      let active = true
      let timer: any | null = null

      const fetchOnce = async () => {
        try {
          const res = await fetch('/api/hyperliquid/funding', { cache: 'no-store' })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          const rates = (data?.funding_rates ?? []) as Array<{
            symbol?: string
            rate?: number
            periodMs?: number
          }>
          const list: FundingDatum[] = []
          for (const r of rates) {
            if (!r?.symbol || typeof r.rate !== 'number') continue
            const symbol = normalizeSymbol(r.symbol)
            const periodMs = typeof r.periodMs === 'number' && r.periodMs > 0 ? r.periodMs : 3600000
            list.push({
              exchange: label,
              symbol,
              rawRate: r.rate,
              periodMs,
              ratePerHour: r.rate * (3600000 / periodMs),
            })
          }
          if (!active) return
          onData(list, id)
          onStatus?.('ok', id)
        } catch (e) {
          onStatus?.('error', id)
        }
      }

      const applyInterval = (sec?: number) => {
        if (timer) {
          clearInterval(timer)
          timer = null
        }
        if (sec && sec > 0) {
          timer = setInterval(fetchOnce, sec * 1000)
        }
      }

      fetchOnce()
      applyInterval(intervalSec)

      return {
        stop: () => {
          active = false
          if (timer) clearInterval(timer)
        },
        setIntervalSec: (sec: number) => applyInterval(sec),
        manualRefresh: async () => {
          await fetchOnce()
        },
      }
    },
  }
}

