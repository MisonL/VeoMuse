# VeoMuse Superpowers 工作流入口

本目录用于沉淀 VeoMuse 仓库的规范化执行过程。

## 固定顺序

1. `using-superpowers`
2. `brainstorming`
3. `writing-plans`
4. `test-driven-development`
5. `verification-before-completion`

## 目录约定

- `docs/superpowers/specs/`：设计规格
- `docs/superpowers/plans/`：实施计划与实施记录

## 仓库要求

- 进入实现前必须先有 spec 和 plan。
- 进入代码或文档修改前必须先有 failing test。
- 完成前必须做 verification，不以“看起来没问题”代替验证。
- 任务完成后，原 plan 文件应回写为 implementation record，保留验证证据和实际落地范围。

## 当前实例

- 清理与迁移设计：`docs/superpowers/specs/2026-04-27-repo-cleanup-and-superpowers-migration-design.md`
- 清理与迁移实施记录：`docs/superpowers/plans/2026-04-27-repo-cleanup-and-superpowers-migration-plan.md`
- UI Studio 实施记录：`docs/superpowers/plans/2026-04-27-ui-studio-refinement-plan.md`
- Nebula Flow 实施记录：`docs/superpowers/plans/2026-05-17-nebula-flow-webui-plan.md`
