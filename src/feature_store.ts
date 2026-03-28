import AbortablePromiseCache from '@gmod/abortable-promise-cache'
import QuickLRU from '@jbrowse/quick-lru'

import ArrayRepr from './array_representation.ts'
import LazyArray from './lazy_array.ts'
import GenericNCList from './nclist.ts'
import { newURL, readJSON } from './util.ts'

import type { FieldAccessors } from './array_representation.ts'

type ReadFileFn = (
  url: string,
  opts: { encoding: string },
) => Promise<string | Uint8Array>

type NCFeature = unknown[] & {
  get?: FieldAccessors['get']
  tags?: FieldAccessors['tags']
  _uniqueID?: string
  id?: () => string
  _parent?: NCFeature
  parent?: () => NCFeature | undefined
  children?: () => unknown
  decorated?: boolean
}

function idfunc(this: NCFeature) {
  return this._uniqueID ?? ''
}
function parentfunc(this: NCFeature) {
  return this._parent
}
function childrenfunc(this: NCFeature) {
  return this.get?.call(this, 'subfeatures')
}

interface HistogramMeta {
  basesPerBin: number
  arrayParams: Record<string, unknown>
  lazyArray?: LazyArray
}

interface HistogramData {
  meta: HistogramMeta[]
  stats?: { basesPerBin: number }[]
}

interface RefData {
  nclist: GenericNCList
  stats: { featureCount: number }
  attrs?: ArrayRepr
  _histograms?: HistogramData
}

interface TrackInfo {
  featureCount?: number
  intervals?: {
    nclist: unknown[]
    classes: {
      attributes: string[]
      proto?: Record<string, unknown>
      isArrayAttr?: Record<string, boolean>
    }[]
    urlTemplate: string
    lazyClass: number
  }
  histograms?: HistogramData
}

/**
 * Sequence feature store using nested containment
 * lists held in JSON files that are lazily read.
 *
 * @param {object} args constructor args
 * @param {string} args.baseUrl base URL for resolving relative URLs
 * @param {string} args.urlTemplate Template string for
 *  the root file of each reference sequence. The reference sequence
 *  name will be interpolated into this string where `{refseq}` appears.
 * @param {function} args.readFile function to use for reading remote from URLs.
 */
export default class NCListStore {
  baseUrl: string
  urlTemplates: { root: string }
  readFile: ReadFileFn
  dataRootCache: AbortablePromiseCache<string, RefData>

  constructor({
    baseUrl,
    urlTemplate,
    readFile,
    cacheSize = 10,
  }: {
    baseUrl: string
    urlTemplate: string
    readFile: ReadFileFn
    cacheSize?: number
  }) {
    this.baseUrl = baseUrl
    this.urlTemplates = { root: urlTemplate }

    this.readFile = readFile

    this.dataRootCache = new AbortablePromiseCache({
      cache: new QuickLRU({ maxSize: cacheSize }),
      fill: this.fetchDataRoot.bind(this),
    })
  }

  makeNCList() {
    return new GenericNCList({ readFile: this.readFile })
  }

  loadNCList(
    refData: RefData,
    intervals: NonNullable<TrackInfo['intervals']>,
    listUrl: string,
  ) {
    const attrs = refData.attrs
    if (attrs) {
      refData.nclist.importExisting(
        intervals.nclist,
        attrs,
        listUrl,
        intervals.urlTemplate,
        intervals.lazyClass,
      )
    }
  }

  getDataRoot(refName: string) {
    return this.dataRootCache.get(refName, refName)
  }

  fetchDataRoot(refName: string) {
    const url = newURL(
      this.urlTemplates.root.replaceAll(/{\s*refseq\s*}/g, refName),
      this.baseUrl,
    )

    // fetch the trackdata
    return readJSON(url, this.readFile).then(trackInfo =>
      // trackInfo = JSON.parse( trackInfo );
      this.parseTrackInfo(trackInfo as TrackInfo, url),
    )
  }

  parseTrackInfo(trackInfo: TrackInfo, url: string): RefData {
    const refData: RefData = {
      nclist: this.makeNCList(),
      stats: {
        featureCount: trackInfo.featureCount || 0,
      },
    }

    if (trackInfo.intervals) {
      refData.attrs = new ArrayRepr(trackInfo.intervals.classes)
      this.loadNCList(refData, trackInfo.intervals, url)
    }

    const { histograms } = trackInfo
    if (histograms?.meta) {
      for (const meta of histograms.meta) {
        meta.lazyArray = new LazyArray(
          { ...meta.arrayParams, readFile: this.readFile } as {
            urlTemplate: string
            chunkSize: number
            length: number
            cacheSize?: number
            readFile: ReadFileFn
          },
          url,
        )
      }
      refData._histograms = histograms
    }

    // parse any strings in the histogram data that look like numbers
    if (refData._histograms) {
      Object.keys(
        refData._histograms as unknown as Record<string, unknown>,
      ).forEach(key => {
        const entries = (
          refData._histograms as unknown as Record<string, unknown>
        )[key]
        if (Array.isArray(entries)) {
          entries.forEach(entry => {
            Object.keys(entry as Record<string, unknown>).forEach(key2 => {
              const e = entry as Record<string, unknown>
              if (
                typeof e[key2] === 'string' &&
                String(Number(e[key2])) === e[key2]
              ) {
                e[key2] = Number(e[key2])
              }
            })
          })
        }
      })
    }

    return refData
  }

  async getRegionStats(query: { ref: string }) {
    const data = await this.getDataRoot(query.ref)
    return data.stats
  }

