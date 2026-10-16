export function add(a: number, b: number): number {
  return a + b
}

const maybeValue: string | null = Math.random() > 0.5 ? 'ok' : null

export const value = maybeValue ?? 'fallback'
