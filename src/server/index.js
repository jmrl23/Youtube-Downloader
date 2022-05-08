const server = require('./server')
const port = process.env.PORT
const env = process.env.NODE_ENV

server.listen(port, () => {
  console.table({
    port, env
  })
})

require('./websocket')