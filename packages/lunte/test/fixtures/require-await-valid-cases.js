const promise = Promise.resolve()

async function foo() {
  await promise
}

foo()

const bar = (cb) => cb()

bar(async () => {
  await promise
})

bar(() => {
  return 42
})

function baz() {
  return 42
}

baz()

async function quux() {
  for await (const res of [promise]) {
    console.log(res)
  }
}

quux()
