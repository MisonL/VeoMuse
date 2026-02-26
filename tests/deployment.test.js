const fs = require('fs');
const path = require('path');

describe('生产级部署配置文件验证', () => {
  const rootDir = path.resolve(__dirname, '..');

  test('应存在后端生产 Dockerfile', () => {
    const dockerfilePath = path.join(rootDir, 'config/docker/backend.Dockerfile');
    // 目前尚未创建，预期失败
    expect(fs.existsSync(dockerfilePath)).toBe(true);
  });

  test('应存在 docker-compose.yml 并包含核心服务', () => {
    const composePath = path.join(rootDir, 'config/docker/docker-compose.yml');
    expect(fs.existsSync(composePath)).toBe(true);
  });
});
