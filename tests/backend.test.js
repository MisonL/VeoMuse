const fs = require('fs');
const path = require('path');

describe('Elysia 后端基础设施验证', () => {
  const backendDir = path.resolve(__dirname, '../apps/backend');

  test('应存在 apps/backend/package.json', () => {
    const pkgPath = path.join(backendDir, 'package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);
  });

  test('package.json 应包含 elysia 依赖', () => {
    const pkgPath = path.join(backendDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        throw new Error('package.json 不存在');
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.dependencies.elysia).toBeDefined();
  });

  test('应存在基础服务器入口文件', () => {
    const indexPath = path.join(backendDir, 'src/index.ts');
    expect(fs.existsSync(indexPath)).toBe(true);
  });
});
