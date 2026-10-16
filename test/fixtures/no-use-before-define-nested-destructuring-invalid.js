const result = { value: inner }
const { outer: { inner } } = { outer: { inner: 42 } }
console.log(result)
