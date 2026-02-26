<h1 align="center">VeoMuse 旗舰版 (V3.1 Pro)</h1>

<p align="center">
  <strong>🎬 工业级 AI 视频创作工坊 | 极致 UI/UX · 多模型调度 · 全自动导演</strong>
</p>

<p align="center">
  <em>不仅是生成，更是创作。基于 Google Gemini 3.1 Pro 深度驱动。</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun">
  <img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19">
  <img src="https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 8">
  <img src="https://img.shields.io/badge/Gemini_3.1-FF6B6B?style=for-the-badge&logo=google&logoColor=white" alt="Gemini 3.1">
  <img src="https://img.shields.io/badge/Elysia-7C3AED?style=for-the-badge&logo=elysia&logoColor=white" alt="Elysia">
</p>

---

## 🌟 项目定义：次世代 AI 视频创作平台

**VeoMuse V3.1 Pro** 是一款专为 2026 年 AI 创作生态打造的旗舰级应用。它打破了单一模型生成的局限，通过**全球模型总线**集成了 Sora、Kling、Gemini 等顶级模型，并配合**全导演自动化引擎**，实现了从创意脚本到电影级成片的一键式闭环。

## ✨ 变态级功能矩阵

### 1. 🎬 工业级三栏编辑器
- **多维轨道系统**：支持视频、音频、文字、蒙版（Mask）四类轨道并行编排。
- **极致剪辑手感**：支持**磁吸对齐**、**1x-50x 动态缩放**、**播放指针处一键分割 (Split)**。
- **实时预览引擎**：基于 RAF 的高精度同步，支持**视频转场 (Fade)**、**文字动效**和**实时滤镜**预览。

### 2. 🤖 “全自动导演”引擎
- **一键导演成片**：输入长脚本，AI 自动完成：**拆解分镜 -> 设计 Prompt -> 匹配 BGM -> 生成配音 -> 自动排版**。
- **智能叙事修复**：AI 诊断画面不连贯性，并给出精准的“自愈式”修复方案。

### 3. 🧠 2026 全球模型总线
- **多模型集群**：同时集成 **Gemini 3.1 Pro**、**OpenAI Sora** 和 **快手可灵 Kling**。
- **对比实验室**：支持分屏对比视图，让不同模型的生成结果同场 PK。

### 4. 🔊 视听叙事大师
- **AI 智能配音 (TTS)**：一键转为人声并自动对齐。
- **AI 音色克隆**：支持音色迁移（旁白、少女、影评人等）。
- **智能节奏对齐**：自动分析 BGM 鼓点，实现“卡点剪辑”自动驾驶。

## 🛠️ 技术栈 (The 2026 Stack)

- **后端**：Bun + ElysiaJS + Eden Treaty (100% 类型安全同步)。
- **前端**：React 19 + Vite 8 (Rolldown 核心) + TypeScript。
- **样式**：Vanilla CSS + CSS Variables (玻璃拟态规范)。
- **媒体**：FFmpeg (物理渲染) + Web Audio API (节奏分析)。
- **持久化**：PostgreSQL + Redis。

## 🚀 快速启动 (Docker)

```bash
# 1. 配置 API 密钥
echo "GEMINI_API_KEYS=your_key_1,your_key_2" > .env

# 2. 一键拉起旗舰版生产环境
cd config/docker
docker-compose up -d --build
```

---
**VeoMuse - 流动的创意，无限的可能。**
