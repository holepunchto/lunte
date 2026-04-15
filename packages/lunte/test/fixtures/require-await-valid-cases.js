async function foo() {
  await promise
}

bar(async () => {
  await promise
})

function baz() {}

bar(() => {})

async function quux() {
  for await (const res of [promise]) {
  }
}
