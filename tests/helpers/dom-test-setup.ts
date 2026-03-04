import { afterEach, expect } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

const setupFlag = '__VEOMUSE_DOM_SETUP_READY__'
const globalRecord = globalThis as Record<string, unknown>
const nativeFetch = globalThis.fetch
const nativeRequest = globalThis.Request
const nativeResponse = globalThis.Response
const nativeHeaders = globalThis.Headers

if (!globalRecord[setupFlag]) {
  GlobalRegistrator.register({
    url: 'http://localhost:3000',
    width: 1280,
    height: 720
  })
  // 保持 Bun 原生 Web API，避免污染后续后端 API 测试（happy-dom 的 Headers 无 toJSON）。
  globalThis.fetch = nativeFetch
  globalThis.Request = nativeRequest
  globalThis.Response = nativeResponse
  globalThis.Headers = nativeHeaders
  globalRecord[setupFlag] = true
}

const { cleanup } = await import('@testing-library/react')
const matchers = await import('@testing-library/jest-dom/matchers')
expect.extend(matchers)

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })
  })
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// 在 happy-dom 下 requestAnimationFrame 可能以同步/微任务方式执行，
// 当组件内部存在持续 raf 循环时（例如播放循环），会导致 React 的 act(...) 偶发卡死并引发测试超时。
// 统一改为 setTimeout(16ms) 以获得稳定、可取消的行为。
globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
  setTimeout(() => callback(Date.now()), 16) as unknown as number
globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id)

const fallback2dContext = {
  clearRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {}
}

const nativeGetContext = HTMLCanvasElement.prototype.getContext
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value(type: string, ...args: any[]) {
    if (type !== '2d') {
      return nativeGetContext ? nativeGetContext.call(this, type as any, ...args) : null
    }
    try {
      const context = nativeGetContext ? nativeGetContext.call(this, type as any, ...args) : null
      return context || (fallback2dContext as any)
    } catch {
      return fallback2dContext as any
    }
  }
})

afterEach(() => {
  cleanup()
})
