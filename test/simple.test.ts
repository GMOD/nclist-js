import fetch from 'cross-fetch'
import { RemoteFile } from 'generic-filehandle2'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import makeTestServer from './static_server.ts'
import NCListStore from '../src/index.ts'

let testServer
beforeAll(async () => {
  testServer = await makeTestServer()
})
afterAll(() => testServer.close())

describe('simple data', () => {
  const testCases = [
    [
      'read with generic-filehandle2 RemoteFile with http urls',
      () => ({
        baseUrl: `${testServer.url}/`,
        urlTemplate: 'volvox_genes/{refseq}/trackData.json',
        readFile: url => new RemoteFile(url, { fetch }).readFile(),
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
      expect(features[0].get('Start')).toBe(1049)
      expect(features[0].get('zonker')).toBe(undefined)
      expect(features).toMatchSnapshot()
    })
  })
})

describe('volvox_genes_nclist - phase string to number conversion', () => {
  test('phase stored as string in nclist is returned as number', async () => {
    const store = new NCListStore({
      baseUrl: `${testServer.url}/`,
      urlTemplate: 'volvox_genes_nclist/{refseq}/trackData.json',
      readFile: url => new RemoteFile(url, { fetch }).readFile(),
    })

    const features = []
    for await (const feature of store.getFeatures({
      refName: 'ctgA',
      start: 1,
      end: 50000,
    })) {
      features.push(feature)
    }

    expect(features.length).toBe(1)
    const gene = features[0]
    const mRNAs = gene.get('subfeatures')
    expect(mRNAs.length).toBeGreaterThan(0)

    // collect all CDS subfeatures (class 1, which have Phase stored as strings)
    const cdsFeatures = []
    for (const mRNA of mRNAs) {
      const subs = mRNA.get('subfeatures')
      for (const sub of subs) {
        if (sub.get('phase') !== undefined) {
          cdsFeatures.push(sub)
        }
      }
    }

    expect(cdsFeatures.length).toBeGreaterThan(0)
    for (const cds of cdsFeatures) {
      // the raw value at index 4 in the nclist array is a string (e.g. "0", "1", "2")
      expect(typeof cds[4]).toBe('string')
      // but .get('phase') converts it to a number
      expect(typeof cds.get('phase')).toBe('number')
    }
  })
})
