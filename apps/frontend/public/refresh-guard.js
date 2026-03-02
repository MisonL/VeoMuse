;(function refreshRuntimeGuard() {
  if (typeof window === 'undefined') return

  if (typeof window.$RefreshReg$ !== 'function') {
    window.$RefreshReg$ = function () {}
  }

  if (typeof window.$RefreshSig$ !== 'function') {
    window.$RefreshSig$ = function () {
      return function passthrough(type) {
        return type
      }
    }
  }
})()
