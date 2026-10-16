namespace App {
  export const version = '1.0'
}

import Events = require('node:events')

export function boot() {
  Events.EventEmitter
  return App.version
}
