import resolve from '@jridgewell/resolve-uri'

interface ReadOptions {
  encoding?: string
  defaultContent?: unknown
}

export async function readJSON(
  url: string,
  readFile: (url: string, opts: { encoding: string }) => Promise<string | Uint8Array>,
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

export function newURL(arg: string, base = '.') {
  return resolve(arg, base)
}
