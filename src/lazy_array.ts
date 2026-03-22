import AbortablePromiseCache from '@gmod/abortable-promise-cache'
import QuickLRU from '@jbrowse/quick-lru'

import { newURL, readJSON } from './util.ts'

type ReadFileFn = (
  url: string,
  opts: { encoding: string },
) => Promise<string | Uint8Array>

interface LazyArrayArgs {
  urlTemplate: string
  chunkSize: number
  length: number
  cacheSize?: number
  readFile: ReadFileFn
}

/**
 * For a JSON array that gets too large to load in one go, this class
 * helps break it up into chunks and provides an
 * async API for using the information in the array.
 */
export default class LazyArray {
  urlTemplate: string
  chunkSize: number
  length: number
  baseUrl: string
  readFile: ReadFileFn
  chunkCache: AbortablePromiseCache<number, [number, unknown[]]>

  constructor(
    {
      urlTemplate,
      chunkSize,
      length,
      cacheSize = 100,
      readFile,
    }: LazyArrayArgs,
    baseUrl: string,
  ) {
    this.urlTemplate = urlTemplate
    this.chunkSize = chunkSize
    this.length = length
    this.baseUrl = baseUrl
    this.readFile = readFile
    this.chunkCache = new AbortablePromiseCache({
      cache: new QuickLRU({ maxSize: cacheSize }),
      fill: this.getChunk.bind(this),
    })
  }

  /**
   * call the callback on one element of the array
   * @param i index
   * @param callback callback, gets called with (i, value, param)
   * @param param (optional) callback will get this as its last parameter
   */
  index(
    i: number,
    callback: (i: number, val: unknown, param: unknown) => void,
    param: unknown,
  ) {
    this.range(i, i, callback, undefined, param)
  }

  /**
   * async generator for the elements in the range [start,end]
   *
   * @param start index of first element to call the callback on
   * @param end index of last element to call the callback on
   */
  async *range(start: number, end: number, ..._rest: unknown[]) {
    start = Math.max(0, start)
    end = Math.min(end, this.length - 1)

    const firstChunk = Math.floor(start / this.chunkSize)
    const lastChunk = Math.floor(end / this.chunkSize)

    const chunkreadFiles: Promise<[number, unknown[]]>[] = []
    for (let chunk = firstChunk; chunk <= lastChunk; chunk += 1) {
      chunkreadFiles.push(this.chunkCache.get(String(chunk), chunk))
    }
    for (const elt of chunkreadFiles) {
      const [chunkNumber, chunkData] = await elt
      yield* this.filterChunkData(start, end, chunkNumber, chunkData)
    }
  }

  async getChunk(chunkNumber: number): Promise<[number, unknown[]]> {
    let url = this.urlTemplate.replaceAll(/\{Chunk\}/gi, String(chunkNumber))
    if (this.baseUrl) {
      url = newURL(url, this.baseUrl)
    }
    const data = (await readJSON(url, this.readFile)) as unknown[]
    return [chunkNumber, data]
  }

  *filterChunkData(
    queryStart: number,
    queryEnd: number,
    chunkNumber: number,
    chunkData: unknown[],
  ) {
    // index (in the overall lazy array) of the first position in this chunk
    const firstIndex = chunkNumber * this.chunkSize
    const chunkStart = Math.max(0, queryStart - firstIndex)
    const chunkEnd = Math.min(queryEnd - firstIndex, this.chunkSize - 1)
    for (let i = chunkStart; i <= chunkEnd; i += 1) {
      yield [i + firstIndex, chunkData[i]]
    }
  }
}
