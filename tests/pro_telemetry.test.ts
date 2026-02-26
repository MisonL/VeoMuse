import { describe, it, expect } from 'bun:test';

describe('Telemetry Service Logic', () => {
  it('应能正确聚合 AI 调用指标', () => {
    const mockMetrics = [
      { service: 'AI-Director', durationMs: 1000, success: true },
      { service: 'AI-Director', durationMs: 1200, success: true },
      { service: 'AI-Director', durationMs: 0, success: false }
    ];

    const aggregate = (metrics: any[]) => {
      const stats: any = {};
      metrics.forEach(m => {
        if (!stats[m.service]) stats[m.service] = { count: 0, totalMs: 0, success: 0 };
        stats[m.service].count++;
        stats[m.service].totalMs += m.durationMs;
        if (m.success) stats[m.service].success++;
      });
      return stats;
    };

    const stats = aggregate(mockMetrics);
    expect(stats['AI-Director'].count).toBe(3);
    expect(stats['AI-Director'].success).toBe(2);
  });
});
