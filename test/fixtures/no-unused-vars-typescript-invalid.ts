enum Status {
  Idle,
  Busy
}

export function noop(value: Status) {
  return value === value
}
