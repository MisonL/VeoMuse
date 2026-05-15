import { readFileSync } from 'fs'
import path from 'path'

export const readAppCssBundle = () => {
  const appCssPath = path.resolve(process.cwd(), 'apps/frontend/src/App.css')
  const appCss = readFileSync(appCssPath, 'utf8')
  const imports = [...appCss.matchAll(/@import ['"](.+)['"];/g)].map((match) => match[1])
  if (imports.length === 0) return appCss

  return imports
    .map((importPath) => readFileSync(path.resolve(path.dirname(appCssPath), importPath), 'utf8'))
    .join('\n')
}
