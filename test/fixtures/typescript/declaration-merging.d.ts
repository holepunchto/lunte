declare interface BuildOptions {
  clean?: boolean
}

declare function build(opts?: BuildOptions): Promise<void>

declare namespace build {
  export { type BuildOptions }
}

export = build
