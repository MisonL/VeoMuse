import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import ToastContainer from '../apps/frontend/src/components/Editor/ToastContainer'
import { useToastStore } from '../apps/frontend/src/store/toastStore'

describe('ToastContainer 可访问性', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    cleanup()
    useToastStore.setState({ toasts: [] })
  })

  it('应为普通通知提供 status live region，并为错误通知提供 alert 语义', () => {
    useToastStore.setState({
      toasts: [
        { id: 'toast-success', message: '保存成功', type: 'success', actions: [] },
        { id: 'toast-error', message: '保存失败', type: 'error', actions: [] }
      ]
    })

    const view = render(<ToastContainer />)
    const container = view.container.querySelector('.toast-container')
    expect(container).toHaveAttribute('aria-live', 'polite')

    expect(view.getByRole('status')).toHaveTextContent('保存成功')
    expect(view.getByRole('alert')).toHaveTextContent('保存失败')
  })

  it('应支持通过键盘关闭通知', async () => {
    useToastStore.setState({
      toasts: [{ id: 'toast-keyboard', message: '可键盘关闭', type: 'info', actions: [] }]
    })

    const view = render(<ToastContainer />)
    const closeButton = view.getByRole('button', { name: '关闭通知：可键盘关闭' })
    fireEvent.keyDown(closeButton, { key: 'Enter' })

    await waitFor(() => {
      expect(useToastStore.getState().toasts).toHaveLength(0)
    })
  })
})
