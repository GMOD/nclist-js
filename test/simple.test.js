import { RemoteFile } from 'generic-filehandle'
import NCListStore from '../src/feature_store'
import makeTestServer from './static_server'

let testServer
beforeAll(async () => {
  testServer = await makeTestServer()
})
afterAll(() => testServer.close())

describe('simple data', () => {
  const testCases = [
    [
      'read with generic-filehandle RemoteFile with http urls',
      () => ({
        baseUrl: `${testServer.url}/`,
        urlTemplate: 'volvox_genes/{refseq}/trackData.json',
        readFile: url => new RemoteFile(url).readFile(),
      }),
    ],
    [
      'read with generic-filehandle RemoteFile with file urls',
      () => ({
        baseUrl: `file://${process.cwd()}/test/data/`,
        urlTemplate: 'volvox_genes/{refseq}/trackData.json',
        readFile: url => new RemoteFile(url).readFile(),
      }),
    ],
  ]
  testCases.forEach(([desc, params]) => {
    test(desc, async () => {
      const store = new NCListStore(params())

      const features = []
      for await (const feature of store.getFeatures({
        refName: 'ctgA',
        start: 0,
        end: 50000,
      })) {
        features.push(feature)
      }

      expect(features.length).toBe(1)
      expect(features[0].get('start')).toBe(1049)
      expect(features).toMatchSnapshot()
    })
  })
})
