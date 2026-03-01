import { describe, expect, it } from 'bun:test';
import { app } from '../apps/backend/src/index';
import { createAuthHeaders, createTestSession } from './helpers/auth';

describe('动捕映射链路验证', () => {
  it('应将动捕数据同步到演员驱动并返回映射摘要', async () => {
    const session = await createTestSession('motion-sync')
    const response = await app.handle(
      new Request('http://localhost/api/ai/actors/motion-sync', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          actorId: 'hero-man',
          motionData: {
            pose: [
              { x: 0.4, y: 0.5, z: 0.1 },
              { x: 0.6, y: 0.5, z: 0.1 }
            ],
            face: { expression: 'smile', intensity: 0.9 },
            timestamp: Date.now()
          }
        })
      })
    );

    const data = await response.json() as any;
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.actorId).toBe('hero-man');
    expect(data.mappedJoints).toBe(2);
    expect(data.expression).toBe('smile');
  });
});
