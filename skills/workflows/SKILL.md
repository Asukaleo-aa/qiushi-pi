---
name: workflows
description: |
  触发：当你面临的任务明显需要跨认知环节串联多个 skill 时调用；常见信号包括：从零启动新项目、攻坚复杂疑难问题、对已有方案进行迭代优化。此 skill 提供三条标准化工作流，定义 skill 的调用顺序、步骤间的数据传递格式和终止条件。
  English: Trigger when a task requires multiple skills chained across cognitive phases. Use this skill to select a standard workflow that chains skills together and defines handoff between steps.
---

# 工作流组合

方法论的威力不在于单独使用某一件思想武器，而在于**在正确的认知环节以正确的顺序组合使用**。本 skill 提供三条标准化工作流，每个工作流沿着认知环的若干环节行进。

---

## Workflow 1：新项目启动流

**认知路径：** 感知 → 理解 → 执行

**适用场景：** 从零开始面对一个新任务，目标已知但路径未知，资源有限。

**触发信号：** 新项目、新领域、MVP、从零开始、不知道从哪里下手

### 工作流

```
investigation-first   →   first-principles   →   contradiction   →   spark-prairie-fire
   (感知：调查)             (理解：本质)           (理解：矛盾)          (执行：启动)
                                  │
                          state-estimation ──→
                          (感知：推断隐藏状态)
```

### 步骤详解

**Step 1：感知——摸清现状**
调用 `investigation-first`（调查一手事实）。如数据噪声大、状态不可直接观测，并行调用 `state-estimation`（从观测推断状态）。
- 输出：事实清单 + 信息缺口 + 可靠信息源列表

**Step 2：理解——抓住本质**
调用 `first-principles-analysis`（剥离假设到不可再分，从基本元素重建理解）。
- 输出：问题本质的一句话定义 + 关键假设及其验证状态

**Step 3：理解——定位主要矛盾**
调用 `contradiction-analysis`（在本质理解基础上找核心张力）。
- 输出：⭐ 标注的主要矛盾 + 矛盾的主要方面 + 判定依据

**Step 4：执行——最小可行启动**
调用 `spark-prairie-fire`（在主要矛盾的方向上找最小可行切入点）。
- 输出：根据地选定 + 当前条件 vs 所需条件对照 + 发展路线

**Step 5（可选）：执行——长期布局**
如任务短期无法完成，调用 `protracted-strategy`（划分防御/相持/反攻阶段）。

### 终止条件
- 最小可行方案已产出并验证
- 长期阶段的划分已明确

---

## Workflow 2：复杂问题攻坚流

**认知路径：** 感知 → 理解 → 建模 → 求解 → 校验 → 修正（循环）

**适用场景：** 问题有技术深度，涉及多组件、多约束，需要建立系统模型并求解。

**触发信号：** 复杂系统、多组件、多约束、需要建模仿真、debug 困难问题

### 工作流

```
investigation-first  →  first-principles  →  systems-thinking  →  quantitative-modeling
  (感知)                  (理解)              (建模：世界观)        (建模：定量)
       │                                            │
problem-domain ──→                          system-boundary ──→
  (感知：领域知识)                            (建模：结构)
                                                   │
                                          constrained-optimization
                                          hierarchical-decomposition
                                          duality-complementarity
                                          perturbation-progressive    ←── (求解层)
                                          multi-representation-equiv
                                                   │
                                          simulation-validation     ←── (校验)
                                          feedback-and-revision
                                                   │
                                          adaptive-robust-strategy   ←── (修正)
                                                   │
                                          criticism-self-criticism   ←── (修正：复盘)
```

### 步骤详解

**Step 1：感知——双轨调查**
- 哲学轨：`investigation-first`（一手事实）
- 工程轨：`problem-domain-investigation`（系统性知识地图）
- 如数据有噪声：`state-estimation`（从噪声中提取信号）
- 输出：完整的现状画像 + 知识地图 + 信息可靠性评估

**Step 2：理解——本质与矛盾**
- `first-principles-analysis`：剥离假设到基本元素
- `contradiction-analysis`：在本质基础上定位主要矛盾
- 输出：本质定义 + 主要矛盾 + 假设依赖链

**Step 3：建模——系统描述**
- `systems-thinking-framework`：目的→边界→组分→层次→涌现→反馈
- `system-boundary-structuring`：精细划分子系统，定义接口契约
- `quantitative-modeling-workflow`：定性假设转为可计算模型
- `meta-synthesis-engine`（多源结果汇聚时）：定性+定量综合集成
- 输出：系统模型 + 接口契约 + 可计算的定量关系

