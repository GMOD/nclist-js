//eslint-disable-next-line @typescript-eslint/no-var-requires
const getPort = require('get-port')
//eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express')

module.exports = async () => {
  const app = express()
  const port = await getPort()
  app.use(express.static('test/data'))
  const server = await new Promise(resolve => {
    const s = app.listen(port, () => resolve(s))
  })

  return {
    url: `http://localhost:${port}/`,
    close() {
      return new Promise(resolve => {
        server.close(resolve)
      })
    },
  }
}
