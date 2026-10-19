// Else with multi-line body should require braces
const obj = { method: () => {} }
const drop = true
if (drop) obj.method(1)
else obj.method(
  2
)
