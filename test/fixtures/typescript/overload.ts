function hello(name: string): void;
function hello(): void;
function hello(name?: string) {
  if (name) console.log('Hello', name)
  else console.log('Hello')
}

hello('Alice')
hello()
