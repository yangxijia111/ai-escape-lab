# AI ESCAPE LAB

> **Can an AI escape the room?** — An escape-room style Agent Benchmark for LLMs.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-38bdf8.svg)](https://tailwindcss.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

[中文](#中文) | [English](#english)

---

## 中文

### 项目简介

**AI ESCAPE LAB（AI 密室逃脱实验室）** 是一个面向大语言模型（LLM）的**密室逃脱式 Agent Benchmark（智能体基准测试）**。

它不是聊天机器人 Demo：被测智能体面对的是一个带有**隐藏状态**的 Environment（环境），只能通过一组固定的**结构化动作**与其交互，在**有限的动作预算**和**部分可观测（partial observation）**的条件下尝试逃出房间。

该基准用于评估以下能力：

信息收集 · 多步推理 · 规划 · 状态理解 · 工具/动作使用 · 假设验证 · 自我纠错 · 长程任务执行 · 抗干扰 · 规则遵守

当前主要被测模型：**Qwen**（通过 DashScope 的 OpenAI 兼容接口调用）。

> 核心特点：**无需 API Key 也能完整运行**。未配置密钥时，AI Mode 会自动降级为 `MockAgentProvider`（Demo Mode），用脚本化的真实感轨迹（观察 → 假设 → 失败 → 反思 → 纠错 → 逃脱）演示完整产品流程。

### 功能特性

- **5 个密室房间**，覆盖由易到难的不同能力维度（教程 / 简单 / 中等 / 困难）。
- **双模式**：`AI Mode`（观看智能体自动逃脱）与 `Human Mode`（自己玩同一个房间，使用同一套评分引擎）。
- **实时直播式控制台**：逐步广播 `THOUGHT / ACTION / OBSERVATION`，支持暂停 / 继续 / 单步 / 重置，自动播放按 500–1500 ms 节奏推进。
- **逐步回放**：`/replay/[runId]` 支持 Prev / Next / Auto Play，查看每一步的观测快照、假设与状态变更。
- **Benchmark 仪表盘**：总分、逃脱率、无效动作率、重复动作率、自我纠错率、信息效率、格式可靠性；内置轻量 SVG 雷达图 + 分数条 + 分房间结果表。
- **0–100 六维评分引擎**：Success 40 / Action Efficiency 20 / Information Efficiency 15 / Reasoning Quality 10 / Self-Correction 10 / Rule Compliance 5。
- **报告导出**：一键导出 `benchmark-report.json` 与 `benchmark-report.md`（含模型、总体结果、规则化优劣势分析、失败用例与完整轨迹）。
- **无密钥降级**：没有 `QWEN_API_KEY` 时自动使用 Demo Mode，产品可完全离线演示。
- **密钥安全**：API Key 仅由服务端读取，浏览器只调用 `/api/agent`，密钥永不进入客户端产物。
- **引擎与框架解耦**：密室为**纯声明式数据**（`RoomCase`），Puzzle Engine 不依赖 React，便于扩展新房间。
- **本地验证脚本**：`scripts/smoke.ts` 校验每个房间的地面真值解可逃脱；`scripts/pipeline.ts` 跑通完整的 Mock 智能体循环 → 指标 → 评分 → 报告导出。

### 演示 / 截图

本项目当前的房间画面由 **CSS / SVG 实时绘制，仓库内不包含任何图片资源**（`src/components/RoomView` 已注明 "No image assets"），因此仓库暂时**没有可用的截图文件**；`README` 中的截图区留待后续补充（见 [更新计划](#更新计划--roadmap)）。

可直接本地启动后按以下路径体验：

| 路径 | 说明 |
|---|---|
| `/` | 实验室风格首页：选择房间、选择模式 |
| `/room/[id]?mode=ai` | 观看智能体逃脱（实时 THOUGHT / ACTION / OBSERVATION 广播） |
| `/room/[id]?mode=human` | 自己挑战同一房间，使用相同评分引擎 |
| `/benchmark` | 评测仪表盘：总分、逃脱率、各类比率、雷达图、分房间表格、JSON / Markdown 导出 |
| `/replay/[runId]` | 逐步回放：Prev / Next / Auto Play、观测快照、假设、状态变更 |

房间 id：`clockmaker`、`librarian`、`liar`、`red-herring`、`loop`。

### 环境要求

| 项目 | 要求 |
|---|---|
| Node.js | `>= 18.18`（Next.js 15 的最低要求）；**推荐 `>= 22.6`**，以便用 `node` 直接运行 `scripts/*.ts` 验证脚本（原生 TypeScript 类型剥离）。当前开发环境为 Node 24 |
| npm | `>= 9`（当前开发环境为 npm 11） |
| 浏览器 | 任意现代浏览器（需要 `localStorage` 存储评测记录） |
| Qwen API Key | **可选**。未配置时自动进入 Demo Mode |

### 安装与配置

```bash
# 1. 安装依赖
npm install

# 2. （可选）配置 Qwen 密钥 —— 不配置也能运行 Demo Mode
#    macOS / Linux
cp .env.example .env.local
#    Windows (PowerShell)
copy .env.example .env.local
```

`.env.local` 内容：

```env
QWEN_API_KEY=sk-xxxx
QWEN_MODEL=qwen-plus
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

说明：

- 密钥**只在服务端读取**（[route.ts](./src/app/api/agent/route.ts) 中的 `QwenProvider`，走 OpenAI 兼容的 chat completions 接口），不会进入浏览器产物。
- 前端通过 `GET /api/config` 得知服务端是否存在密钥（只返回布尔值，不暴露密钥内容）：有密钥则 AI Mode 调用真实 Qwen，无密钥则运行 Demo Mode。
- 模型输出会被校验是否符合动作 JSON Schema；格式错误最多自动重试 2 次，并计入 `format_error_count`（格式可靠性指标）。

### 使用方法

```bash
# 开发模式
npm run dev          # http://localhost:3000

# 生产构建与启动
npm run build
npm start

# 代码检查
npm run lint
```

**玩法**：

1. 打开 `/`，选择一个房间（例如 `clockmaker`）。
2. 点击 **AI Mode** 观看智能体逃亡（可暂停 / 单步 / 重置），或点击 **Human** 自己挑战。
3. 每次运行结束后记录会写入浏览器 `localStorage`（键名 `ai-escape-lab:runs`，保留最近 100 条）。
4. 打开 `/benchmark` 查看聚合结果并导出报告；在表格或结果中进入 `/replay/[runId]` 逐步回放。

**智能体交互模型**：

Environment（[environment.ts](./src/engine/environment.ts)）持有智能体无法直接读取的地面真值。每一轮智能体收到一个 `Observation`（可见对象、状态、背包、近期事件、剩余动作数），并必须仅回复**一个**结构化动作：

```json
{ "action": "input", "target": "safe", "value": "1015", "reason": "The stopped time may encode the combination." }
```

允许的动作：`inspect · interact · move · use_item · input · take · combine · submit_answer`。

非法动作（未观测到的目标、无效组合等）会被显式拒绝并计入指标。智能体**不能自行宣告逃脱** —— 逃脱只能由环境触发（穿过已打开的门，或被机关带出）。

循环：**Observation → Reasoning → Action → Validation → State update → new Observation**，直到 `escaped`、动作预算耗尽，或连续 5 次非法动作。

### 五个密室

| # | 房间 | 考察能力 |
|---|---|---|
| 01 | **The Clockmaker**（教程） | 基础观察 + 线索组合（时钟 10:15 → 保险箱密码） |
| 02 | **The Librarian** | 跨对象信息组合（书架顺序 × 行星序号；答案不存在于任何单一对象中） |
| 03 | **The Liar** | 矛盾推理（恰好一张纸条为真；开错箱子会永久封闭 —— 惩罚暴力枚举） |
| 04 | **The Red Herring** | 抗干扰（16 个对象，只有 4 个有意义；存在响亮的假线索） |
| 05 | **The Loop** | 自我纠错（符号看起来像密码，实际是雕像映射；第一假设被设计为必然失败） |

### 评分与指标

**Escape Score（0–100）**：

| 维度 | 权重 |
|---|---|
| Success（是否逃脱） | 40 |
| Action Efficiency（相对最优步数） | 20 |
| Information Efficiency（关键对象占比） | 15 |
| Reasoning Quality（假设陈述质量，含重复/严重失误扣分） | 10 |
| Self-Correction（从失败中恢复） | 10 |
| Rule Compliance（合法动作、格式错误惩罚） | 5 |

每一步会被分类为 `useful / irrelevant / invalid / repeated`，并检测 critical mistakes 与自我纠错（见 [scoring.ts](./src/engine/scoring.ts)）。

**Benchmark 汇总指标**：`escape_rate`、`average_score`、`average_actions`、`invalid_action_rate`、`repeated_action_rate`、`self_correction_rate`、`information_efficiency`、`format_reliability`。

### 项目目录结构

```text
.
├── src/
│   ├── app/                      Next.js App Router
│   │   ├── page.tsx              首页（房间选择 / 模式选择）
│   │   ├── layout.tsx            全局布局与元信息
│   │   ├── globals.css           终端实验室主题样式（Tailwind v4）
│   │   ├── room/[id]/page.tsx    AI Mode / Human Mode 实验台
│   │   ├── benchmark/page.tsx    评测仪表盘（雷达图 / 分数条 / 导出）
│   │   ├── replay/[runId]/       运行回放
│   │   └── api/
│   │       ├── agent/route.ts    POST /api/agent（服务端调用 Qwen）
│   │       └── config/route.ts   GET  /api/config（是否已配置密钥）
│   ├── engine/                   框架无关的纯逻辑
│   │   ├── types.ts              动作 / 房间 / 观测 / 轨迹 / 报告类型
│   │   ├── environment.ts        环境执行器：动作校验、规则求值、状态推进
│   │   ├── scoring.ts            步级分类、指标计算、0–100 评分
│   │   └── replay.ts             回放与动作格式化工具
│   ├── agents/                   智能体接入层
│   │   ├── provider.ts           AIProvider 接口（AgentContext / AgentDecision）
│   │   ├── prompts.ts            系统提示词与观测提示词
│   │   ├── qwen.ts               QwenProvider（服务端，OpenAI 兼容）+ JSON 解析
│   │   ├── mock.ts               MockAgentProvider（Demo Mode 脚本轨迹）
│   │   └── remote.ts             RemoteQwenProvider（浏览器侧，转发到 /api/agent）
│   ├── data/rooms/               声明式房间数据（room01..room05 + index.ts）
│   ├── components/               RoomView · AgentConsole · Timeline
│   └── lib/                      useAgentLoop.ts · storage.ts · exportBenchmark.ts
├── scripts/
│   ├── smoke.ts                  引擎冒烟测试：地面真值解可逃脱 + 非法动作路径
│   └── pipeline.ts               完整 Mock 循环 → 指标 → 评分 → JSON/MD 报告
├── .env.example                  环境变量示例（不含真实密钥）
├── next.config.ts · tsconfig.json · eslint.config.mjs · postcss.config.mjs
└── package.json
```

### 核心功能说明

**1. 环境引擎（Puzzle Engine）**

房间是纯数据（`RoomCase`：对象、声明式规则与条件/效果、门、关键对象、地面真值解）。`executeAction` 负责校验动作、匹配规则、产出状态变更与事件；它不依赖 React，可被脚本直接调用（`scripts/smoke.ts` 即如此验证）。规则支持条件（`objectState` / `hasItem` / `consumeItem` / `puzzleSolved` / `value` / `valueNot`）与效果（`setState` / `reveal` / `addItem` / `removeItem` / `setMessage` / `unlockPuzzle` / `openDoor` / `escape`），并可为规则标记 `critical`（严重失误）、`once`（只触发一次）。

**2. 智能体接入层（Provider 抽象）**

`AIProvider` 接口只有 `generateAction(context)` 一个方法，因此接入新模型只需实现该接口。目前提供：服务端 `QwenProvider`、浏览器侧 `RemoteQwenProvider`（转发到 `/api/agent`）、以及 Demo 用 `MockAgentProvider`。格式解析（`parseAction`）可容忍代码围栏与多余文本，并在失败时最多重试 2 次。

**3. 评分与指标引擎**

`classifyStep` 做步级分类，`computeMetrics` 聚合运行指标，`computeScore` 输出六维评分；`countSelfCorrections` 通过「先失败、后以不同取值成功」的模式识别自我纠错。

**4. 评测数据与报告**

每次完成的运行（AI 或 Human）都写入浏览器 `localStorage`（键名 `ai-escape-lab:runs`，保留最近 100 条）。`/benchmark` 负责聚合，并可导出：

- **Export JSON** → `benchmark-report.json`（汇总 + 完整执行轨迹）
- **Export Markdown** → `benchmark-report.md`（模型、总体结果、规则化优劣势、失败用例、完整轨迹）

> 注意：评测数据保存在**浏览器本地**，不涉及服务端存储，因此换浏览器/清除数据后记录不会保留。

### 构建、运行与部署

```bash
npm run lint         # ESLint 静态检查
npm run build        # 生产构建
npm start            # 启动生产服务（默认 3000 端口）

# 本地验证（需要 Node >= 22.6 直接运行 TS）
node scripts/smoke.ts     # 引擎：每个房间的地面真值解都能逃脱 + 非法动作路径
node scripts/pipeline.ts  # 全链路：MockAgent 循环 → 指标 → 评分 → JSON/MD 报告
```

**部署**：本项目是标准 Next.js 15 应用，可直接部署到任意支持 Next.js 的平台（如 Vercel）。部署时需在平台的环境变量中配置 `QWEN_API_KEY` / `QWEN_MODEL` / `QWEN_BASE_URL`（不配置则只能使用 Demo Mode）。仓库当前**未包含 Dockerfile 或 CI 配置**。

### 贡献说明

欢迎任何形式的贡献（新房间、新模型接入、指标与可视化改进、文档修正）：

1. Fork 本仓库并新建分支：`git checkout -b feat/your-feature`。
2. 保持改动聚焦，遵循现有代码风格与 TypeScript 严格模式。
3. 提交前请确保通过：`npm run lint && npm run build`，并运行 `node scripts/smoke.ts`、`node scripts/pipeline.ts`。
4. 新增房间时，请提供声明式的 `RoomCase` 数据，并确保地面真值解可逃脱（含 `optimalActions` 与 `criticalObjects`）。
5. 提交 Pull Request，并在描述中说明动机、改动范围与验证方式。

### 更新计划 / Roadmap

- 更多房间与多房间地图（状态中已建模房间间 `move`）
- 每个房间的 N 次试验以衡量方差/一致性；支持种子锁定的可复现评测模式
- 在同一个 `AIProvider` 接口下接入更多模型（GPT / Claude / 本地模型）做横向对比
- 服务端运行记录存储与可分享的回放链接
- 分级惩罚的提示（Hint）系统（指标位 `hintUsage` 已预留）
- CI 评测任务，将分数变化发布到排行榜
- 补充界面截图与演示 GIF

### 致谢 / Acknowledgements

- [Next.js](https://nextjs.org/)、[React](https://react.dev/)、[Tailwind CSS](https://tailwindcss.com/)、[TypeScript](https://www.typescriptlang.org/) —— 构建本项目的基础设施
- [Qwen / 阿里云 DashScope](https://dashscope.aliyuncs.com/) —— 通过 OpenAI 兼容接口提供当前被测模型
- 所有密室谜题、引擎与评分体系均为本项目原创实现

### 开源协议 / License

本项目基于 [MIT License](./LICENSE) 发布。

---

## English

### Overview

**AI ESCAPE LAB** is an escape-room style **Agent Benchmark for LLMs**.

It is not a chatbot demo. The agent under test faces an Environment with hidden state, interacts with it through a fixed set of **structured actions**, and must escape under a **limited action budget** with only **partial observations**. It evaluates:

information gathering · multi-step reasoning · planning · state understanding · tool/action use · hypothesis testing · self-correction · long-horizon execution · distraction resistance · rule compliance

Current primary model under test: **Qwen** (via DashScope's OpenAI-compatible endpoint).

> Key property: **everything works without an API key.** When no key is configured, AI Mode automatically falls back to `MockAgentProvider` (Demo Mode) — scripted-but-realistic trajectories that observe, hypothesize, fail, reconsider, self-correct and escape, so the full product can be demonstrated offline.

### Features

- **Five chambers** covering different capability axes, from tutorial to hard.
- **Two modes**: `AI Mode` (watch the agent escape) and `Human Mode` (play the same chamber yourself, scored by the same engine).
- **Live broadcast console**: step-by-step `THOUGHT / ACTION / OBSERVATION`, with pause / resume / single step / reset; auto-run paces steps at 500–1500 ms.
- **Step-by-step replay**: `/replay/[runId]` with Prev / Next / Auto Play, observation snapshots, hypotheses and state deltas.
- **Benchmark dashboard**: overall score, escape rate, invalid/repeat/self-correction rates, information efficiency, format reliability — with a dependency-free SVG radar chart, score bars and a per-room results table.
- **Six-axis 0–100 scoring engine**: Success 40 / Action Efficiency 20 / Information Efficiency 15 / Reasoning Quality 10 / Self-Correction 10 / Rule Compliance 5.
- **Report export**: one-click `benchmark-report.json` and `benchmark-report.md` (model, overall result, rule-based strengths/weaknesses, failure cases, full trajectory).
- **Key-free fallback**: without `QWEN_API_KEY` the app runs in Demo Mode and is fully demoable offline.
- **Key safety**: the API key is read server-side only; the browser calls `/api/agent`, and the key never reaches the client bundle.
- **Framework-decoupled engine**: rooms are **pure declarative data** (`RoomCase`) and the Puzzle Engine does not depend on React, making new rooms easy to add.
- **Local verification scripts**: `scripts/smoke.ts` proves every room is escapable via its ground-truth solution; `scripts/pipeline.ts` runs the full Mock agent loop → metrics → score → report export.

### Demo / Screenshots

The chamber visuals are **drawn live with CSS / SVG and the repository ships no image assets** (`src/components/RoomView` explicitly notes "No image assets"). Therefore there are currently **no screenshot files available** and the screenshot area is left for a future addition (see [Roadmap](#roadmap)).

Start the dev server and walk the routes below:

| Route | What |
|---|---|
| `/` | Lab-style landing page: room selection, mode selection |
| `/room/[id]?mode=ai` | Watch the agent escape (live THOUGHT / ACTION / OBSERVATION broadcast) |
| `/room/[id]?mode=human` | Play the same chamber yourself; scored with the same engine |
| `/benchmark` | Dashboard: overall score, escape rate, ratio metrics, radar, per-room table, JSON / Markdown export |
| `/replay/[runId]` | Step-by-step replay: Prev / Next / Auto Play, observation snapshots, hypotheses, state deltas |

Room ids: `clockmaker`, `librarian`, `liar`, `red-herring`, `loop`.

### Requirements

| Item | Requirement |
|---|---|
| Node.js | `>= 18.18` (Next.js 15 minimum); **`>= 22.6` recommended** so the `scripts/*.ts` verification scripts can be run directly with `node` (native TypeScript type stripping). This project was developed on Node 24 |
| npm | `>= 9` (developed with npm 11) |
| Browser | Any modern browser (`localStorage` is used to store benchmark runs) |
| Qwen API Key | **Optional.** Without it the app automatically runs in Demo Mode |

### Installation

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Configure a Qwen key — Demo Mode works without one
#    macOS / Linux
cp .env.example .env.local
#    Windows (PowerShell)
copy .env.example .env.local
```

`.env.local`:

```env
QWEN_API_KEY=sk-xxxx
QWEN_MODEL=qwen-plus
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

Notes:

- The key is **read server-side only** ([route.ts](./src/app/api/agent/route.ts) via `QwenProvider`, OpenAI-compatible chat completions) and never reaches the browser bundle.
- The frontend learns whether a key exists through `GET /api/config` (a boolean only — the key itself is never exposed): with a key, AI Mode runs real Qwen; without, it runs Demo Mode.
- Model output is validated against the action JSON schema; format errors trigger at most 2 automatic retries and are recorded in `format_error_count` (Format Reliability metric).

### Usage

```bash
# Development
npm run dev          # http://localhost:3000

# Production build & start
npm run build
npm start

# Lint
npm run lint
```

**How to play**:

1. Open `/` and pick a chamber (e.g. `clockmaker`).
2. Click **AI Mode** to watch the agent escape (pause / single step / reset are available), or **Human** to play it yourself.
3. When a run finishes, the record is written to browser `localStorage` (key `ai-escape-lab:runs`, most recent 100 runs kept).
4. Open `/benchmark` to see aggregated results and export reports; open `/replay/[runId]` for a step-by-step replay.

**Agent interaction model**:

The Environment ([environment.ts](./src/engine/environment.ts)) holds ground truth the agent cannot read. Each turn the agent receives an `Observation` (visible objects, states, inventory, recent events, actions remaining) and must answer with **exactly one** structured action:

```json
{ "action": "input", "target": "safe", "value": "1015", "reason": "The stopped time may encode the combination." }
```

Allowed actions: `inspect · interact · move · use_item · input · take · combine · submit_answer`.

Illegal actions (unobserved targets, invalid combos, …) are rejected with explicit messages and tracked as metrics. The agent can never declare "I escaped" — escape only happens through the environment (moving through an opened door, or a mechanism).

Loop: **Observation → Reasoning → Action → Validation → State update → new Observation**, until `escaped`, the action budget is exhausted, or 5 consecutive invalid actions.

### The five chambers

| # | Room | Benchmarks |
|---|---|---|
| 01 | **The Clockmaker** (tutorial) | Basic observation + clue combination (clock 10:15 → safe code) |
| 02 | **The Librarian** | Cross-object information combination (shelf order × planetary index; the answer lives in no single object) |
| 03 | **The Liar** | Contradiction reasoning (exactly one note is true; wrong chests seal forever — brute force is punished) |
| 04 | **The Red Herring** | Distraction resistance (16 objects, only 4 matter; loud false clues) |
| 05 | **The Loop** | Self-correction (symbols look like a code but are a statue mapping; the first hypothesis fails by design) |

### Scoring & metrics

**Escape Score (0–100)**:

| Axis | Weight |
|---|---|
| Success (did it escape) | 40 |
| Action Efficiency (vs. optimal actions) | 20 |
| Information Efficiency (share of critical-object actions) | 15 |
| Reasoning Quality (hypothesis quality, minus repeat/critical penalties) | 10 |
| Self-Correction (recovering from failures) | 10 |
| Rule Compliance (legal actions, format-error penalty) | 5 |

Each step is classified as `useful / irrelevant / invalid / repeated`, and critical mistakes and self-corrections are detected (see [scoring.ts](./src/engine/scoring.ts)).

**Benchmark summary metrics**: `escape_rate`, `average_score`, `average_actions`, `invalid_action_rate`, `repeated_action_rate`, `self_correction_rate`, `information_efficiency`, `format_reliability`.

### Project structure

```text
.
├── src/
│   ├── app/                      Next.js App Router
│   │   ├── page.tsx              Landing page (room / mode selection)
│   │   ├── layout.tsx            Root layout & metadata
│   │   ├── globals.css           Terminal-lab theme (Tailwind v4)
│   │   ├── room/[id]/page.tsx    AI Mode / Human Mode lab bench
│   │   ├── benchmark/page.tsx    Benchmark dashboard (radar / bars / export)
│   │   ├── replay/[runId]/       Run replay
│   │   └── api/
│   │       ├── agent/route.ts    POST /api/agent (server-side Qwen call)
│   │       └── config/route.ts   GET  /api/config (is a key configured)
│   ├── engine/                   Framework-agnostic pure logic
│   │   ├── types.ts              Action / room / observation / trace / report types
│   │   ├── environment.ts        Environment: action validation, rule evaluation, state advance
│   │   ├── scoring.ts            Step classification, metrics, 0–100 scoring
│   │   └── replay.ts             Replay & action formatting helpers
│   ├── agents/                   Agent integration layer
│   │   ├── provider.ts           AIProvider interface (AgentContext / AgentDecision)
│   │   ├── prompts.ts            System & observation prompts
│   │   ├── qwen.ts               QwenProvider (server-side, OpenAI-compatible) + JSON parsing
│   │   ├── mock.ts               MockAgentProvider (Demo Mode scripted trajectories)
│   │   └── remote.ts             RemoteQwenProvider (browser-side, forwards to /api/agent)
│   ├── data/rooms/               Declarative room data (room01..room05 + index.ts)
│   ├── components/               RoomView · AgentConsole · Timeline
│   └── lib/                      useAgentLoop.ts · storage.ts · exportBenchmark.ts
├── scripts/
│   ├── smoke.ts                  Engine smoke test: ground-truth escape + illegal-action paths
│   └── pipeline.ts               Full Mock loop → metrics → score → JSON/MD report
├── .env.example                  Example env vars (no real secrets)
├── next.config.ts · tsconfig.json · eslint.config.mjs · postcss.config.mjs
└── package.json
```

### Core functionality

**1. Puzzle engine**

Rooms are pure data (`RoomCase`: objects, declarative rules with conditions/effects, doors, critical objects, ground-truth solution). `executeAction` validates the action, matches rules, and produces state changes and events; it has no React dependency and can be driven by scripts (which is exactly what `scripts/smoke.ts` does). Rules support conditions (`objectState` / `hasItem` / `consumeItem` / `puzzleSolved` / `value` / `valueNot`) and effects (`setState` / `reveal` / `addItem` / `removeItem` / `setMessage` / `unlockPuzzle` / `openDoor` / `escape`), and can be flagged `critical` (critical mistake) or `once` (fires only once).

**2. Agent integration layer**

The `AIProvider` interface exposes a single `generateAction(context)` method, so adding a model means implementing one interface. Currently provided: server-side `QwenProvider`, browser-side `RemoteQwenProvider` (forwards to `/api/agent`), and `MockAgentProvider` for Demo Mode. Response parsing (`parseAction`) tolerates code fences and surrounding prose, and retries at most twice on failure.

**3. Scoring & metrics engine**

`classifyStep` classifies each step, `computeMetrics` aggregates run metrics, and `computeScore` produces the six-axis score; `countSelfCorrections` detects self-correction via the "fail first, then succeed with a different value" pattern.

**4. Benchmark data & reports**

Every finished run (AI or Human) is stored in browser `localStorage` (key `ai-escape-lab:runs`, most recent 100 runs kept). `/benchmark` aggregates them and can export:

- **Export JSON** → `benchmark-report.json` (summary + full execution traces)
- **Export Markdown** → `benchmark-report.md` (model, overall result, rule-based strengths/weaknesses, failure cases, full trajectory)

> Note: benchmark data lives in the **browser** only — there is no server-side storage, so records do not survive switching browsers or clearing site data.

### Build, run & deploy

```bash
npm run lint         # ESLint
npm run build        # Production build
npm start            # Start production server (port 3000 by default)

# Local verification (requires Node >= 22.6 to run TS directly)
node scripts/smoke.ts     # Engine: every room is escapable via ground truth + illegal-action paths
node scripts/pipeline.ts  # End-to-end: MockAgent loop → metrics → score → JSON/MD report
```

**Deploy**: this is a standard Next.js 15 app and can be deployed to any platform that supports Next.js (e.g. Vercel). Configure `QWEN_API_KEY` / `QWEN_MODEL` / `QWEN_BASE_URL` in the platform's environment variables (without them, only Demo Mode is available). The repository currently contains **no Dockerfile and no CI configuration**.

### Contributing

Contributions of any kind are welcome (new rooms, new model integrations, metrics and visualization improvements, documentation fixes):

1. Fork the repository and create a branch: `git checkout -b feat/your-feature`.
2. Keep changes focused and follow the existing code style and TypeScript strict mode.
3. Before submitting, make sure `npm run lint && npm run build` pass, and run `node scripts/smoke.ts` and `node scripts/pipeline.ts`.
4. When adding a room, provide declarative `RoomCase` data and make sure the ground-truth solution escapes (including `optimalActions` and `criticalObjects`).
5. Open a pull request describing the motivation, the scope of change and how you verified it.

### Roadmap

- More rooms & multi-room maps (`move` between chambers is already modeled in state)
- N-trials per room for variance/consistency metrics; seed-locked reproducible benchmark mode
- More providers behind the same `AIProvider` interface (GPT / Claude / local models) for head-to-head comparison
- Server-side run storage + shareable replay links
- Hint system with graded penalty (metric slot `hintUsage` already exists)
- CI benchmark job posting score deltas to a leaderboard
- Screenshots and demo GIFs

### Acknowledgements

- [Next.js](https://nextjs.org/), [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), [TypeScript](https://www.typescriptlang.org/) — the stack this project is built on
- [Qwen / Alibaba Cloud DashScope](https://dashscope.aliyuncs.com/) — serves the current model under test through an OpenAI-compatible API
- All chambers, the puzzle engine and the scoring system are original implementations of this project

### License

Released under the [MIT License](./LICENSE).
