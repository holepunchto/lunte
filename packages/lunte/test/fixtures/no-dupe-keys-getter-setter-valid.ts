let internal = 0

const obj = {
  get state() {
    return internal
  },
  set state(next: number) {
    internal = next
  }
}

console.log(obj)
