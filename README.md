# 求是系统工程方法论 —— Pi 扩展

> 实事求是 + 钱学森系统工程 + 工程控制论 → Pi 编码智能体认知闭环

## 概述

本 Pi package 将 **求是系统工程方法论** 的完整认知闭环深度嵌入 Pi 的运行时事件系统。它不是让 LLM 读的「行为准则文本」，而是一个**直接运行在 Pi 事件循环中的行为控制系统**。

28 个技能、七环认知状态机、四级约束矩阵、交互确认工具、安全防护机制——这些不是供参考的文档，而是实际控制 Agent 每一轮决策的运行时逻辑。

## 七环认知闭环

```
感知 🔍 → 理解 💡 → 建模 📐 → 求解 ⚙️ → 执行 🚀 → 校验 ✅ → 修正 🔧
  ↑                                                              │
  └──────────────────── 反馈回环 ─────────────────────────────────┘
```

## 安装

```bash
# 从 GitHub 安装
pi install git:github.com/Asukaleo-aa/qiushi-pi

# 本地开发安装
pi install ./qiushi-pi

# 更新
pi update qiushi-pi
```

### 推荐配套安装

```bash
# 本地浏览器操控（感知环节的感官和手）
git clone https://github.com/badlogic/pi-skills ~/.pi/agent/skills/pi-skills

# 网页抓取、GitHub 克隆、PDF 解析（只用 fetch_content，不用 web_search）
pi install npm:pi-web-access

# 文档解析
pi install npm:pi-docparser

# MCP 协议适配器（接入本地 filesystem/git/sqlite 等 MCP 服务器）
pi install npm:@0xkobold/pi-mcp
```

## 集成的扩展组件

### 认知核心

| 组件 | 类型 | 作用 |
|------|------|------|
| `qiushi-cognitive-loop` | 自研核心 | 七环状态机 + 上下文注入 + 环节权限约束 |

### 安全防护

| 组件 | 来源 | 作用 |
|------|------|------|
| `qiushi-protected-paths` | Pi 官方 example 吸入改造 | 路径级硬防护（.env、.git/、node_modules/ 永不写入） |
| `qiushi-git-checkpoint` | Pi 官方 example 吸入改造 | 每轮自动 git stash，偏差后一键回退 |

安全模型：**环节权限（什么时候能写）× 路径权限（哪些文件永远不能碰）= 二维防护矩阵**

### 交互确认

| 组件 | 来源 | 作用 |
|------|------|------|
| `qiushi-question` | Pi 官方 example 吸入 | 单问题 + 多选项交互，覆盖感知/理解/校验/修正四个环节的出口确认 |
| `qiushi-questionnaire` | Pi 官方 example 吸入 | 多问题 Tab 切换，建模/执行环节的结构化确认 |
| `qiushi-handoff` | Pi 官方 example 吸入 + qiushi 改造 | 环节间上下文浓缩传递，自动注入认知状态（本质、主要矛盾、解） |

### 推荐配套（独立安装）

| 包 | 用途 | 对应 qiushi 环节 |
|-----|------|-----------------|
| browser-tools（pi-skills） | 本地 Chrome 操控，搜索网页 | 感知（investigation-first） |
| pi-web-access | 网页抓取、GitHub 克隆、PDF 解析 | 感知（problem-domain-investigation） |
| pi-docparser | PDF/Word/Excel 文档解析 | 感知 |
| @0xkobold/pi-mcp | MCP 协议适配器，接入本地 filesystem/git/sqlite 等 | 感知/执行 |

## 使用

安装后，每次启动 Pi 时认知环自动激活。

### 自动行为

- **上下文注入**：每个 Agent 轮次前，当前环节的指导上下文自动注入
- **权限约束**：违规工具调用被自动拦截（感知环禁止写入文件）
- **路径保护**：敏感路径（.env 等）在任何环节都不可写
- **Git 检查点**：每轮自动 stash
- **状态栏显示**：底部始终显示当前环节、深度等级

### 用户命令

