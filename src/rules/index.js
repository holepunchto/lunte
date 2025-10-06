export const builtInRules = new Map();

export function registerRule(rule) {
  if (!rule || typeof rule.meta?.name !== 'string') {
    throw new Error('Rule must define meta.name.');
  }

  builtInRules.set(rule.meta.name, rule);
}
