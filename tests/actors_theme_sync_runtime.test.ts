import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ActorProfile } from '../apps/frontend/src/store/actorsStore'
import { useActorsStore } from '../apps/frontend/src/store/actorsStore'

const ACCESS_TOKEN_STORAGE_KEY = 'veomuse-access-token'

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const originalFetch = globalThis.fetch
let shouldRestoreWindow = false
let shouldRestoreLocalStorage = false

const defaultActorsState = {
  actors: [] as ActorProfile[],
  isLoading: false,
  error: '',
  lastLoadedAt: null as number | null
}

const createStorage = () => {
  const cache = new Map<string, string>()
  return {
    getItem: (key: string) => cache.get(key) ?? null,
    setItem: (key: string, value: string) => {
      cache.set(key, value)
    },
    removeItem: (key: string) => {
      cache.delete(key)
    },
    clear: () => {
      cache.clear()
    }
  }
}

const createAccessToken = (expSecondsFromNow = 3600) => {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
    sub: 'actors-user'
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `mock.${encoded}.sig`
}

const successActorsResponse = (actors: ActorProfile[]) =>
  new Response(JSON.stringify({ success: true, actors }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })

const installBrowserWindow = () => {
  if (typeof (globalThis as any).window !== 'undefined') {
    shouldRestoreWindow = false
    return
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: globalThis
  })
  shouldRestoreWindow = true
}

const installBrowserStorage = () => {
  installBrowserWindow()
  const existing = (globalThis as any).localStorage
  if (existing && typeof existing.getItem === 'function') {
    existing.clear?.()
    shouldRestoreLocalStorage = false
    return existing
  }

  const storage = createStorage()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: storage
  })
  shouldRestoreLocalStorage = true
  return storage
}

describe('actorsStore 分支覆盖', () => {
  beforeEach(() => {
    installBrowserStorage()
    useActorsStore.setState(defaultActorsState)
  })

  afterEach(() => {
    useActorsStore.setState(defaultActorsState)
    globalThis.fetch = originalFetch
    if (shouldRestoreWindow) {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        delete (globalThis as any).window
      }
      shouldRestoreWindow = false
    }
    if (shouldRestoreLocalStorage) {
      if (originalLocalStorageDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor)
      } else {
        delete (globalThis as any).localStorage
      }
      shouldRestoreLocalStorage = false
    } else {
      ;(globalThis as any).localStorage?.clear?.()
    }
  })

  it('无 token 时应直接返回空数组并重置状态', async () => {
    globalThis.fetch = mock(async () => successActorsResponse([])) as any
    useActorsStore.setState({
      actors: [
        { id: 'old', name: '旧演员', refImage: 'old.png', createdAt: '2026-01-01T00:00:00.000Z' }
      ],
      isLoading: true,
      error: 'stale',
      lastLoadedAt: Date.now()
    })

    const rows = await useActorsStore.getState().fetchActors({ force: true })
    const state = useActorsStore.getState()

    expect(rows).toEqual([])
    expect(state.actors).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.error).toBe('')
    expect(state.lastLoadedAt).toBeNull()
    expect((globalThis.fetch as any).mock.calls.length).toBe(0)
  })

  it('成功拉取后应缓存，并在缓存有效期内复用结果', async () => {
    const token = createAccessToken()
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token)

    const actors: ActorProfile[] = [
      {
        id: 'actor-1',
        name: '演员一号',
        refImage: 'actor-1.png',
        createdAt: '2026-02-01T10:00:00.000Z'
      }
    ]

    globalThis.fetch = mock(async () => successActorsResponse(actors)) as any

    const store = useActorsStore.getState()
    const first = await store.fetchActors()
    const second = await useActorsStore.getState().fetchActors()
    const calls = (globalThis.fetch as any).mock.calls as Array<[string, RequestInit]>

    expect(first).toEqual(actors)
    expect(second).toEqual(actors)
    expect(calls.length).toBe(1)
    expect(calls[0]?.[0]).toContain('/api/ai/actors')
    expect(calls[0]?.[1]?.method).toBe('GET')
    expect(calls[0]?.[1]?.headers).toMatchObject({ Authorization: `Bearer ${token}` })
    expect(useActorsStore.getState().lastLoadedAt).not.toBeNull()
  })

  it('并发调用 fetchActors 时应请求去重（仅发起一次请求）', async () => {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, createAccessToken())

    const actors: ActorProfile[] = [
      {
        id: 'actor-2',
        name: '并发演员',
        refImage: 'actor-2.png',
        createdAt: '2026-02-02T10:00:00.000Z'
      }
    ]

    let resolveFetch: ((value: Response) => void) | null = null
    globalThis.fetch = mock(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        })
    ) as any

    const store = useActorsStore.getState()
    const p1 = store.fetchActors({ force: true })
    const p2 = useActorsStore.getState().fetchActors({ force: true })

    expect((globalThis.fetch as any).mock.calls.length).toBe(1)

    resolveFetch?.(successActorsResponse(actors))
    const [rows1, rows2] = await Promise.all([p1, p2])

    expect(rows1).toEqual(actors)
    expect(rows2).toEqual(actors)
  })

  it('prependActor 应支持插入新演员与按 id 更新已有演员', () => {
    useActorsStore.setState({
      actors: [
        { id: 'actor-a', name: '演员A', refImage: 'a.png', createdAt: '2026-01-01T00:00:00.000Z' }
      ],
      isLoading: false,
      error: '',
      lastLoadedAt: null
    })

    const state = useActorsStore.getState()
    state.prependActor({
      id: 'actor-b',
      name: '演员B',
      refImage: 'b.png',
      createdAt: '2026-01-02T00:00:00.000Z'
    })

    let actors = useActorsStore.getState().actors
    expect(actors.map((item) => item.id)).toEqual(['actor-b', 'actor-a'])

    state.prependActor({
      id: 'actor-b',
      name: '演员B-更新',
      refImage: 'b-new.png',
      createdAt: '2026-01-03T00:00:00.000Z'
    })

    actors = useActorsStore.getState().actors
    expect(actors.length).toBe(2)
    expect(actors[0]?.name).toBe('演员B-更新')
    expect(actors[0]?.refImage).toBe('b-new.png')
  })
})
