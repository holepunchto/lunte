// typeof should not report undefined variables
if (typeof undeclaredVar !== 'undefined') {
  console.log('exists')
}
const check = typeof anotherUndeclared === 'string'
console.log(check)
