import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';

describe('Nginx 安全响应头验证', () => {
  const nginxPath = path.resolve(process.cwd(), 'config/nginx/nginx.conf');

  it('应配置 CSP 且使用最小权限策略', () => {
    const content = readFileSync(nginxPath, 'utf8');
    expect(content).toContain('Content-Security-Policy');
    expect(content).toContain("object-src 'none'");
    expect(content).toContain("frame-ancestors 'self'");
    expect(content).toContain("base-uri 'self'");
    expect(content).toContain('always;');
  });

  it('应包含关键安全头并使用 always', () => {
    const content = readFileSync(nginxPath, 'utf8');
    expect(content).toContain('X-Frame-Options "SAMEORIGIN" always');
    expect(content).toContain('X-Content-Type-Options "nosniff" always');
    expect(content).toContain('Referrer-Policy "strict-origin-when-cross-origin" always');
    expect(content).toContain('Permissions-Policy');
  });
});
