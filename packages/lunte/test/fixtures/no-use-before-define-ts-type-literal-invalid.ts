function foo() {
  console.log(id)
  const id = ({ id: 'x' } as { id: string }).id
}

foo()
