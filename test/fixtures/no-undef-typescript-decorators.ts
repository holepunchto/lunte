function sealed(constructor: Function): void {
  Object.defineProperty(constructor.prototype, '__sealed', {
    value: true,
    configurable: false
  })
}

function configurable(flag: boolean) {
  return function decorator(target: object, key: string): void {
    Object.defineProperty(target, key, { configurable: flag })
  }
}

function logCall(target: object, key: string, descriptor: PropertyDescriptor): void {
  const original = descriptor.value
  descriptor.value = function wrapped(this: unknown, ...args: unknown[]) {
    console.log(key, args.length)
    return original.apply(this, args)
  }
}

@sealed
export class Controller {
  @configurable(false)
  title!: string;

  @logCall
  handle(): string {
    return this.title
  }
}
