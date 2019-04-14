import { fetch } from 'jest-fetch-mock'
import NCListStore from '../src/feature_store'

test('one', async () => {
  const store = new NCListStore({
    baseUrl: '/foo',
    urlTemplate: 'Genes/{refseq}/trackData.json',
    fetch,
  })

  const features = []
  for await (const feature of store.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 50000,
  })) {
    features.push(feature)
  }

  expect(features.length).toBe(20)
  expect(features).toMatchSnapshot()
})
