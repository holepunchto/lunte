const opts = {}
const existingName = 'hello'
const { name = existingName, world = name } = opts
console.log(world, name)
