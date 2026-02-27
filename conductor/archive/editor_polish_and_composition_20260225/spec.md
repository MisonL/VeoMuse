# Specification: 编辑器深度打磨与合成引擎

## 目标
让 VeoMuse 的编辑器从“能看”变成“能用且好用”，实现专业剪辑软件的核心交互和导出功能。

## 关键技术栈
- **前端交互**: 利用 `@xzdarcy/react-timeline-editor` 的 `onActionDrop` 和 `onActionResize` 回调更新 Zustand Store。
- **播放控制**: `requestAnimationFrame` 用于平滑驱动播放指针。
- **后台合成**: 后端引入 `fluent-ffmpeg` 的复杂 filter_complex 处理多轨道合并与剪裁。

## 预期产出
- 用户可以在时间轴上随意拖动、修剪片段。
- 实现播放、暂停功能的控制条。
- 后端提供一个 `/api/video/compose` 接口，接收时间轴 JSON 数据并合成最终视频。
