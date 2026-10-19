class Foo {
  constructor(readonly bar: number) {
    console.log('Bar is', bar)
  }
}

new Foo(10)
