const fs = require('fs');
const path = require('path');

describe('Eden Treaty 类型同步基础设施验证', () => {
  const sharedDir = path.resolve(__dirname, '../packages/shared');
  const frontendDir = path.resolve(__dirname, '../apps/frontend');

  test('应存在 packages/shared/package.json', () => {
    const pkgPath = path.join(sharedDir, 'package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);
  });

  test('前端 package.json 应包含 @elysiajs/eden 依赖', () => {
    const pkgPath = path.join(frontendDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        throw new Error('前端 package.json 不存在');
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.dependencies['@elysiajs/eden']).toBeDefined();
  });

  test('后端导出的类型应能通过 TypeScript 路径映射在共享包中被引用', () => {
    // 检查根目录 tsconfig.json 是否配置了路径映射
    const tsconfigPath = path.join(path.resolve(__dirname, '..'), 'tsconfig.json');
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    expect(tsconfig.compilerOptions.paths['@veomuse/*']).toBeDefined();
  });
});
