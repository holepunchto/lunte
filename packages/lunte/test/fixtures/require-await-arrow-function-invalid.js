const foo = (cb) => cb()

foo(async () => {
  return 42
})
