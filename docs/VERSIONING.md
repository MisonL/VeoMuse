# VeoMuse 版本管理规范

## 1. 版本策略

VeoMuse 使用 **Semantic Versioning 2.0.0**：

- `MAJOR.MINOR.PATCH`
- 示例：`3.1.0`

规则：

- `MAJOR`：存在不兼容变更（API/部署/数据结构破坏性变化）
- `MINOR`：向后兼容的新功能（新增能力、增强链路）
- `PATCH`：向后兼容的问题修复（Bug/Security/文档对齐）

## 2. 分支与标签

- 主发布分支：`main`
- 正式版本标签：`v<MAJOR>.<MINOR>.<PATCH>`（例如 `v3.1.0`）
- 标签要求：
  - 必须是 annotated tag
  - 必须对应已推送到 `origin/main` 的提交

## 3. Changelog 维护

- 文件：`/CHANGELOG.md`
- 结构：
  - `Unreleased`
  - `x.y.z - YYYY-MM-DD`
  - 分类建议：`Added` / `Changed` / `Fixed` / `Security`
- 原则：
  - 记录用户可感知变更（功能、接口、部署、稳定性）
  - 每次 release 前必须将 `Unreleased` 归档到新版本条目

## 4. Release 流程（标准）

1. 完成发版门禁校验：
   - `bun run build`
   - `bun run test`
   - `bun run --cwd apps/backend lint`
   - `bun run --cwd apps/frontend lint`
   - `bun run security:scan`
2. 更新 `CHANGELOG.md`（补齐本次版本条目）
3. 创建并推送标签：
   - `git tag -a vX.Y.Z -m \"VeoMuse vX.Y.Z\"`
   - `git push origin main && git push origin vX.Y.Z`
4. 创建 GitHub Release（标题/说明与 Changelog 对齐）
5. 执行一键部署冒烟验证：
   - macOS/Linux：`bash scripts/one-click-deploy.sh --skip-build`
   - Windows：`powershell -File scripts/one-click-deploy.ps1 -SkipBuild`

## 5. 兼容性承诺

- 同一 `MAJOR` 内，公开 API 与部署能力保持向后兼容。
- 破坏性变更必须在：
  - `CHANGELOG.md`
  - GitHub Release
  - 升级说明文档
    中同步声明。

## 6. 责任边界

- 发布负责人：维护版本号、标签、Release 页面与变更说明一致性。
- 开发负责人：保证提交分类清晰，便于自动/半自动汇总 Changelog。
