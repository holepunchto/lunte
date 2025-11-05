// Single-line if/else without braces on separate lines should be allowed
const drop = true
const start = 0
const length = 10
const obj = {
  _unclearLocalRange (start, length) {},
  _clearLocalRange (start, length) {}
}

if (drop) obj._unclearLocalRange(start, length)
else obj._clearLocalRange(start, length)
