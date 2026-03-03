import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Timeline } from '@xzdarcy/react-timeline-editor'
import type { TimelineAction, TimelineRow } from '@xzdarcy/timeline-engine'
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css'
import { useMeasure } from 'react-use'
import type { StoreApi } from 'zustand'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { TemporalState } from 'zundo'
import { useEditorStore } from '../../store/editorStore'
import { calculateSnap } from '../../utils/snapService'
import { syncController } from '../../utils/SyncController'
import { useShortcuts } from '../../hooks/useShortcuts'
import {
  filterTimelineActionsByWindow,
  getTimelineVirtualWindow,
  shouldEnableTimelineVirtualization
} from '../../utils/timelineVirtualization'
import './VideoEditor.css'

interface VideoEditorProps {
  activeTool?: 'select' | 'cut' | 'hand'
}

type EditorStateSnapshot = ReturnType<typeof useEditorStore.getState>
type EditorTemporalStore = StoreApi<TemporalState<EditorStateSnapshot>>
const editorTemporalStore = (useEditorStore as unknown as { temporal: EditorTemporalStore })
  .temporal

const VideoEditor: React.FC<VideoEditorProps> = ({ activeTool = 'select' }) => {
  const {
    tracks,
    currentTime,
    setCurrentTime,
    duration,
    isPlaying,
    togglePlay,
    setSelectedClipId,
    splitClip,
    zoomLevel,
    setTracks
  } = useEditorStore(
    useShallow((state) => ({
      tracks: state.tracks,
      currentTime: state.currentTime,
      setCurrentTime: state.setCurrentTime,
      duration: state.duration,
      isPlaying: state.isPlaying,
      togglePlay: state.togglePlay,
      setSelectedClipId: state.setSelectedClipId,
      splitClip: state.splitClip,
      zoomLevel: state.zoomLevel,
      setTracks: state.setTracks
    }))
  )

  const { undo, redo } = useStore(
    editorTemporalStore,
    useShallow((state) => ({
      undo: state.undo,
      redo: state.redo
    }))
  )
  const [containerRef, { width }] = useMeasure<HTMLDivElement>()
  const [isReady, setIsReady] = useState(false)
  const [snapLine, setSnapLine] = useState<{ visible: boolean; time: number }>({
    visible: false,
    time: 0
  })

  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const snapResetTimerRef = useRef<number | null>(null)

  const shortcutMap = useMemo(
    () => ({
      Space: togglePlay,
      'Cmd+B': () => {
        tracks.forEach((t) => {
          const clip = t.clips.find((c) => currentTime >= c.start && currentTime <= c.end)
          if (clip) splitClip(t.id, clip.id, currentTime)
        })
      },
      'Cmd+Z': undo,
      'Cmd+Shift+Z': redo
    }),
    [togglePlay, tracks, currentTime, splitClip, undo, redo]
  )

  useShortcuts(shortcutMap)

  useEffect(() => {
    if (width > 0) setIsReady(true)
  }, [width])

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now()
      const loop = (time: number) => {
        const delta = (time - lastTimeRef.current) / 1000
        lastTimeRef.current = time
        const nextTime = useEditorStore.getState().currentTime + delta
        setCurrentTime(nextTime)
        syncController.sync(nextTime, true, tracks)
        if (nextTime >= duration) {
          togglePlay()
          setCurrentTime(0)
        } else {
          rafRef.current = requestAnimationFrame(loop)
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      syncController.sync(useEditorStore.getState().currentTime, false, tracks)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, duration, tracks, setCurrentTime, togglePlay])

  useEffect(
    () => () => {
      if (snapResetTimerRef.current) {
        window.clearTimeout(snapResetTimerRef.current)
        snapResetTimerRef.current = null
      }
    },
    []
  )

  const timelineData: TimelineRow[] = tracks.map((track) => ({
    id: track.id,
    actions: track.clips.map((clip) => ({
      id: clip.id,
      start: clip.start,
      end: clip.end,
      effectId: 'video'
    }))
  }))

  const totalClipCount = useMemo(
    () => tracks.reduce((acc, track) => acc + track.clips.length, 0),
    [tracks]
  )

  useEffect(() => {
    const budget = totalClipCount > 180 ? 80 : totalClipCount > 100 ? 120 : 180
    syncController.setPerformanceBudget(budget)
  }, [totalClipCount])

  const enableVirtualization = shouldEnableTimelineVirtualization(totalClipCount, duration)
  const { windowStart, windowEnd } = getTimelineVirtualWindow(currentTime, duration)

  const renderedTimelineData = useMemo(() => {
    if (!enableVirtualization) return timelineData
    return timelineData.map((track) => ({
      ...track,
      actions: filterTimelineActionsByWindow(track.actions, windowStart, windowEnd)
    }))
  }, [enableVirtualization, timelineData, windowStart, windowEnd])

  const handleTimelineTimeChange = (time: number) => {
    setCurrentTime(time)
    syncController.sync(time, false, tracks)
  }

  return (
    <div className="video-editor-container pro-nle-container">
      {snapLine.visible && (
        <div className="snap-guide-line" style={{ left: `${(snapLine.time / duration) * 100}%` }} />
      )}

      <div
        className="timeline-wrapper"
        ref={containerRef}
        style={{ cursor: activeTool === 'cut' ? 'crosshair' : 'default' }}
      >
        {isReady && (
          <Timeline
            key={`timeline-${width}`}
            onChange={(data: TimelineRow[]) => {
              const nextTracks = tracks.map((track) => {
                const incomingTrack = data.find((t) => t.id === track.id)
                if (!incomingTrack) return track

                const actionMap = new Map<string, TimelineAction>(
                  incomingTrack.actions.map((action) => [action.id, action])
                )
                const nextClips = track.clips.map((clip) => {
                  const action = actionMap.get(clip.id)
                  if (!action) return clip

                  const snap = calculateSnap(action.start, action.id)
                  if (snap.snapped) {
                    setSnapLine({ visible: true, time: snap.time })
                    if (snapResetTimerRef.current) {
                      window.clearTimeout(snapResetTimerRef.current)
                    }
                    snapResetTimerRef.current = window.setTimeout(() => {
                      setSnapLine({ visible: false, time: 0 })
                      snapResetTimerRef.current = null
                    }, 500)
                  }
                  const finalStart = snap.snapped ? snap.time : action.start
                  const finalEnd = finalStart + (action.end - action.start)

                  return {
                    ...clip,
                    start: finalStart,
                    end: finalEnd
                  }
                })

                return {
                  ...track,
                  clips: nextClips
                }
              })

              setTracks(nextTracks)
              syncController.sync(useEditorStore.getState().currentTime, false, nextTracks)
            }}
            onCursorDrag={handleTimelineTimeChange}
            onClickTimeArea={(time) => {
              handleTimelineTimeChange(time)
              return true
            }}
            onClickActionOnly={(_event, { action, row }) => {
              if (activeTool === 'cut') {
                splitClip(row.id, action.id, currentTime)
              } else {
                setSelectedClipId(action.id)
              }
            }}
            editorData={renderedTimelineData}
            effects={{
              video: { id: 'video', name: '片段' }
            }}
            autoScroll={true}
            scale={zoomLevel}
          />
        )}
      </div>
    </div>
  )
}

export default VideoEditor
