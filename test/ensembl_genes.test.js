import { promises as fsPromises } from 'fs'
import { RemoteFile } from 'generic-filehandle'
import NCListStore from '../src/feature_store'
import makeTestServer from './static_server'

let testServer
beforeAll(async () => {
  testServer = await makeTestServer()
})
afterAll(() => testServer.close())

describe('ensembl genes', () => {
  const testCases = [
    [
      'read with generic-filehandle RemoteFile with http urls',
      () => ({
        baseUrl: `${testServer.url}/`,
        urlTemplate: 'ensembl_genes/{refseq}/trackData.json',
        readFile: url => new RemoteFile(url).readFile(),
      }),
    ],
    [
      'read with generic-filehandle RemoteFile with file urls',
      () => ({
        baseUrl: `file://${process.cwd()}/test/data/`,
        urlTemplate: 'ensembl_genes/{refseq}/trackData.json',
        readFile: url => new RemoteFile(url).readFile(),
      }),
    ],
  ]
  testCases.forEach(([desc, params]) => {
    test(`${desc} whole dataset`, async () => {
      const store = new NCListStore(params())

      const features = []
      for await (const feature of store.getFeatures({
        refName: '21',
        start: 0,
        end: 100000000,
      })) {
        features.push(feature)
      }

      expect(features.length).toBe(2979)
      expect(features[0].get('start')).toBe(34960388)
      expect(features[0].get('subfeatures')).toBe(undefined)
      expect(features[20].get('seq_id')).toBe('21')
      expect(features[20].get('subfeatures')).toBe(undefined)
      expect(features[409].get('subfeatures').length).toBe(3)
      expect(features).toMatchSnapshot()
    })

    test(`${desc} small feature queries`, async () => {
      const store = new NCListStore(params())
      const features = []

      for await (const feature of store.getFeatures({
        refName: '21',
        start: 10000,
        end: 1000000,
      })) {
        features.push(feature)
      }
      expect(features.length).toBe(1)

      features.length = 0
      for await (const feature of store.getFeatures({
        refName: '21',
        start: 9437273,
        end: 9439473,
      })) {
        features.push(feature)
      }

      expect(features.length).toBe(86)
      features.forEach(feature => {
        expect(feature.get('start')).toBeLessThan(9439473)
        expect(feature.get('end')).toBeGreaterThan(9437273)
      })

      const hist = await store.getRegionFeatureDensities({
        refName: '21',
        start: 0,
        end: 1000000,
        numBins: 10,
      })
      expect(hist).toMatchSnapshot()

      features.length = 0
      for await (const feature of store.getFeatures({
        refName: '22',
        start: 9437273,
        end: 9439473,
      })) {
        features.push(feature)
      }
      expect(features.length).toBe(0)

      const hist2 = await store.getRegionFeatureDensities({
        refName: '21',
        start: 9437273,
        end: 9439473,
        numBins: 1000,
      })
      expect(hist2).toMatchSnapshot()
    })
  })
})
