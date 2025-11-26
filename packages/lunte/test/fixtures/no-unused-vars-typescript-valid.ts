import type { ExternalWidget } from './no-unused-vars-typescript.valid.types'

type DisplayProps = ExternalWidget & {
  detail: string
}

export function render(widget: ExternalWidget): string {
  const props: DisplayProps = { ...widget, detail: widget.name }
  return props.detail
}
