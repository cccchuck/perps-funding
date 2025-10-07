import type { AdapterControl, ExchangeAdapter, FundingDatum, StartContext } from './types'

const API_PATH = '/api/backpack/funding'
const PERIOD_MS = 3600000
const SUFFIX = '_USDC_PERP'

function normalizeSymbol(sym?: string | null): string | null {
  if (!sym) return null
  const upper = sym.toUpperCase()
  if (upper.endsWith(SUFFIX)) return upper.slice(0, -SUFFIX.length)
  return upper
}

function toNumber(val: unknown): number | null {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null
  }
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function createBackpackAdapter(): ExchangeAdapter {
  const id = 'backpack'
  const label = 'Backpack'
  const kind: 'pull' = 'pull'

  return {
    id,
    label,
    kind,
    start: ({ onData, onStatus, intervalSec }: StartContext): AdapterControl => {
      let active = true
      let timer: ReturnType<typeof setInterval> | null = null

      const fetchOnce = async () => {
        try {
          const res = await fetch(API_PATH, { cache: 'no-store' })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const payload = await res.json()
          const entries = Array.isArray(payload) ? payload : []
          const list: FundingDatum[] = []

          for (const item of entries) {
            if (!item || typeof item !== 'object') continue
            const symbol = normalizeSymbol((item as { symbol?: string }).symbol)
            if (!symbol) continue
            const rate = toNumber((item as { fundingRate?: unknown }).fundingRate)
            if (rate == null) continue

            list.push({
              exchange: label,
              symbol,
              rawRate: rate,
              periodMs: PERIOD_MS,
              ratePerHour: rate,
            })
          }

          if (!active) return
          onData(list, id)
          onStatus?.('ok', id)
        } catch (err) {
          if (!active) return
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
          if (timer) {
            clearInterval(timer)
            timer = null
          }
        },
        setIntervalSec: (sec: number) => applyInterval(sec),
        manualRefresh: async () => {
          await fetchOnce()
        },
      }
    },
  }
}

