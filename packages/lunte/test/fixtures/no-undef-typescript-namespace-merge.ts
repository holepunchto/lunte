declare namespace App {
  const ignored: string
}

namespace App {
  export const version = '1.0'
  export function describe() {
    return version
  }
}

export function print() {
  return App.describe()
}
