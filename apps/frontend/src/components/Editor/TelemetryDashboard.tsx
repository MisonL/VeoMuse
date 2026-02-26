import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/eden';
import './TelemetryDashboard.css';

const TelemetryDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fpsHistory = useRef<number[]>([]);

  // 1. 模拟 FPS 采样 (实际由播放器更新)
  useEffect(() => {
    let lastTime = performance.now();
    let frameCount = 0;
    
    const loop = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        fpsHistory.current.push(frameCount);
        if (fpsHistory.current.length > 50) fpsHistory.current.shift();
        frameCount = 0;
        lastTime = now;
        drawFps();
      }
      requestAnimationFrame(loop);
    };
    
    const drawFps = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#2997ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const step = canvas.width / 50;
      fpsHistory.current.forEach((fps, i) => {
        const x = i * step;
        const y = canvas.height - (fps / 60) * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    const raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 2. 拉取后端指标
  useEffect(() => {
    const fetchMetrics = async () => {
      const { data } = await api.api.admin.metrics.get();
      if (data) setMetrics(data);
    };
    fetchMetrics();
    const timer = setInterval(fetchMetrics, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="telemetry-dashboard">
      <section className="metrics-section">
        <label>播放 FPS 稳定性</label>
        <canvas ref={canvasRef} width={260} height={60} className="fps-chart" />
      </section>

      {metrics && (
        <section className="metrics-grid">
          <div className="metric-card">
            <span className="label">内存占用</span>
            <span className="value">{(metrics.system.memory.usage * 100).toFixed(1)}%</span>
          </div>
          <div className="metric-card">
            <span className="label">系统负载</span>
            <span className="value">{metrics.system.load[0].toFixed(2)}</span>
          </div>
        </section>
      )}

      <section className="api-metrics">
        <label>AI 服务运行状态</label>
        {metrics && Object.entries(metrics.api).map(([name, stats]: [string, any]) => (
          <div key={name} className="api-stat-row">
            <span className="api-name">{name}</span>
            <span className="api-success">{(stats.success / stats.count * 100).toFixed(0)}%</span>
            <span className="api-avg">{(stats.totalMs / stats.count).toFixed(0)}ms</span>
          </div>
        ))}
      </section>
    </div>
  );
};

export default TelemetryDashboard;
