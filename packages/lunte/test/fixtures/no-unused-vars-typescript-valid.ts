import type { ExternalWidget } from './no-unused-vars-typescript.valid.types'

type DisplayProps = ExternalWidget & {
  detail: string
}

const config = { theme: 'light' }

type Config = typeof config

export function render(widget: ExternalWidget): string {
  const props: DisplayProps & { config: Config } = { ...widget, detail: widget.name, config }
  return props.detail
}
