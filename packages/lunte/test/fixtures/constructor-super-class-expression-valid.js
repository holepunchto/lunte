const Base = class {}

const Derived = class extends Base {
  constructor() {
    super()
    this.value = 42
  }
}
