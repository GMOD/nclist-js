//@ts-nocheck
import resolve from '@jridgewell/resolve-uri'

export async function readJSON(url, readFile, options = {}) {
  const { defaultContent = {} } = options
  try {
    const str = await readFile(url, { encoding: 'utf8' })
    const decoder = new TextDecoder('utf8')
    return JSON.parse(decoder.decode(str))
  } catch (error) {
    if (
      error.code === 'ENOENT' ||
      error.status === 404 ||
      error.message.includes('404') ||
      error.message.includes('ENOENT')
    ) {
      return defaultContent
    }
    throw error
  }
}

export function newURL(arg: string, base = '.') {
  return resolve(arg, base)
}
