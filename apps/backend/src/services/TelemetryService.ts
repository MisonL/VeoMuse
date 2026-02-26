// apps/backend/src/services/TelemetryService.ts
import os from 'os';

export interface ApiMetric {
  service: string;
  durationMs: number;
  success: boolean;
  timestamp: string;
}

export class TelemetryService {
  private static instance: TelemetryService;
  private apiMetrics: ApiMetric[] = [];
  private readonly MAX_HISTORY = 1000;

  static getInstance(): TelemetryService {
    if (!TelemetryService.instance) TelemetryService.instance = new TelemetryService();
    return TelemetryService.instance;
  }

  recordApiCall(metric: ApiMetric) {
    this.apiMetrics.push(metric);
    if (this.apiMetrics.length > this.MAX_HISTORY) this.apiMetrics.shift();
  }

  getSummary() {
    const apiStats: any = {};
    this.apiMetrics.forEach(m => {
      if (!apiStats[m.service]) apiStats[m.service] = { count: 0, totalMs: 0, success: 0 };
      apiStats[m.service].count++;
      apiStats[m.service].totalMs += m.durationMs;
      if (m.success) apiStats[m.service].success++;
    });

    return {
      api: apiStats,
      system: {
        memory: {
          free: os.freemem(),
          total: os.totalmem(),
          usage: 1 - os.freemem() / os.totalmem()
        },
        load: os.loadavg(),
        uptime: os.uptime()
      },
      timestamp: new Date().toISOString()
    };
  }
}
