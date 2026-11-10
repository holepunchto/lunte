type Greeting = {
  message: string
  repeat?: number
}

interface Person {
  name: string
  greeting?: Greeting
}

const defaultGreeting: Greeting = { message: 'Hello' }

export function greetPerson(user: Person): Greeting {
  const note: Greeting = user.greeting ?? {
    message: `${defaultGreeting.message}, ${user.name}`
  }
  return note
}

console.log(greetPerson({ name: 'Ada' }).message)
