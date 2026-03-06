import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render } from '@testing-library/react'
import DbOpsPanel from '../apps/frontend/src/components/Editor/telemetry-dashboard/DbOpsPanel'

const noop = () => {}

const createProps = (overrides: Record<string, unknown> = {}) =>
  ({
    adminTokenInput: 'admin-token',
    isDbBusy: false,
    dbRuntime: null,
    repairRange: '24h',
    repairStatusFilter: 'all',
    repairReasonInput: '',
    isRepairLoading: false,
    dbHealth: null,
    dbError: '',
    dbRepairs: [],
    repairTotal: 0,
    repairHasMore: false,
    onAdminTokenInputChange: noop,
    onSaveToken: noop,
    onFetchDbHealth: noop,
    onFetchDbRuntime: noop,
    onRepair: noop,
    onRepairRangeChange: noop,
    onRepairStatusFilterChange: noop,
    onRepairReasonInputChange: noop,
    onApplyReasonFilter: noop,
    onClearReasonFilter: noop,
    onLoadMoreRepairs: noop,
    ...overrides
  }) as any

describe('DbOpsPanel DOM 回归', () => {
  afterEach(() => {
    cleanup()
  })

  it('空态应渲染数据库自愈中心与默认修复历史提示', () => {
    const view = render(<DbOpsPanel {...createProps()} />)

    expect(view.getByText('数据库自愈中心')).toBeInTheDocument()
    expect(view.getByPlaceholderText('输入管理员令牌（x-admin-token）')).toBeInTheDocument()
    expect(view.getByText('暂无修复记录')).toBeInTheDocument()
    expect(view.getByText('已显示 0 / 0 条')).toBeInTheDocument()
    expect(view.getByText('已到末尾')).toBeInTheDocument()
  })

  it('应触发数据库动作与修复历史筛选回调', () => {
    const onSaveToken = mock(() => {})
    const onFetchDbHealth = mock(() => {})
    const onFetchDbRuntime = mock(() => {})
    const onRepair = mock((_force: boolean) => {})
    const onRepairRangeChange = mock((_value: string) => {})
    const onRepairStatusFilterChange = mock((_value: string) => {})
    const onRepairReasonInputChange = mock((_value: string) => {})
    const onApplyReasonFilter = mock(() => {})
    const onClearReasonFilter = mock(() => {})
    const onLoadMoreRepairs = mock(() => {})

    const view = render(
      <DbOpsPanel
        {...createProps({
          dbRuntime: {
            autoRepairEnabled: true,
            runtimeHealthcheckEnabled: true,
            runtimeHealthcheckIntervalMs: 5000,
            dbPath: '/tmp/test.sqlite'
          },
          dbHealth: {
            status: 'ok',
            mode: 'quick',
            checkedAt: '2026-03-06T10:00:00.000Z',
            messages: ['all good']
          },
          dbRepairs: [
            {
              status: 'repaired',
              reason: 'sqlite lock',
              timestamp: '2026-03-06T10:00:00.000Z',
              salvage: { copiedRows: 3 },
              actions: [{ type: 'reindex' }]
            }
          ],
          repairTotal: 3,
          repairHasMore: true,
          onSaveToken,
          onFetchDbHealth,
          onFetchDbRuntime,
          onRepair,
          onRepairRangeChange,
          onRepairStatusFilterChange,
          onRepairReasonInputChange,
          onApplyReasonFilter,
          onClearReasonFilter,
          onLoadMoreRepairs
        })}
      />
    )

    fireEvent.submit(view.getByRole('button', { name: '保存令牌' }).closest('form')!)
    fireEvent.click(view.getByRole('button', { name: '健康检查' }))
    fireEvent.click(view.getByRole('button', { name: '运行配置' }))
    fireEvent.click(view.getByRole('button', { name: '温和修复' }))
    fireEvent.click(view.getByRole('button', { name: '强制修复' }))
    fireEvent.change(view.getByRole('textbox', { name: '修复原因关键词筛选' }), {
      target: { value: 'sqlite' }
    })
    fireEvent.change(view.getByLabelText('历史范围'), { target: { value: '7d' } })
    fireEvent.change(view.getByLabelText('状态'), { target: { value: 'failed' } })
    fireEvent.click(view.getByRole('button', { name: '应用筛选' }))
    fireEvent.click(view.getByRole('button', { name: '清空' }))
    fireEvent.click(view.getByRole('button', { name: '加载更多' }))

    expect(onSaveToken).toHaveBeenCalledTimes(1)
    expect(onFetchDbHealth).toHaveBeenCalledTimes(1)
    expect(onFetchDbRuntime).toHaveBeenCalledTimes(1)
    expect(onRepair).toHaveBeenCalledTimes(2)
    expect(onRepair.mock.calls[0]?.[0]).toBe(false)
    expect(onRepair.mock.calls[1]?.[0]).toBe(true)
    expect(onRepairRangeChange).toHaveBeenCalledWith('7d')
    expect(onRepairStatusFilterChange).toHaveBeenCalledWith('failed')
    expect(onApplyReasonFilter).toHaveBeenCalledTimes(1)
    expect(onClearReasonFilter).toHaveBeenCalledTimes(1)
    expect(onLoadMoreRepairs).toHaveBeenCalledTimes(1)
    expect(view.getByText('数据库路径：/tmp/test.sqlite')).toBeInTheDocument()
    expect(view.getByText('sqlite lock')).toBeInTheDocument()
    expect(view.getByText('已显示 1 / 3 条')).toBeInTheDocument()
  })
})
