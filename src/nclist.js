import nodeUrl from 'url'
import QuickLRU from 'quick-lru'
import AbortablePromiseCache from 'abortable-promise-cache'
import { readJSON } from './util'

export default class NCList {
  constructor({ readFile, cacheSize = 100 }) {
    this.topList = []
    this.chunkCache = new AbortablePromiseCache({
      cache: new QuickLRU({ maxSize: cacheSize }),
      fill: this.readChunkItems.bind(this),
    })
    this.readFile = readFile
    if (!this.readFile) throw new Error(`must provide a "readFile" function`)
  }

  importExisting(nclist, attrs, baseURL, lazyUrlTemplate, lazyClass) {
    this.topList = nclist
    this.attrs = attrs
    this.start = attrs.makeFastGetter('Start')
    this.end = attrs.makeFastGetter('End')
    this.lazyClass = lazyClass
    this.baseURL = baseURL
    this.lazyUrlTemplate = lazyUrlTemplate
  }

  /**
   *
   *  Given an array of features, creates the nested containment list data structure
   *  WARNING: DO NOT USE directly for adding additional intervals!
   *  completely replaces existing nested containment structure
   *  (erases current topList and subarrays, repopulates from intervals)
   *  currently assumes each feature is array as described above
   */
  fill(intervals, attrs) {
    // intervals: array of arrays of [start, end, ...]
    // attrs: an ArrayRepr object
    // half-open?
    if (intervals.length === 0) {
      this.topList = []
      return
    }

    this.attrs = attrs
    this.start = attrs.makeFastGetter('Start')
    this.end = attrs.makeFastGetter('End')
    const sublist = attrs.makeSetter('Sublist')
    const { start, end } = this
    const myIntervals = intervals
    // sort by OL
    myIntervals.sort((a, b) => {
      if (start(a) !== start(b)) return start(a) - start(b)
      return end(b) - end(a)
    })
    const sublistStack = []
    let curList = []
    this.topList = curList
    curList.push(myIntervals[0])
    if (myIntervals.length === 1) return
    let curInterval
    let topSublist
    for (let i = 1, len = myIntervals.length; i < len; i += 1) {
      curInterval = myIntervals[i]
      // if this interval is contained in the previous interval,
      if (end(curInterval) < end(myIntervals[i - 1])) {
        // create a new sublist starting with this interval
        sublistStack.push(curList)
        curList = new Array(curInterval)
        sublist(myIntervals[i - 1], curList)
      } else {
        // find the right sublist for this interval
        for (;;) {
          if (sublistStack.length === 0) {
            curList.push(curInterval)
            break
          } else {
            topSublist = sublistStack[sublistStack.length - 1]
            if (end(topSublist[topSublist.length - 1]) > end(curInterval)) {
              // curList is the first (deepest) sublist that
              // curInterval fits into
              curList.push(curInterval)
              break
            } else {
              curList = sublistStack.pop()
            }
          }
        }
      }
    }
  }

  binarySearch(arr, item, getter) {
    let low = -1
    let high = arr.length
    let mid

    while (high - low > 1) {
      mid = (low + high) >>> 1
      if (getter(arr[mid]) >= item) high = mid
      else low = mid
    }

    // if we're iterating rightward, return the high index;
    // if leftward, the low index
    if (getter === this.end) return high
    return low
  }

  readChunkItems(chunkNum) {
    const url = nodeUrl.resolve(
      this.baseURL,
      this.lazyUrlTemplate.replace(/\{Chunk\}/gi, chunkNum),
    )
    return readJSON(url, this.readFile, { defaultContent: [] })
  }

  async *iterateSublist(arr, from, to, inc, searchGet, testGet, path) {
    const getChunk = this.attrs.makeGetter('Chunk')
    const getSublist = this.attrs.makeGetter('Sublist')

    const pendingPromises = []
    for (
      let i = this.binarySearch(arr, from, searchGet);
      i < arr.length && i >= 0 && inc * testGet(arr[i]) < inc * to;
      i += inc
    ) {
      if (arr[i][0] === this.lazyClass) {
        // this is a lazily-loaded chunk of the nclist
        const chunkNum = getChunk(arr[i])
        const chunkItemsP = this.chunkCache
          .get(chunkNum, chunkNum)
          .then(item => [item, chunkNum])
        pendingPromises.push(chunkItemsP)
      } else {
        // this is just a regular feature
        yield [arr[i], path.concat(i)]
      }

      // if this node has a contained sublist, process that too
      const sublist = getSublist(arr[i])
      if (sublist)
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

    for (let i = 0; i < pendingPromises.length; i += 1) {
      const [item, chunkNum] = await pendingPromises[i]
      if (item) {
        yield* this.iterateSublist(item, from, to, inc, searchGet, testGet, [
          ...path,
          chunkNum,
        ])
      }
    }
  }

  async *iterate(from, to) {
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
        this.topList,
        from,
        to,
        inc,
        searchGet,
        testGet,
        [0],
      )
    }
  }

  async histogram(from, to, numBins) {
    // calls callback with a histogram of the feature density
    // in the given interval

    const result = new Array(numBins)
    result.fill(0)
    const binWidth = (to - from) / numBins
    for await (const feat of this.iterate(from, to)) {
      const firstBin = Math.max(0, ((this.start(feat) - from) / binWidth) | 0)
      const lastBin = Math.min(
        numBins,
        ((this.end(feat) - from) / binWidth) | 0,
      )
      for (let bin = firstBin; bin <= lastBin; bin += 1) result[bin] += 1
    }
    return result
  }
}
