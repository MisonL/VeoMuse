# Specification: 初始化旗舰级 Monorepo 架构

## 目标
建立一个高效、类型安全的开发环境，作为 VeoMuse 旗舰版的基础。

## 关键技术要求
- **运行时**: Bun 1.1+
- **Monorepo**: Bun Workspaces
- **后端**: ElysiaJS + Eden Treaty
- **前端**: React 18+ (Vite)
- **语言**: TypeScript (全站统一)

## 预期产出
- `package.json` 配置 Workspaces。
- `apps/backend`: 基础 Elysia 服务器。
- `apps/frontend`: 基础 React (Vite) 应用。
- `packages/shared`: 包含第一个跨端共享类型。
- 环境通通性验证: 前端通过 Eden Treaty 成功调用后端接口。
