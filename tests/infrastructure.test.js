const fs = require('fs');
const path = require('path');

describe('Monorepo 基础设施验证', () => {
  const rootDir = path.resolve(__dirname, '..');

  test('根目录 package.json 应配置 workspaces', () => {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    
    expect(pkg.workspaces).toBeDefined();
    expect(Array.isArray(pkg.workspaces)).toBe(true);
    expect(pkg.workspaces).toContain('apps/*');
    expect(pkg.workspaces).toContain('packages/*');
  });

  test('根目录应存在 tsconfig.json', () => {
    const tsconfigPath = path.join(rootDir, 'tsconfig.json');
    expect(fs.existsSync(tsconfigPath)).toBe(true);
  });
});
