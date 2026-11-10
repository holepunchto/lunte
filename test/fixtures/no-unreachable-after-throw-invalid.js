function bar() {
  throw new Error('error')
  console.log('unreachable')
}
