export function useDependencyGlobals() {
  if (DEP_FLAG && TYPES_GLOBAL > 0) {
    return depHelper('ok')
  }
  return null
}
