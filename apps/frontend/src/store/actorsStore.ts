import { create } from 'zustand'
import { api, getErrorMessage } from '../utils/eden'

const ACTOR_CACHE_TTL_MS = 60 * 1000

export interface ActorProfile {
  id: string
  name: string
  refImage: string
  createdAt: string
}

interface ActorsState {
  actors: ActorProfile[]
  isLoading: boolean
  error: string
  lastLoadedAt: number | null
  fetchActors: (options?: { force?: boolean }) => Promise<ActorProfile[]>
  prependActor: (actor: ActorProfile) => void
}

let inFlightFetch: Promise<ActorProfile[]> | null = null

export const useActorsStore = create<ActorsState>((set, get) => ({
  actors: [],
  isLoading: false,
  error: '',
  lastLoadedAt: null,
  fetchActors: async (options) => {
    const force = options?.force === true
    const { actors, lastLoadedAt } = get()
    const isFresh = lastLoadedAt !== null && (Date.now() - lastLoadedAt) < ACTOR_CACHE_TTL_MS
    if (!force && actors.length > 0 && isFresh) return actors
    if (inFlightFetch) return inFlightFetch

    set({ isLoading: true, error: '' })
    inFlightFetch = (async () => {
      try {
        const { data, error } = await api.api.ai.actors.get()
        if (error) throw new Error(getErrorMessage(error))
        const rows = Array.isArray(data?.actors) ? (data.actors as ActorProfile[]) : []
        set({
          actors: rows,
          isLoading: false,
          error: '',
          lastLoadedAt: Date.now()
        })
        return rows
      } catch (error: any) {
        const message = error?.message || '加载演员库失败'
        set({ isLoading: false, error: message })
        throw new Error(message)
      } finally {
        inFlightFetch = null
      }
    })()

    return inFlightFetch
  },
  prependActor: (actor) => {
    set((state) => {
      const exists = state.actors.some(item => item.id === actor.id)
      if (exists) {
        return {
          actors: state.actors.map(item => item.id === actor.id ? actor : item),
          lastLoadedAt: Date.now()
        }
      }
      return {
        actors: [actor, ...state.actors],
        lastLoadedAt: Date.now()
      }
    })
  }
}))