  /**
   * fetch binned counts of feature coverage in the given region.
   *
   * @param {object} query
   * @param {string} query.refName reference sequence name
   * @param {number} query.start region start
   * @param {number} query.end region end
   * @param {number} query.numBins number of bins desired in the feature counts
   * @param {number} query.basesPerBin number of bp desired in each feature counting bin
   * @returns {object} as:
   *    `{ bins: hist, stats: statEntry }`
   */
  async getRegionFeatureDensities({
    refName,
    start,
    end,
    numBins,
    basesPerBin,
  }: {
    refName: string
    start: number
    end: number
    numBins?: number
    basesPerBin?: number
  }) {
    const data = await this.getDataRoot(refName)
    let resolvedNumBins = numBins
    let resolvedBasesPerBin = basesPerBin
    if (resolvedNumBins) {
      resolvedBasesPerBin = (end - start) / resolvedNumBins
    } else if (resolvedBasesPerBin) {
      resolvedNumBins = Math.ceil((end - start) / resolvedBasesPerBin)
    } else {
      throw new TypeError(
        'numBins or basesPerBin arg required for getRegionFeatureDensities',
      )
    }

    const histograms = data._histograms

    // pick the relevant entry in our pre-calculated stats
    const stats = histograms?.stats ?? []
    const statEntry = stats.find(
      entry => entry.basesPerBin >= resolvedBasesPerBin,
    )

    if (!histograms) {
      const hist = await data.nclist.histogram(start, end, resolvedNumBins)
      return { bins: hist, stats: statEntry }
    }

    // The histogramMeta array describes multiple levels of histogram detail,
    // going from the finest (smallest number of bases per bin) to the coarsest
    // (largest number of bases per bin).
    //
    // We want to use coarsest histogramMeta that's at least as fine as the one
    // we're currently rendering.
    //
    // TODO: take into account that the histogramMeta chosen here might not fit
    // neatly into the current histogram (e.g., if the current histogram is at
    // 50,000 bases/bin, and we have server histograms at 20,000 and 2,000
    // bases/bin, then we should choose the 2,000 histogramMeta rather than the
    // 20,000)
    let histogramMeta = histograms.meta[0]!
    for (const meta of histograms.meta) {
      if (resolvedBasesPerBin >= meta.basesPerBin) {
        histogramMeta = meta
      }
    }

    // number of bins in the server-supplied histogram for each current bin
    let binRatio = resolvedBasesPerBin / histogramMeta.basesPerBin

    // if the server-supplied histogram fits neatly into our requested
    if (binRatio > 0.9 && Math.abs(binRatio - Math.round(binRatio)) < 0.0001) {
      // console.log('server-supplied',query);
      // we can use the server-supplied counts
      const firstServerBin = Math.floor(start / histogramMeta.basesPerBin)
      binRatio = Math.round(binRatio)
      const histogram = []
      for (let bin = 0; bin < resolvedNumBins; bin += 1) {
        histogram[bin] = 0
      }

      if (histogramMeta.lazyArray) {
        for await (const [i, val] of histogramMeta.lazyArray.range(
          firstServerBin,
          firstServerBin + binRatio * resolvedNumBins - 1,
        )) {
          // this will count features that span the boundaries of
          // the original histogram multiple times, so it's not
          // perfectly quantitative.  Hopefully it's still useful, though.
          histogram[Math.floor(((i as number) - firstServerBin) / binRatio)]! +=
            val as number
        }
      }
      return { bins: histogram, stats: statEntry }
    }
    // console.log('make own',query);
    // make our own counts
    const hist = await data.nclist.histogram(start, end, resolvedNumBins)
    return { bins: hist, stats: statEntry }
  }

  /**
   * Fetch features in a given region. This method is an asynchronous generator
   * yielding feature objects.
   *
   * @param {object} args
   * @param {string} args.refName reference sequence name
   * @param {number} args.start start of region. 0-based half-open.
   * @param {number} args.end end of region. 0-based half-open.
   * @yields {object}
   */
  async *getFeatures({
    refName,
    start,
    end,
  }: {
    refName: string
    start: number
    end: number
  }) {
    const data = await this.getDataRoot(refName)
    const accessors = data.attrs?.accessors()
    for await (const [feature, path] of data.nclist.iterate(start, end)) {
      // the unique ID is a stringification of the path in the
      // NCList where the feature lives; it's unique across the
      // top-level NCList (the top-level NCList covers a
      // track/chromosome combination)

      // only need to decorate a feature once
      const feat = feature as NCFeature
      if (!feat.decorated && accessors) {
        const uniqueID = path.join(',')
        this.decorateFeature(accessors, feat, `${refName},${uniqueID}`)
      }
      yield feat
    }
  }

  // helper method to recursively add .get and .tags methods to a feature and its
  // subfeatures
  decorateFeature(
    accessors: ReturnType<ArrayRepr['accessors']>,
    feature: NCFeature,
    id: string,
    parent?: NCFeature,
  ) {
    feature.get = accessors.get
    feature.tags = accessors.tags
    feature._uniqueID = id
    feature.id = idfunc
    feature._parent = parent
    feature.parent = parentfunc
    feature.children = childrenfunc
    const subfeatures = accessors.get.call(
      feature as unknown as NCFeature[],
      'subfeatures',
    ) as NCFeature[] | undefined
    ;(subfeatures || []).forEach((f, i) => {
      this.decorateFeature(accessors, f, `${id}-${i}`, feature)
    })
    feature.decorated = true
  }
}
