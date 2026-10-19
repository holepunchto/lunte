try {
  throw new Error('test')
} catch (error) {
  // error is not used
  console.log('caught')
}
