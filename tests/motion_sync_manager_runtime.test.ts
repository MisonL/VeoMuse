import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { MotionSyncManager } from '../apps/frontend/src/utils/motionSync'

describe('MotionSyncManager 分支覆盖', () => {
  let setIntervalSpy: ReturnType<typeof spyOn> | null = null
  let clearIntervalSpy: ReturnType<typeof spyOn> | null = null

  beforeEach(() => {
    MotionSyncManager.stopCapture()
  })

  afterEach(() => {
    MotionSyncManager.stopCapture()
    setIntervalSpy?.mockRestore()
    clearIntervalSpy?.mockRestore()
    setIntervalSpy = null
    clearIntervalSpy = null
  })

  it('startCapture 应激活采集，重复 start 不应重复启动定时器', async () => {
    let intervalTick: (() => void) | null = null

    setIntervalSpy = spyOn(globalThis, 'setInterval').mockImplementation(((
      callback: TimerHandler
    ) => {
      intervalTick = callback as () => void
      return 101 as unknown as ReturnType<typeof setInterval>
    }) as any)
    clearIntervalSpy = spyOn(globalThis, 'clearInterval').mockImplementation((() => {}) as any)

    const onData = mock((_data: unknown) => {})

    await MotionSyncManager.startCapture(onData)
    expect(MotionSyncManager.getStatus().isActive).toBe(true)
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
    expect(setIntervalSpy.mock.calls[0]?.[1]).toBe(16)

    intervalTick?.()
    expect(onData).toHaveBeenCalledTimes(1)

    await MotionSyncManager.startCapture(onData)
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
  })

  it('stopCapture 应停止采集并将状态回落为非激活', async () => {
    setIntervalSpy = spyOn(globalThis, 'setInterval').mockImplementation(
      (() => 202 as unknown as ReturnType<typeof setInterval>) as any
    )
    clearIntervalSpy = spyOn(globalThis, 'clearInterval').mockImplementation((() => {}) as any)

    await MotionSyncManager.startCapture(mock(() => {}))
    expect(MotionSyncManager.getStatus().isActive).toBe(true)

    MotionSyncManager.stopCapture()

    expect(MotionSyncManager.getStatus().isActive).toBe(false)
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
    expect(clearIntervalSpy).toHaveBeenCalledWith(202)
  })
})
