// ignoreRestSiblings: siblings of rest elements are ignored (used for omitting properties)
const obj = { a: 1, b: 2, c: 3 }
const { a, b, ...rest } = obj
// Only rest is used - a and b should not be flagged because they're rest siblings
console.log(rest)
