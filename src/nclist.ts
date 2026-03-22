import AbortablePromiseCache from '@gmod/abortable-promise-cache'
import QuickLRU from '@jbrowse/quick-lru'

import { newURL, readJSON } from './util.ts'

import type ArrayRepr from './array_representation.ts'

type ReadFileFn = (
  url: string,
  opts: { encoding: string },
) => Promise<string | Uint8Array>
type Getter = (obj: unknown[]) => unknown

export default class NCList {
  topList: unknown[]
  chunkCache: AbortablePromiseCache<number, unknown[]>
  readFile: ReadFileFn
  attrs!: ArrayRepr
  start!: Getter
  end!: Getter
  lazyClass!: number
  baseURL!: string
  lazyUrlTemplate!: string

  constructor({
    readFile,
    cacheSize = 100,
  }: {
    readFile: ReadFileFn
    cacheSize?: number
  }) {
    this.topList = []
    this.chunkCache = new AbortablePromiseCache({
      cache: new QuickLRU({ maxSize: cacheSize }),
      fill: this.readChunkItems.bind(this),
    })
    this.readFile = readFile
  }

  importExisting(
    nclist: unknown[],
    attrs: ArrayRepr,
    baseURL: string,
    lazyUrlTemplate: string,
    lazyClass: number,
  ) {
    this.topList = nclist
    this.attrs = attrs
    this.start = attrs.makeFastGetter('Start')
    this.end = attrs.makeFastGetter('End')
    this.lazyClass = lazyClass
    this.baseURL = baseURL
    this.lazyUrlTemplate = lazyUrlTemplate
  }

  binarySearch(arr: unknown[][], item: number, getter: Getter) {
    let low = -1
    let high = arr.length
    let mid

    while (high - low > 1) {
      mid = (low + high) >>> 1
      if ((getter(arr[mid]) as number) >= item) {
        high = mid
      } else {
        low = mid
      }
    }

    // if we're iterating rightward, return the high index;
    // if leftward, the low index
    if (getter === this.end) {
      return high
    }
    return low
  }

  readChunkItems(chunkNum: number) {
    const url = newURL(
      this.lazyUrlTemplate.replaceAll(/\{Chunk\}/gi, String(chunkNum)),
      this.baseURL,
    )
    return readJSON(url, this.readFile, { defaultContent: [] }) as Promise<
      unknown[]
    >
  }

  async *iterateSublist(
    arr: unknown[][],
    from: number,
    to: number,
    inc: number,
    searchGet: Getter,
    testGet: Getter,
    path: number[],
  ): AsyncGenerator<[unknown[], number[]]> {
    const getChunk = this.attrs.makeGetter('Chunk')
    const getSublist = this.attrs.makeGetter('Sublist')

    const pendingPromises: Promise<[unknown[], number]>[] = []
    for (
      let i = this.binarySearch(arr, from, searchGet);
      i < arr.length && i >= 0 && inc * (testGet(arr[i]) as number) < inc * to;
      i += inc
    ) {
      if (arr[i][0] === this.lazyClass) {
        // this is a lazily-loaded chunk of the nclist
        const chunkNum = getChunk(arr[i]) as number
        const chunkItemsP = this.chunkCache
          .get(String(chunkNum), chunkNum)
          .then(item => [item, chunkNum] as [unknown[], number])
        pendingPromises.push(chunkItemsP)
      } else {
        // this is just a regular feature
        yield [arr[i], path.concat(i)]
      }

      // if this node has a contained sublist, process that too
      const sublist = getSublist(arr[i]) as unknown[][] | undefined
      if (sublist) {
        yield* this.iterateSublist(
          sublist,
          from,
          to,
          inc,
          searchGet,
          testGet,
          path.concat(i),
        )
      }
    }

    for (const p of pendingPromises) {
      const [item, chunkNum] = await p
      yield* this.iterateSublist(
        item as unknown[][],
        from,
        to,
        inc,
        searchGet,
        testGet,
        [...path, chunkNum],
      )
    }
  }

  async *iterate(
    from: number,
    to: number,
  ): AsyncGenerator<[unknown[], number[]]> {
    // calls the given function once for each of the
    // intervals that overlap the given interval
    // if from <= to, iterates left-to-right, otherwise iterates right-to-left

    // inc: iterate leftward or rightward
    const inc = from > to ? -1 : 1
    // searchGet: search on start or end
    const searchGet = from > to ? this.start : this.end
    // testGet: test on start or end
    const testGet = from > to ? this.end : this.start

    if (this.topList.length > 0) {
      yield* this.iterateSublist(
        this.topList as unknown[][],
        from,
        to,
        inc,
        searchGet,
        testGet,
        [0],
      )
    }
  }

  async histogram(from: number, to: number, numBins: number) {
    // calls callback with a histogram of the feature density
    // in the given interval

    const result = new Array(numBins)
    result.fill(0)
    const binWidth = (to - from) / numBins
    for await (const [feat] of this.iterate(from, to)) {
      const firstBin = Math.max(
        0,
        (((this.start(feat) as number) - from) / binWidth) | 0,
      )
      const lastBin = Math.min(
        numBins,
        (((this.end(feat) as number) - from) / binWidth) | 0,
      )
      for (let bin = firstBin; bin <= lastBin; bin += 1) {
        result[bin] += 1
      }
    }
    return result
  }
}
