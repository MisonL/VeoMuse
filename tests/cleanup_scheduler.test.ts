import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { cleanupGeneratedFiles } from '../apps/backend/src/services/CleanupSchedulerService';

const tempDirs: string[] = [];

const createTempDir = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'veomuse-cleanup-'));
  tempDirs.push(dir);
  return dir;
};

describe('自动清理任务验证', () => {
  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (!dir) continue;
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('应清理过期文件并保留新文件', async () => {
    const dir = await createTempDir();
    const oldFile = path.join(dir, 'expired.mp4');
    const freshFile = path.join(dir, 'fresh.mp4');

    await fs.writeFile(oldFile, 'old-data');
    await fs.writeFile(freshFile, 'fresh-data');

    const now = Date.now();
    const oldTime = new Date(now - 2 * 86_400_000);
    await fs.utimes(oldFile, oldTime, oldTime);

    const result = await cleanupGeneratedFiles(dir, {
      now,
      maxAgeMs: 86_400_000,
      retries: 1
    });

    await expect(fs.stat(oldFile)).rejects.toThrow();
    const freshStat = await fs.stat(freshFile);
    expect(freshStat.isFile()).toBe(true);
    expect(result.removed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.success).toBe(true);
  });

  it('删除失败后应按重试策略再次尝试', async () => {
    const dir = await createTempDir();
    const oldFile = path.join(dir, 'retry.mp4');
    await fs.writeFile(oldFile, 'retry-data');

    const now = Date.now();
    const oldTime = new Date(now - 2 * 86_400_000);
    await fs.utimes(oldFile, oldTime, oldTime);

    let attempt = 0;
    const result = await cleanupGeneratedFiles(dir, {
      now,
      maxAgeMs: 86_400_000,
      retries: 2,
      removeFile: async (target) => {
        attempt += 1;
        if (attempt === 1) throw new Error('inject failure');
        await fs.unlink(target);
      }
    });

    await expect(fs.stat(oldFile)).rejects.toThrow();
    expect(result.removed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.retries).toBe(1);
    expect(attempt).toBe(2);
  });
});
