// Classes are not hoisted - should error when used before declaration
const instance = new MyClass()

class MyClass {
  constructor() {
    this.value = 42
  }
}

console.log(instance)
