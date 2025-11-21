declare namespace Config {
  const version: string
}

export function read() {
  return Config.version
}
