import { beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'
import { useToastStore } from '../apps/frontend/src/store/toastStore'

describe('前端降级恢复交互验证', () => {
  beforeEach(() => {
    useToastStore.setState((state) => ({ ...state, toasts: [] }))
  })

  it('ToastStore 应支持重试/降级动作按钮', () => {
    const { showToast } = useToastStore.getState()
    let retried = false
    let fallback = false
    showToast('服务调用失败', 'error', {
      sticky: true,
      actions: [
        {
          label: '重试',
          variant: 'primary',
          onClick: () => {
            retried = true
          }
        },
        {
          label: '降级继续编辑',
          variant: 'secondary',
          onClick: () => {
            fallback = true
          }
        }
      ]
    })

    const toasts = useToastStore.getState().toasts
    expect(toasts.length).toBe(1)
    expect(toasts[0]?.actions?.map((a) => a.label)).toEqual(['重试', '降级继续编辑'])
    toasts[0]?.actions?.[0]?.onClick?.()
    toasts[0]?.actions?.[1]?.onClick?.()
    expect(retried).toBe(true)
    expect(fallback).toBe(true)
  })

  it('App 应包含可恢复错误提示文案', () => {
    const appPath = path.resolve(process.cwd(), 'apps/frontend/src/App.tsx')
    const content = readFileSync(appPath, 'utf8')
    expect(content).toContain('重试')
    expect(content).toContain('降级继续编辑')
    expect(content).toContain('showRecoverableToast')
  })
})
