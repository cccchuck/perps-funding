import type { ExchangeAdapter } from './types'
import { createLighterAdapter } from './lighter'
import { createEdgeXAdapter } from './edgex'
import { createHyperliquidAdapter } from './hyperliquid'
import { createParadexAdapter } from './paradex'

export function getDefaultAdapters(): ExchangeAdapter[] {
  return [
    createLighterAdapter(),
    createEdgeXAdapter(),
    createHyperliquidAdapter(),
    createParadexAdapter(),
  ]
}
