function sealed(constructor: Function): void {
  constructor.prototype.__sealed = true
}

function configurable(flag: boolean) {
  return function decorator(target: object, key: string): void {
    Object.defineProperty(target, key, { configurable: flag })
  }
}

@sealed
class Service {
  @configurable(true)
  state!: string;

  @logCall
  execute(): void {
    console.log(this.state)
  }
}

new Service()
