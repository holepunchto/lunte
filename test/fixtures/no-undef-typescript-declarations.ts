const externalStatus = 1

export enum Status {
  Idle,
  Busy,
  Done = externalStatus
}

namespace App {
  export const version = '1.0'
}

import Logger = require('node:events')

export function report() {
  Logger.EventEmitter // ensure import-equals is referenced
  console.log(Status.Busy, App.version)
}
