const getPort = require('get-port')
const express = require('express')

module.exports = async () => {
  const app = express()
  const port = await getPort()
  app.use(express.static('test/data'))
  const server = await new Promise(resolve => {
    const s = app.listen(port, () => resolve(s))
  })

  // const fetch = require('cross-fetch')

  // fetch('http://localhost:3000/')
  //   .then(res => res.text())
  //   .then(text => {
  //     debugger
  //     console.log(text)
  //     server.close()
  //   })

  return {
    url: `http://localhost:${port}/`,
    close() {
      return new Promise(resolve => {
        server.close(resolve)
      })
    },
  }
}