| 命令 | 作用 |
|------|------|
| `/phase` | 显示完整认知状态 |
| `/phase advance` | 推进到下一认知环节 |
| `/phase back` | 回退到上一认知环节 |
| `/phase set <环节>` | 手动设置环节 |
| `/phase reset` | 重置到感知环节 |
| `/depth <0-4>` | 设置深度等级 |
| `/hierarchy <物理/工程/产品/社会技术>` | 设置系统层次 |
| `/handoff <目标>` | 浓缩当前上下文到新会话（自动注入认知状态） |

### LLM 工具

| 工具 | 作用 |
|------|------|
| `load_qiushi_skill` | 按需加载任一求是技能的完整内容 |
| `question` | 弹出选项让用户确认关键判断 |
| `questionnaire` | 多问题 Tab 切换结构化确认 |

## 技能清单（28 个）

### 感知（Perceive）
- `investigation-first` — 调查研究
- `problem-domain-investigation` — 问题域调研
- `mass-line` — 群众路线
- `state-estimation` — 状态估计

### 理解（Understand）
- `first-principles-analysis` — 第一性原理分析
- `historical-evolution-analysis` — 历史演化分析
- `contradiction-analysis` — 矛盾分析

### 建模（Model）
- `systems-thinking-framework` — 系统思维框架
- `system-boundary-structuring` — 系统边界与结构
- `quantitative-modeling-workflow` — 定量建模
- `meta-synthesis-engine` — 综合集成

### 求解（Solve）
- `constrained-optimization` — 约束优化
- `hierarchical-decomposition-coordination` — 递阶分解协调
- `duality-complementarity-analysis` — 对偶互补分析
- `perturbation-progressive-method` — 摄动渐进
- `multi-representation-equivalence-transform` — 多表述等价变换

### 执行（Execute）
- `engineering-orchestration` — 工程编排
- `concentrate-forces` — 集中兵力
- `spark-prairie-fire` — 星火燎原
- `protracted-strategy` — 持久战略
- `overall-planning` — 统筹兼顾

### 校验（Verify）
- `practice-cognition` — 实践认识论
- `simulation-validation-cycle` — 仿真验证
- `feedback-and-revision-loop` — 反馈修正循环

### 修正（Correct）
- `criticism-self-criticism` — 批评与自我批评
- `adaptive-robust-strategy` — 自适应系统方法

### 元能力（Meta）
- `arming-thought` — 武装思想（始终可见的入口技能）
- `workflows` — 标准化工作流

## 环节权限矩阵

| 环节 | read | write | edit | bash |
|------|------|-------|------|------|
| 感知 | ✅ | ⚠️ 仅临时 | ❌ | ⚠️ 仅只读 |
| 理解 | ✅ | ⚠️ 仅笔记 | ❌ | ⚠️ 仅分析 |
| 建模 | ✅ | ✅ 仅模型 | ⚠️ | ✅ 分析类 |
| 求解 | ✅ | ✅ | ✅ | ✅ |
| 执行 | ✅ | ✅ | ✅ | ✅ |
| 校验 | ✅ | ❌ | ❌ | ⚠️ 仅测试 |
| 修正 | 取决于回退目标 | — | — | — |

**额外路径保护**（不受环节影响）：`.env`、`.env.local`、`.git/`、`node_modules/`、`credentials.json`、`secrets/`

## 项目结构

```
qiushi-pi/
├── package.json
├── extensions/
│   ├── qiushi-cognitive-loop/     # 核心状态机 + 约束引擎 + 上下文注入
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── state-machine.ts
│   │   ├── phase-context.ts
│   │   └── constraint-engine.ts
│   ├── qiushi-git-checkpoint.ts   # Git 自动检查点（官方吸入）
│   ├── qiushi-protected-paths.ts  # 路径硬防护（官方吸入）
│   ├── qiushi-question.ts         # 单问题交互（官方吸入）
│   ├── qiushi-questionnaire.ts    # 多问题交互（官方吸入）
│   └── qiushi-handoff.ts          # 环节传递（官方吸入 + 认知状态注入）
├── skills/                        # 28 个求是技能
└── prompts/                       # 提示词模板
```

## 版本

- v1.0：初始 Pi 集成（核心认知环 + 28 skills）
- v1.1：集成安全防护（git-checkpoint + protected-paths）、交互确认（question + questionnaire + handoff）、推荐配套声明

## 许可

MIT License
