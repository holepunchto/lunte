import type Logger = require('node:events')

type EventBus = Logger.EventEmitter

export function createBus(): EventBus | null {
  return null
}
