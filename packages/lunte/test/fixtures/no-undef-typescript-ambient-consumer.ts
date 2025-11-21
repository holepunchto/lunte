export function showConfig() {
  if (MODULE_FLAG) {
    console.log(ScriptConfig.apiBase, SCRIPT_VERSION)
  }
}
