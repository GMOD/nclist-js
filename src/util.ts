interface ReadOptions {
  encoding?: string
  defaultContent?: unknown
}

export async function readJSON(
  url: string,
  readFile: (
    url: string,
    opts: { encoding: string },
  ) => Promise<string | Uint8Array>,
  options: ReadOptions = {},
) {
  const { defaultContent = {} } = options
  try {
    const str = await readFile(url, { encoding: 'utf8' })
    const decoder = new TextDecoder('utf8')
    return JSON.parse(typeof str === 'string' ? str : decoder.decode(str))
  } catch (e) {
    const error = e as { code?: string; status?: number; message?: string }
    if (
      error.code === 'ENOENT' ||
      error.status === 404 ||
      error.message?.includes('404') ||
      error.message?.includes('ENOENT')
    ) {
      return defaultContent
    }
    throw e
  }
}

const schemeRegex = /^[\w+.-]+:\/\//
const urlRegex =
  /^([\w+.-]+:)\/\/([^@/#?]*@)?([^:/#?]*)(:\d+)?(\/[^#?]*)?(\?[^#]*)?(#.*)?/
const fileRegex =
  /^file:(?:\/\/((?![a-z]:)[^/#?]*)?)?(\/?[^#?]*)(\?[^#]*)?(#.*)?/i

const enum UrlType {
  Empty = 1,
  Hash = 2,
  Query = 3,
  RelativePath = 4,
  AbsolutePath = 5,
  SchemeRelative = 6,
  Absolute = 7,
}

interface Url {
  scheme: string
  user: string
  host: string
  port: string
  path: string
  query: string
  hash: string
  type: UrlType
}

function isAbsoluteUrl(input: string) {
  return schemeRegex.test(input)
}
function isSchemeRelativeUrl(input: string) {
  return input.startsWith('//')
}
function isAbsolutePath(input: string) {
  return input.startsWith('/')
}
function isFileUrl(input: string) {
  return input.startsWith('file:')
}
function isRelative(input: string) {
  return /^[.?#]/.test(input)
}
function parseAbsoluteUrl(input: string): Url {
  const match = urlRegex.exec(input)!
  return makeUrl(
    match[1] ?? '',
    match[2] ?? '',
    match[3] ?? '',
    match[4] ?? '',
    match[5] ?? '/',
    match[6] ?? '',
    match[7] ?? '',
  )
}
function parseFileUrl(input: string): Url {
  const match = fileRegex.exec(input)!
  const path = match[2] ?? ''
  return makeUrl(
    'file:',
    '',
    match[1] ?? '',
    '',
    isAbsolutePath(path) ? path : '/' + path,
    match[3] ?? '',
    match[4] ?? '',
  )
}
function makeUrl(
  scheme: string,
  user: string,
  host: string,
  port: string,
  path: string,
  query: string,
  hash: string,
): Url {
  return { scheme, user, host, port, path, query, hash, type: UrlType.Absolute }
}
function parseUrl(input: string): Url {
  if (isSchemeRelativeUrl(input)) {
    const url = parseAbsoluteUrl('http:' + input)
    url.scheme = ''
    url.type = UrlType.SchemeRelative
    return url
  }
  if (isAbsolutePath(input)) {
    const url = parseAbsoluteUrl('http://foo.com' + input)
    url.scheme = ''
    url.host = ''
    url.type = UrlType.AbsolutePath
    return url
  }
  if (isFileUrl(input)) {
    return parseFileUrl(input)
  }
  if (isAbsoluteUrl(input)) {
    return parseAbsoluteUrl(input)
  }
  const url = parseAbsoluteUrl('http://foo.com/' + input)
  url.scheme = ''
  url.host = ''
  url.type = input
    ? input.startsWith('?')
      ? UrlType.Query
      : input.startsWith('#')
        ? UrlType.Hash
        : UrlType.RelativePath
    : UrlType.Empty
  return url
}
function stripPathFilename(path: string) {
  if (path.endsWith('/..')) {
    return path
  }
  const index = path.lastIndexOf('/')
  return path.slice(0, index + 1)
}
function mergePaths(url: Url, base: Url) {
  normalizePath(base, base.type)
  if (url.path === '/') {
    url.path = base.path
  } else {
    url.path = stripPathFilename(base.path) + url.path
  }
}
function normalizePath(url: Url, type: UrlType) {
  const rel = type <= UrlType.RelativePath
  const pieces = url.path.split('/')
  let pointer = 1
  let positive = 0
  let addTrailingSlash = false
  for (let i = 1; i < pieces.length; i++) {
    const piece = pieces[i]
    if (!piece) {
      addTrailingSlash = true
      continue
    }
    addTrailingSlash = false
    if (piece === '.') {
      continue
    }
    if (piece === '..') {
      if (positive) {
        addTrailingSlash = true
        positive--
        pointer--
      } else if (rel) {
        pieces[pointer++] = piece
      }
      continue
    }
    pieces[pointer++] = piece
    positive++
  }
  let path = ''
  for (let i = 1; i < pointer; i++) {
    path += '/' + pieces[i]
  }
  if (!path || (addTrailingSlash && !path.endsWith('/..'))) {
    path += '/'
  }
  url.path = path
}
function resolveUri(input: string, base: string | undefined): string {
  if (!input && !base) {
    return ''
  }
  const url = parseUrl(input)
  let inputType = url.type
  if (base && inputType !== UrlType.Absolute) {
    const baseUrl = parseUrl(base)
    const baseType = baseUrl.type
    if (inputType <= UrlType.Empty) {
      url.hash = baseUrl.hash
    }
    if (inputType <= UrlType.Hash) {
      url.query = baseUrl.query
    }
    if (inputType <= UrlType.RelativePath) {
      mergePaths(url, baseUrl)
    }
    if (inputType <= UrlType.AbsolutePath) {
      url.user = baseUrl.user
      url.host = baseUrl.host
      url.port = baseUrl.port
    }
    if (inputType <= UrlType.SchemeRelative) {
      url.scheme = baseUrl.scheme
    }
    if (baseType > inputType) {
      inputType = baseType
    }
  }
  normalizePath(url, inputType)
  const queryHash = url.query + url.hash
  switch (inputType) {
    case UrlType.Hash:
    case UrlType.Query:
      return queryHash
    case UrlType.RelativePath: {
      const path = url.path.slice(1)
      if (!path) {
        return queryHash || '.'
      }
      if (isRelative(base ?? input) && !isRelative(path)) {
        return './' + path + queryHash
      }
      return path + queryHash
    }
    case UrlType.AbsolutePath:
      return url.path + queryHash
    default:
      return (
        url.scheme +
        '//' +
        url.user +
        url.host +
        url.port +
        url.path +
        queryHash
      )
  }
}

export function newURL(arg: string, base = '.') {
  return resolveUri(arg, base)
}
