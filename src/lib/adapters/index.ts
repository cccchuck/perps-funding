import type { ExchangeAdapter } from './types'
import { createLighterAdapter } from './lighter'
import { createEdgeXAdapter } from './edgex'
import { createBackpackAdapter } from './backpack'
import { createParadexAdapter } from './paradex'

export function getDefaultAdapters(): ExchangeAdapter[] {
  return [
    createLighterAdapter(),
    createEdgeXAdapter(),
    createBackpackAdapter(),
    createParadexAdapter(),
  ]
}
