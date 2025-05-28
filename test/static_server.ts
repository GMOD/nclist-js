import express from 'express'
import getPort from 'get-port'

export default async function staticServer() {
  const app = express()
  const port = await getPort()
  app.use(express.static('test/data'))
  const server = await new Promise(resolve => {
    const s = app.listen(port, () => {
      resolve(s)
    })
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
