function handle(value) {
  switch (value) {
    case 1:
      doSomething()
      break
    case 2:
      return doAnotherThing()
    default:
      console.log('fallback')
  }
}
