import { describe, expect, it } from 'bun:test'
import { LocalDatabaseService } from '../apps/backend/src/services/LocalDatabaseService'

describe('数据库自动修复触发守卫', () => {
  it('仅在损坏迹象明确时触发自动修复', () => {
    expect(
      LocalDatabaseService.shouldAutoRepair({
        status: 'corrupted',
        messages: ['*** in database main ***']
      } as any)
    ).toBe(true)

    expect(
      LocalDatabaseService.shouldAutoRepair({
        status: 'error',
        messages: ['database disk image is malformed']
      } as any)
    ).toBe(true)

    expect(
      LocalDatabaseService.shouldAutoRepair({
        status: 'error',
        messages: ['database busy timeout']
      } as any)
    ).toBe(false)
  })
})
