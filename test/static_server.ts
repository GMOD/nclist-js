import express from 'express'
import getPort from 'get-port'

import type { Server } from 'node:http'

export default async function staticServer() {
  const app = express()
  const port = await getPort()
  app.use((_req, res, next) => {
    res.setHeader('Connection', 'close')
    next()
  })
  app.use(express.static('test/data'))
  const server = await new Promise<Server>(resolve => {
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
