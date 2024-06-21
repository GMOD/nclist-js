//@ts-nocheck
import resolve from '@jridgewell/resolve-uri'

export async function readJSON(url, readFile, options = {}) {
  const { defaultContent = {} } = options
  let str
  try {
    str = await readFile(url, { encoding: 'utf8' })
    return JSON.parse(str)
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

export function foo() {}

export function newURL(arg: string, base?: string = '.') {
  return resolve(arg, base)
}
