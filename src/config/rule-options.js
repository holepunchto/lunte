export function mergeRuleOptions(defaults, options = []) {
  const base = Array.isArray(defaults) ? defaults : []
  const length = Math.max(base.length, options.length)
  return Array.from({ length }, (_, index) => mergeOption(base[index], options[index]))
}

function mergeOption(fallback, value) {
  if (value === undefined) {
    return fallback
  }
  if (!isPlainObject(value) || !isPlainObject(fallback)) {
    return value
  }
  const merged = { ...fallback }
  for (const [key, child] of Object.entries(value)) {
    merged[key] = mergeOption(fallback[key], child)
  }
  return merged
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
