// ES2021+ globals
new FinalizationRegistry(() => {})
new WeakRef({})
new AggregateError([new Error()], 'Multiple errors')

// Modern Node.js APIs (ES module environment)
new AbortController()
await fetch('https://example.com')
new WebSocket('wss://example.com')
structuredClone({ data: 'test' })

// Built-in objects
console.log(Buffer, process, global)
