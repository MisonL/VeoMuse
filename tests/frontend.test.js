const fs = require('fs');
const path = require('path');

describe('React 前端基础设施验证', () => {
  const frontendDir = path.resolve(__dirname, '../apps/frontend');

  test('应存在 apps/frontend/package.json', () => {
    const pkgPath = path.join(frontendDir, 'package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);
  });

  test('package.json 应包含 react 和 vite 依赖', () => {
    const pkgPath = path.join(frontendDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        throw new Error('package.json 不存在');
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.dependencies.react).toBeDefined();
    expect(pkg.devDependencies.vite).toBeDefined();
  });

  test('应存在主入口文件 index.html', () => {
    const indexPath = path.join(frontendDir, 'index.html');
    expect(fs.existsSync(indexPath)).toBe(true);
  });
});
