// Single-line for-in without braces is valid
for (const key in {}) console.log(key)

// With braces is also valid
for (const k in { a: 1 }) {
  console.log(k)
}
