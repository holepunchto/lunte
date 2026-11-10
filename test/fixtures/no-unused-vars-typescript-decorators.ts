function track(target: object, key: string, descriptor: PropertyDescriptor): void {
  const original = descriptor.value
  descriptor.value = function (this: unknown, ...args: unknown[]) {
    console.log('track', key)
    return original.apply(this, args)
  }
}

function readonly(target: object, key: string, descriptor: PropertyDescriptor): void {
  descriptor.writable = false
}

function disable(target: object, key: string, descriptor: PropertyDescriptor): void {
  descriptor.value = () => {
    throw new Error(`${String(key)} disabled`)
  }
}

function route(path: string) {
  return function (target: Function): void {
    Reflect.defineProperty(target, 'route', { value: path })
  }
}

@route('/model')
class Model {
  @readonly
  name!: string;

  @track
  save(): string {
    return this.name
  }

  @disable
  destroy(): void {}
}

export { Model }
