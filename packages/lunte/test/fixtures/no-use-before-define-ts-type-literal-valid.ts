function foo() {
  const id = ({ id: 'x' } as { id: string }).id
  console.log(id)
}

foo()