**Step 4：求解——逐层攻破**
按需选用求解工具箱：
- `constrained-optimization`：约束下找最优
- `hierarchical-decomposition-coordination`：多子系统协调
- `duality-complementarity-analysis`：正向遇阻换对偶
- `perturbation-progressive-method`：不能直接解就渐进逼近
- `multi-representation-equivalence-transform`：工具不合适就换表述
- 输出：可行解 + 瓶颈约束 + 解的适用范围

**Step 5：校验——验证与偏差**
- `simulation-validation-cycle`：多场景仿真测试
- `feedback-and-revision-loop`：阶段偏差检测与根因追溯
- 输出：偏差量化 + 根因层次（执行/求解/建模/理解/感知）

**Step 6：修正——根据偏差回环**
偏差的层次决定回到哪个认知环节：
- 执行偏差 → 回到「执行」环，调整 engineering-orchestration
- 求解偏差 → 回到「求解」环，换约束或换方法
- 建模偏差 → 回到「建模」环，修正系统描述
- 理解偏差 → 回到「理解」环，重做 first-principles
- 感知偏差 → 回到「感知」环，重做 investigation
- 环境持续变化 → `adaptive-robust-strategy`（内置自适应机制）
- 质量审视 → `criticism-self-criticism`（结构化复盘）

### 终止条件
- 偏差缩小到可接受范围
- 或经过一轮闭环后判断当前信息不足以进一步改进（标注不确定性，回感知环）

---

## Workflow 3：方案迭代优化流

**认知路径：** 执行 → 校验 → 修正 → 理解 → 建模 → 求解 → 执行（循环）

**适用场景：** 已有在运行的方案，但需要持续改进。或方案在实践中出现失谐，需要诊断和修正。

**触发信号：** 优化现有方案、性能下降需要诊断、持续改进、迭代升级

### 工作流

```
concentrate-forces  →  engineering-orchestration  →  practice-cognition
  (执行：聚焦主攻)       (执行：编排任务)             (校验：实践检验)
                                                          │
                                              feedback-and-revision-loop ←── (校验：偏差检测)
                                                          │
                                              contradiction-analysis     ←── (理解：重新找矛盾)
                                                          │
                                              adaptive-robust-strategy   ←── (修正：自适应)
                                                          │
                                              criticism-self-criticism   ←── (修正：复盘)
                                                          │
                                              constrained-optimization   ←── (求解：新约束下最优)
                                                          │
                                              ──→ 回到执行环
```

### 步骤详解

**Step 1：执行——聚焦与编排**
- `concentrate-forces`：在当前条件下确定主攻方向，宣告"当前战役目标"
- `engineering-orchestration`：将改进方案编排为有依赖的任务序列
- 如需要多目标平衡：`overall-planning`（在执行前做全局权衡）

**Step 2：校验——实践检验**
- `practice-cognition`：将改进方案投入实践，观察结果
- `feedback-and-revision-loop`：检测偏差，量化差异，追溯根因
- 输出：偏差报告 + 根因定位 + 严重程度评级

**Step 3：理解——重新定位**
- 如果偏差指向理解层问题：`contradiction-analysis`（重新识别主要矛盾是否已转移）
- 如果偏差指向建模层问题：回到建模环节重建模型
- 输出：修正后的矛盾图谱

**Step 4：修正——策略调整**
- `adaptive-robust-strategy`：内置自适应机制，使方案能在变化中保持最优
- `criticism-self-criticism`：结构化审视整个迭代过程的判断质量
- 输出：调整后的方案 + 自校正规则

**Step 5：求解——新方案**
- `constrained-optimization`：在更新后的约束和模型下重新求最优
- 输出：迭代后的最优方案

**Step 6：回到执行环，进入下一轮迭代**

### 终止条件
- 连续两轮迭代的改进量低于阈值
- 或达到预设的迭代次数上限
- 或方案已满足所有硬性指标

---

## 工作流选择指南

| 你的情况 | 选哪个工作流 | 覆盖的认知环节 |
|---------|------------|--------------|
| 从零开始，不知道怎么做 | Workflow 1：新项目启动 | 感知 → 理解 → 执行 |
| 问题有技术深度，需要建模求解 | Workflow 2：复杂问题攻坚 | 全部七个环节 |
| 已有方案，需要持续改进 | Workflow 3：方案迭代优化 | 执行 → 校验 → 修正（循环） |
| 简单任务，不需要串联 | 不用 workflows，直接调用单个 skill | 1-2 个环节 |

---

## 与其他 skill 的关系

- **入口**：由 `arming-thought` 的认知环路由判断触发
- **执行**：每条工作流内部调用的 skill 已在上文标注
- **可组合**：三条工作流不是互斥的——一个长期项目可能在启动阶段用 Workflow 1，中期攻坚用 Workflow 2，后期迭代用 Workflow 3
