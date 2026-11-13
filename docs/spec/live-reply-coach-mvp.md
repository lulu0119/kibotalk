# Live Reply Coach — MVP 需求与技术选型

- **状态**：实现基线（跨端产品壳已落地）
- **标签**：product, mvp, architecture, react, electron, pwa
- **关联**：[产品想法](../brainstorm/2026-07-16-live-reply-coach-language-assist.md)
- **作者**：路路（与神奈子需求对齐后整理）

> KiboTalk 在本机运行。历史和声纹保存在设备上，转写和回复建议使用本机代理中配置的提供方。
> 见[本机运行说明](../../README.md#run-locally)。[ADR 0005](../adr/0005-competition-production-platform.md)
> 记录已退役的比赛部署。

## 摘要

**一句话**：真人外语开口教练——说话人识别区分用户与对方；**任一轮**（对方或用户）说完后都可请求教练，由 LLM 决定要不要给出回复提示；用户实际说了什么也进入同一条对话流。

**交付形态**：

| 端 | 形态 | 音频能力 |
|----|------|----------|
| **移动端（iPhone 等）** | 纯 Web / PWA，响应式 UI | 仅麦克风（当面场景） |
| **桌面浏览器** | 同一套 Web 应用，响应式 UI | 麦克风 |
| **桌面原生壳（macOS）** | Electron 薄入口，与 Web **共用 packages** | 麦克风 + Mac 系统声音（可双路同时采集） |

组织方式参考 [AIRI](https://github.com/moeru-ai/airi)：**具体实现放在 `packages/`，`apps/` 只是各平台的薄入口**（见 §2.2）。

---

## 1. MVP 产品需求

### 1.1 唯一主模式：AI 实景对话

不做「AI 语音陪练」「AI 文字问答」（可留灰色入口，会后迭代）。

### 1.2 核心用户流程

```text
首次打开（界面语言跟随系统；Web 后台下载 VAD 和 CAM++，macOS 安装包自带）
    → 选择对话语言和一个支持该语言的转写模型（显示覆盖语言和体积）
    → 确认后下载选中的转写模型，同时可直接读口令录声纹
        · 点击录音时申请麦克风权限；系统音频权限在设置中按需授权
        · 声纹与模型就绪后进入会话；失败可在当前页重试
    → 开始会话（快照 uiLang / conversationLang / meaningLang / level / 音源与设备；进行中锁定）
    → 持续听音频 → VAD 切段 → 说话人判定
        → other 说完：本地 STT→ 写入对话 → 请求 LLM（通常给 3 条候选）
        → user 说完：STT → 写入对话 → 同样请求 LLM（由模型决定出候选或跳过）
    → 循环
    → 暂停（释放音频但保留同一会话）或停止（封存本会话）
    → 历史按会话开始日期、时间与对话语言命名，可回看转写和候选
```

**语言轴（见 §1.4、[ADR 0003](../adr/0003-multilingual-conversation-and-meaning.md)）**：

| 轴 | 字段 | 白名单 | 作用 |
|----|------|--------|------|
| 对话语言 | `conversationLang` | `ja` \| `en` \| `zh` | 同场双方用语；匹配本地转写模型、时间轴原文、候选 `targetText`、录入口令 |
| 界面语言 | `uiLang` | `ja` \| `en` \| `zh` | 产品界面文案；首次跟随系统，停止时可切换并立即生效 |
| 候选释义语言（内部） | `meaningLang` | `ja` \| `en` \| `zh` | 不单独展示设置；开会话时由 `uiLang` 派生并冻结，允许与对话语言相同 |
| 水平 | `level` | `beginner` \| `intermediate` \| `advanced` | 单一全局难度值，进 prompt |

产品界面做中 / 日 / 英三语。界面语言、对话语言、水平、音频来源、麦克风设备及声纹只可在 stopped / 无活跃会话时修改；新会话开始时冻结快照。主题、登录时启动和会话内 AI 建议开关不受该锁定约束。

**模型按需下载**。支持所选语言的 macOS 26+ 默认使用 Apple Speech，系统在首次转写时按需准备语言资源。Web 和系统转写不可用的 Mac 默认使用覆盖中英日的 Zipformer。用户可以在设置里切换转写方式，查看 Sherpaw 模型的语言、体积和下载状态。Web 启动时下载 Silero VAD 和 CAM++ 并按版本缓存。macOS 安装包内置这两个模型，开发版没有资源时使用同一下载缓存。

**触发原则**：不再「仅对方轮次出候选」。任一 speaker 的 turn 入库后都进入教练请求；LLM 根据上下文判断本轮是否需要开口提示（见 F04）。
### 1.3 功能清单

#### P0 — 必须交付

| ID | 模块 | 需求 | 验收 |
|----|------|------|------|
| F01 | 声纹 Enrollment | 开始前读**随 `conversationLang` 的**固定口令，建立 user 声纹；换语言不强制重录 | 后续能区分 user / other |
| F02 | 说话人识别 | 每段音频判定 `user` \| `other` | 对方轮次不误触为用户 |
| F03 | VAD + STT | 按「一句」切段并转写（所选模型覆盖会话快照的 `conversationLang`）；转写**可见但不可编辑**（ASR 错误由 LLM 上下文消化）。Realtime 路径可显示进行中草稿（partial）；**正式 turn / LLM 仅定稿** | 时间轴显示转写原文（可含草稿行） |
| F04 | 回复候选（教练闸门） | **任一** `speaker` turn 入库后**一律**请求 LLM。输出 **恰好 3 条**或 **`[]`**。续写与应答同一套三卡（不加 `kind`）。卡壳 = user 停顿后半句 → 给**补全后的完整可念句** | 有 3 条时含 meaning / targetText；`conversationLang===ja` 时含 segments；`[]` / 失败 / 请求中均**保留**上一轮已提交候选（不先清空） |
| F05 | 用户轮次感知 | `speaker === 'user'` 时 STT 写入对话，并与 other 一样触发 F04 | 上下文含用户实际说的；闸门见 §1.4 |
| F06 | 语言水平 | 统一三档 beginner / intermediate / advanced，存单一全局 `level`；进 prompt | 初级与高级输出可肉眼区分 |
| F07 | 语言与 i18n | 首次确认界面语言 / 对话语言 / 水平；界面语言首次跟随系统，产品支持中日英；`meaningLang` 由 `uiLang` 派生 | 只在停止时可切换语言，UI 立即生效；新会话 STT/LLM 用新快照 |
| F08 | 对话时间轴 | 单条 turn 流，按 speaker 区分展示 | 可回看每轮原文 |
| F09 | 会话历史 | 本地长期保留会话；按开始日期、时间与对话语言显示标题，格式由会话的 `uiLang` 决定 | 列表 / 详情可回看转写和当时的候选；不保存原始音频 |
| F10 | 响应式 UI | iPhone Safari + Mac Chrome/Safari 同一 URL；宽屏 A+B 可折叠双栏，窄屏内容区对话层 | 无页面横向溢出；两栏等高并独立滚动 |
| F11 | PWA（移动） | 可「添加到主屏幕」 | 全屏、少地址栏干扰 |
| F15 | 本机运行 | 本机 Hono 代理、Web、Apple Silicon macOS | 浏览器从固定版本下载模型。桌面安装包内置模型 |

#### P1 — 演示加分

| ID | 需求 |
|----|------|
| F12 | Mac 系统音频（Teams / 视频里的对方） |
| F15 | [vieval](https://github.com/vieval-dev/vieval) 提示词评估（CI / 本地） |

#### 明确不做（MVP）

| 不做 | 原因 |
|------|------|
| 候选编辑 / 自建 | 团队决策砍掉；候选保持只读展示 |
| 「换一批」重新生成 | 产品决策不做；LLM 失败只允许重试失败请求，不提供主动再生成入口 |
| 点选 / 高亮候选 | 产品决策不做；候选不承担选择状态，用户实际说了什么始终以 STT 为准 |
| 用户选择场景 | 不做场景选择；难度由水平 + 对话上下文推断 |
| TTS / AI 代说 | 产品定位是用户自己开口 |
| iPhone 通话监听 | Web / PWA 做不到 |
| 登录账号 | 本地会话即可 |
| 本地回复模型 | 可配置本地 OpenAI 兼容端点（§2.9） |
| 会话中热切换语言 | 时间轴与 STT hint 会混乱；仅会话外改、新会话快照 |
| 对方说异于对话语言的语 | 同场双方都用 `conversationLang`；异语为后续愿景 |

### 1.4 数据模型

```ts
type AppLanguage = 'ja' | 'en' | 'zh'
type LearnerLevel = 'beginner' | 'intermediate' | 'advanced'

/** Persisted user prefs (session-out editable). */
type LanguagePrefs = {
  uiLang: AppLanguage
  conversationLang: AppLanguage
  level: LearnerLevel
  languagesConfirmed: boolean
  theme: 'system' | 'light' | 'dark'
  launchAtLogin: boolean
  audioSource: 'microphone' | 'system' | 'both'
  microphoneDeviceId: string
}

/** Frozen when a session starts; drives UI history, audio, STT + LLM. */
type ConversationSessionSnapshot = {
  uiLang: AppLanguage
  conversationLang: AppLanguage
  meaningLang: AppLanguage // = uiLang at start; not a user-facing preference
  level: LearnerLevel
  audioSource: 'microphone' | 'system' | 'both'
  microphoneDeviceId: string
}

type Speaker = 'user' | 'other'

type ConversationTurn = {
  id: string
  speaker: Speaker
  text: string
  startedAt: number
  endedAt: number
  suggestions?: ReplyCandidate[] // 本轮教练结果；空数组表示 LLM 决定跳过；未调用则为 undefined
}

type ConversationSession = {
  id: string
  status: 'running' | 'paused' | 'stopped'
  startedAt: number
  endedAt?: number
  pausedAt?: number
  pausedDurationMs: number
  pauseReason?: 'user' | 'unexpected'
  snapshot: ConversationSessionSnapshot
  turns: ConversationTurn[]
  title: string
}

type ReplySegmentRole = 'content' | 'particle' | 'punct'

type ReplySegment = {
  surface: string
  reading?: string // ja: 汉字注音；假名/标点可省略
  role: ReplySegmentRole
}

type ReplyCandidate = {
  id: string
  meaning: string // 学习者意图短句；语言 = meaningLang
  targetText: string // 可念原文；语言 = conversationLang
  /** @deprecated 整句读音；已废弃，ruby 仅用 segments[].reading（仅汉字） */
  reading?: string
  /** 分词；surface 拼接 = targetText。仅 conversationLang===ja 时强制（ruby + 助词高亮） */
  segments?: ReplySegment[]
}
```

**规则**

- 一条 `ConversationTurn[]`，不按 speaker 拆两套存储
- `meaningLang` 不是用户设置项；每次 `startSession` 从当时的 `uiLang` 派生并与其它会话定义一起冻结
- LLM 上下文 = 全部 turns（含用户 STT 结果）；prompt 须标明触发本轮的 **last speaker**（context 末轮），并注入会话快照的 `conversationLang` / `meaningLang` / `level`
- 点选候选 ≠ 用户说了什么；**以 STT 为准**
- LLM JSON：**要么**长度为 3 的候选数组，**要么** `[]`（跳过）。禁止其它包装形状
- **Schema**：续写与「下一句应答」同一套 `ReplyCandidate`（meaning + targetText；ja 时 + segments），**不加** `kind` 字段
- **注解**：`conversationLang === 'ja'` 时强制 segments（汉字 ruby + 助詞）；en/zh 可省略 segments，UI 只显示 `targetText` + `meaning`
- **卡壳**：用户说一半卡住 = 停顿 ≥ `VAD_PAUSE_MS` 后入库的未完 / 半句 user turn。此时 3 条应为基于半句补全的**完整可念句**（用户可从头念整句；不是只给续写尾巴）
- **闸门（prompt 写死）**：
  - **`other` 后**：几乎必给 3 条；仅噪声 / 极短无意义 / 明显不在等用户开口时才可 `[]`
  - **`user` 后（宽松）**：不像「话轮已结束且在等对方」就给 3 条（卡壳续写，或下一句脚手架）；仅很明显「用户已答完、在等对方」才 `[]`
- **UI 流式契约**：
  - `candidatesStreaming` / 请求开始：**不**清空上一轮**已提交**的 3 卡
  - 仅当最终 `length === 3` 时替换展示
  - `[]`、`llmFailed`、abort：保留上一轮已提交候选；abort 只丢弃**本轮半截流**，不抹掉旧卡
- MVP **不做**客户端预过滤（短句才请求等）、不拆双模型；每个达标 turn 都打 LLM

### 1.5 与神奈子原型图对齐

| 她图里的 | MVP |
|----------|-----|
| 录声纹 | ✅ F01 |
| 听对方 / 听自己 → 出建议（由模型决定） | ✅ F02–F05 |
| 感知用户说了什么 | ✅ F05 |
| 语言水平 | ✅ F06（三档 + 按语言） |
| 历史回看 | ✅ F09（转写与当时的候选） |
| AI 语音 / AI 问答 | ❌ |
| 候选编辑 | ❌ 已砍 |

### 1.6 跨端产品壳契约

- **开始即转写**：点开始即连当前 API origin；产品不提供转写开关。AI 建议可独立关闭；关闭后继续转写并保留旧卡。
- **暂停与停止分离**：暂停无需确认并保留上下文；停止需确认，保存后下一次开始创建新会话。停止控制紧邻暂停 / 继续。
- **Web 会话页**：控制区固定顶部，页面本身不随内容滚动；宽屏 A+B 双栏等高且独立滚动，对话按钮在展开时仍保留并显示激活态；移动端同一按钮打开 / 收起对话层。
- **桌面 Island**：窗口 always-on-top、可拖移和八向缩放；细边框只在鼠标位于窗口内容或缩放命中区时出现。窗口上半屏时内容在 Island 下方，下半屏时在上方；转写仍是视觉最上方内容。Island 上直接放状态、相邻的暂停 / 继续和停止、AI 开关、四向拖动把手；更多菜单放历史、设置、隐藏、退出。
- **候选卡**：最多三轮，按容器高度减少；不重叠、不旋转，旧轮逐级透明且不可点击。无候选时不显示空白黄卡；首次请求可显示与最终布局一致的骨架。Web 与桌面均显示日语 ruby 和助词高亮。
- **设置**：通用、对话、声纹、权限、关于。普通项立即保存，无保存按钮；活跃会话锁定会话定义类项目。用户看不到模型名称、模型选择或模型删除。历史页可删除单次会话或清空已结束的历史。声纹可在设置中删除。
- **音频**：Web 只用系统默认麦克风。桌面可选真实麦克风设备及麦克风 / 系统音频 / 同时采集；同时采集为 mic=user、system=other 两条独立 lane，不混音。
- **macOS 状态栏**：首次引导后默认不占 Dock；静态品牌图标菜单可显示 / 隐藏、控制会话、切换 AI、进入历史 / 设置及退出。动态状态图标和系统通知延期。所有主动退出路径均需确认；活跃时先停止保存再退出。

---

## 2. 技术栈选型

### 2.1 总览

| 层 | 选型 | 参考 |
|----|------|------|
| Monorepo | pnpm workspace + **Turborepo** | [moeru-ai/airi](https://github.com/moeru-ai/airi) |
| 主 UI | **React** + Vite | — |
| 样式 | **Tailwind CSS** + **shadcn/ui** | — |
| 会话编排 | `packages/conversation` | 借鉴 [DeepChat](https://github.com/thinkinaixyz/deepchat) Tape 思路 |
| 语音 Pipeline | `packages/pipeline` | [webai-example-realtime-voice-chat](https://github.com/proj-airi/webai-example-realtime-voice-chat)（VAD + STT，无 TTS） |
| 提示词 | **Velin** `@velin-dev/core-react`（TSX） | [moeru-ai/velin](https://github.com/moeru-ai/velin) |
| LLM | xsAI v1 + `@xsai-ext/providers` | 应用内配置端点和模型，见 §2.9 |
| 语音推理 | Sherpaw、xsAI Apple Speech | Silero v5 VAD、CAM++ 声纹、流式 Zipformer / X-ASR / Paraformer、macOS 设备端转写 |
| 调试追踪 | AIRI 的 trace-kit、stream-kit、timeline-canvas、ui-timeline 和 ui-trace | Playground |
| Prompt 评估 | **vieval**（根目录 config + `evals/`） | [vieval-dev/vieval](https://github.com/vieval-dev/vieval) |
| 移动 | **PWA**（`apps/web` 构建） | — |
| 桌面 Web | 同一 `packages/*`，`apps/web` 响应式 | 对齐 AIRI「浏览器入口」角色，非其命名 |
| 桌面系统音 | **Electron** 薄入口 | AIRI `stage-tamagotchi` 同款模式 |

### 2.2 Monorepo 结构（对齐 AIRI 的真实做法）

#### AIRI 实际怎么拆的

查了 [airi 仓库](https://github.com/moeru-ai/airi)：

| 位置 | 职责 | 例子 |
|------|------|------|
| **`packages/`** | **绝大部分实现**：UI、页面、业务逻辑、音频 pipeline | `stage-ui`、`stage-pages`、`stage-layouts`、`pipelines-audio`、`core-agent` |
| **`apps/`** | **薄入口**：Vite / Electron / Capacitor 配置、平台特有胶水 | `stage-web`、`stage-tamagotchi`、`stage-pocket` |

要点：

1. **`apps/stage-web` 和 `apps/stage-tamagotchi` 都直接 `workspace:^` 依赖同一批 packages**（`stage-ui`、`stage-pages` 等），不是「桌面加载 web 的 dist」。
2. 桌面端用 **electron-vite 自己再编一版**，与 web 入口**共享 packages、各自打包**。
3. 我们没有「舞台」概念，**不沿用 `stage-*` 命名**；只借鉴「packages 实现 + apps 入口」分层。

#### 本项目的目录

```text
live-reply-coach/
├── apps/
│   ├── playground/             # 功能验证入口：极简前端，测 pipeline 各模块（见 §2.7）
│   ├── web/                    # 薄入口：Vite dev、生产构建、PWA manifest
│   └── desktop/                # P1：Electron 薄入口（主进程音频、窗口）
├── packages/
│   ├── ui/                     # shadcn 组件 + design tokens
│   ├── pages/                  # 路由与页面（会话、设置、回顾）
│   ├── app-shared/             # 跨页面状态、hooks、布局
│   ├── conversation/           # Session / Turn store
│   ├── pipeline/               # VAD → speaker → STT → 触发 LLM
│   ├── speaker/                # enrollment + 在线判定
│   ├── prompts/                # Velin TSX 模板
│   ├── llm/                    # xsAI 封装
│   ├── audio/                  # AudioSource 抽象（mic | system）
│   └── shared/                 # types、constants
├── evals/                      # vieval 用例（*.eval.ts）+ fixture
├── vieval.config.ts            # 根目录，与 vieval 官方仓库一致
├── turbo.json
└── pnpm-workspace.yaml
```

**`apps/web` 里通常只有**：`index.html`、`main.tsx`、`vite.config.ts`、`pwa` 插件——然后 `import` 来自 `@lrc/pages`、`@lrc/ui`。

**`apps/desktop` 里通常只有**：Electron main/preload、打包配置——渲染进程同样 `import` 同一批 packages。

### 2.3 vieval：不需要 `eval-runner` app

[vieval 官方仓库](https://github.com/vieval-dev/vieval) 的做法：

- 根目录 `vieval.config.ts`
- 根目录 `evals/`（`pnpm-workspace` 成员）
- 根 `package.json` 脚本：`pnpm -F vieval eval:run` 或 `vieval run --config ./vieval.config.ts`
- **没有**单独的 `apps/eval-runner`

eval 直接 import `packages/prompts`、`packages/llm` 的业务函数，不必经过 UI 入口。

根 `package.json` 示例：

```json
{
  "scripts": {
    "eval": "vieval run --config ./vieval.config.ts"
  }
}
```

### 2.4 语音 Pipeline

**数据流（单段）**：

```text
AudioSource (getUserMedia | Electron 主进程注入 system PCM)
    ↓
VAD（一句结束）
    ↓
SpeakerGate（本地 enrollment embedding → user | other）
    ↓
STT（可与 SpeakerGate 并行）
    ↓
conversation.appendTurn({ speaker, text })
    ↓
Velin(repliesPrompt) → xsAI → JSON: 3 candidates | []
    ↓
若 length === 3 → 替换候选 UI；若 [] / 失败 → 保留上一轮已提交候选（请求开始也不清空）
```

**会话状态机（含打断与多轮）**：

```text
                         ┌──────────────────────────────────┐
                         ▼                                  │
  ┌──────┐  VAD 检到语音   ┌──────────────┐  停顿 ≥ 阈值     │
  │ IDLE │ ──────────────→ │ OTHER_SPEAKING│ ─────────────┐   │
  └──────┘  speaker=other  └──────────────┘             │   │
      │                                                  ▼   │
      │  VAD 检到语音                              append other turn
      │  speaker=user                                   │      │
      ▼                                                 ▼      │
  ┌──────────────┐  停顿 ≥ 阈值            ┌──────────────────┐│
  │USER_SPEAKING │ ─────────────┐         │  LLM_STREAMING   ││
  └──────────────┘             │         │  (3 候选或 [])    ││
        │                      │         └──────────────────┘│
        ▼                      │            │            │   │
   append user turn            │          完成          被打断│
        │                      │            │            │   │
        └──────────→ LLM_STREAMING ←────────┘            │   │
                     （user / other 均可触发）              │   │
                            │            │                 │   │
                            ▼            ▼                 │   │
                     length===3 替换  abort：丢本轮半截流     │   │
                     []/fail 保留旧卡 → 听新语音 ────────────┘   │
                            │                                  │
                            └──────────────────→ IDLE ─────────┘
```

**规则**：

1. **停顿阈值触发 LLM**：**other 或 user** 停说 ≥ `VAD_PAUSE_MS` → 定稿 turn 入库 → **一律**触发 LLM streaming（F04）。卡壳救援也走同一路径（user 半句停顿后请求）
2. **打断**：LLM streaming 中，VAD 检到**任一** speaker 的新语音 → **abort 在途 LLM**，丢弃**本轮半截流**（不展示未完成对象），**保留**上一轮已提交的 3 卡，开始捕获该轮说话
3. **多轮无用户**：可连续多个 other turn——每次 other 停顿达标都触发 LLM；若返回 3 条则刷新候选，若 `[]` 则保留原展示
4. **完整对话进下一轮**：被打断后新一轮 LLM 的 context = **所有已完成的 ConversationTurn**。半截候选与 realtime partial **不进 context**（§1.4「以 STT 为准」）
5. **抢说 / 连说**：对方或用户停说后的阈值倒计时中若另一方（或同方）又开口 → **取消待触发或在途的 LLM**，先完成新 turn 的 STT/入库，再按规则 1 **重新请求教练**（user 入库后同样触发，不再「只入库不出 LLM」）
6. **STT 失败**：显示本地模型或音频错误，暂停会话。已保存的转写和回复建议可继续查看。
7. **LLM 失败**：自动重试 1 次（1s 退避）→ 仍失败 → 候选区可提示「出候选失败，重试」，但**不清空**上一轮已提交候选；turn 已入库不动 → 循环继续听下一轮，**不杀会话**
8. **不做**：熔断、多轮指数退避、离线缓存重放、客户端预过滤闸门、双模型、中途 partial 触发 LLM——MVP 过度

重试在 `packages/pipeline` 层做（catch 网络错误 + 重试 1 次 + 转用户可见状态）；`packages/llm` / `packages/stt` 的 client 内部不重试，保持简单。

**TurnGate（`packages/audio` segment aggregator）**：

坐在 VAD（+ 声纹）与 pipeline 之间。同 speaker 的 speech 段累积，在以下任一条件 flush：

- 距上一段结束的静音 ≥ `VAD_PAUSE_MS`（双方同一阈值，默认 1000）
- 说话人切换（先 flush 旧 turn，再开始新 turn）
- 累计**语音**时长 ≥ `VAD_MERGE_MAX_MS`

**Realtime（唯一路径）**：每段 VAD speech fragment 上行 `append` 并 Manual `commit` → 等该 fragment 的 `completed`；定稿文本 + 声纹结果再进入 TurnGate，flush 后才 `ingestFinalizedTurn`。`completed` 与 commit 严格 FIFO 一一对应；单个 `TRANSCRIPTION_FAILED` 只失败对应 fragment，不得清空其他等待项或杀死连接。详见 [ADR 0004](../adr/0004-realtime-stt-parallel-to-batch.md)。

**配置**：

VAD 停顿阈值与说话人判定阈值为**频繁调试参数**，在 playground 前端「调试参数」面板实时可调，无需改 env 或重启会话：

- `VAD_PAUSE_MS`（任一方停说多久算「说完」→ 定稿 + 触发 LLM）：默认 1000
- `VAD_MERGE_MAX_MS`（累计语音多久强制成句）：playground 默认可调
- 说话人判定 `threshold`：默认见 `packages/app-shared/src/config.ts`

便利店快节奏可能 700ms 更合适，会议场景可能 1.5s——先 1s 跑起来，playground 阶段按场景调。
#### SpeakerGate 选型结论

**任务边界**：MVP 是 **speaker verification**（先录 user 声纹，每句比对 → `user` / `other`），不是开放式 **diarization**（不知道几个人、还要切时间轴）。后者更难；前者对 PWA 更现实。

**默认：PWA 本地 verification**

| 方案 | 说明 | 体量 / 延迟 |
|------|------|-------------|
| **生产默认**：Sherpaw + [CAM++](https://huggingface.co/moeru-ai/sherpaw-campplus-zh-en-advanced) | 192 维 embedding，固定 revision，默认阈值 `0.60` 并保留迟滞 | 权重约 28 MB |
| 历史基线：[`Xenova/wavlm-base-plus-sv`](https://huggingface.co/Xenova/wavlm-base-plus-sv) FP32 | 512 维 embedding；保留为研究对照，不再生产加载 | 权重约 384MB；本地 held-out score overlap 明显 |
| [`@jaehyun-ko/speaker-verification`](https://github.com/jaehyun-ko/node-speaker-verification)（HF NeXt-TDNN ONNX） | enroll / embedding / cosine | mobile 数 MB；单次约几百 ms |
| [Picovoice Eagle Web](https://picovoice.ai/docs/quick-start/eagle-web/) | 商用 on-device，帧级打分 | 延迟低；需 access key |
| 自建 ECAPA / WeSpeaker → ONNX + `onnxruntime-web` | 最灵活 | 可量化控体积 |

Sherpaw 在 Worker 中执行声纹提取。Web 启动时缓存模型，macOS 从安装包读取。旧模型的声纹需要重新录入。

**云 API：verification 近乎空白**

- Azure Speaker Recognition、Amazon Connect Voice ID 等专用声纹云已退场或不可用。
- AssemblyAI / Deepgram 等主要是 **STT + diarization**（标 Speaker A/B），不是「已 enroll 的 user」；还要上云、流式标签可能事后改写，不适合当 F01/F02 主解。

**延迟**：Speaker 闸门本地通常几十～几百 ms / 句，可与 STT 并行；整条链路瓶颈仍是 STT + LLM，不是 speaker。

**与 STT 比难不难**

- 完整 diarization（多人、重叠）往往比 ASR 更脆。
- 你们这种 **1 人 enroll + 二分类** 比多语种 STT **更简单**（固定向量 + 阈值，不依赖语言）。
- 产品风险更大：ASR 错字可改；speaker 判错会乱触候选 / 漏出候选。**不**用 LLM 纠 speaker（成本翻倍且自身会错），**不**做事后纠错；误判对策 = 修 gate 本身（enrollment / 阈值 / 模型 / 安静 demo）。生产 pipeline 仅走声纹 verification，**不**开 manual speaker 分支；Playground 声纹页用于 enrollment 与阈值调参。

**Demo 减误判**：安静环境、两人音色有差、enrollment 念够约 5–10 秒。

#### Enrollment 持久化

**方案**：enroll 一次，embedding 缓存 IndexedDB；提供手动重录按钮。每设备各 enroll 一次，**不**进服务端。

- embedding 是浮点向量（几百 KB），放 **IndexedDB**（非 localStorage——后者只适合小字符串且 5MB 上限、同步阻塞）
- 声纹保存在当前设备的 IndexedDB。换设备后各自录入声纹。

**`packages/speaker` 接口**：

```ts
enroll(audioStream, passphrase): Promise<Embedding>      // 念文案 → 算 embedding
loadEmbedding(): Promise<Embedding | null>               // 从 IndexedDB 读
saveEmbedding(e: Embedding): Promise<void>               // 写 IndexedDB
verify(audioChunk: ArrayBuffer, embedding: Embedding): Promise<VerifyResult>

type VerifyResult = {
  speaker: 'user' | 'other'
  /** Raw cosine vs enrolled embedding — use this for playground threshold tuning. */
  similarity: number
  /** Confidence in the chosen label: `similarity` if user, `1 - similarity` if other. */
  confidence: number
}
```

playground **声纹页**同时覆盖 P0-c（`enroll` + `saveEmbedding`）与 P0-d（自由说话 → `loadEmbedding` + `verify`，展示 `similarity` + 可调阈值即时重判）。端到端自动闸门仍在 P0-f / 实时会话。生产 `apps/web` 开会话时先 `loadEmbedding()`，没有就跳 enrollment 页；设置页提供"重录声纹"按钮。

#### 会话持久化

完整 `ConversationSession` 保存在本机 IndexedDB。正式 turn、候选和生命周期变化即时写入。
会话历史含转写和建议，原始音频只用于实时处理。删除记录只影响当前设备。

**`packages/conversation` 接口**：

```ts
startSession(session): Promise<ConversationSession>
appendTurn(turn): Promise<void>
updateTurnSuggestions(turnId, suggestions): Promise<void>
getActiveSession(): Promise<ConversationSession | null>
pauseActiveSession(reason): Promise<ConversationSession | null>
resumeActiveSession(): Promise<ConversationSession | null>
stopActiveSession(): Promise<ConversationSession | null>
listSessions(): Promise<ConversationSession[]>
loadSession(sessionId): Promise<ConversationSession | null>
clearHistory(): Promise<void>
```

- **开始**：创建新 `sessionId` 并冻结设置；新会话默认开启 AI 建议。
- **暂停**：释放麦克风 / 系统采集，封存有效 partial，保留同一 session、上下文、界面和 AI 开关。
- **停止**：等待已排队的定稿工作，封存 session；下一次开始创建新会话。
- running / paused 在刷新、崩溃或设备中断后恢复为 `pauseReason: 'unexpected'`，可继续或停止。
- 时长不计暂停区间。

实时语音按最多 30 秒的片段处理。

历史列表和详情从会话开始时间与对话语言生成标题，按会话冻结的 `uiLang` 本地化。已有会话也用同一规则显示标题。

### 2.5 提示词（Velin TSX）

`packages/prompts` 内按用途拆分：`reply-suggestions.tsx`、`session-summary.tsx` 等。

Velin 在 **Node / CI / eval** 中 `renderComponent`；浏览器运行时消费渲染后的字符串（或经 API route 渲染）。

### 2.6 提示词迭代（vieval）

`evals/` + 根 `vieval.config.ts`，矩阵维度示例：

- `level`: beginner | intermediate | advanced（及历史 JLPT 对照用例可映射）
- `conversationLang` / `meaningLang`: 当前评测仍以 ja↔zh 为主；en/zh 套件后置
- `model`: agent-mini | agent-large
- `historyDepth`: 0 | 2 | 5

重点测：用户上轮 STT 是否进入下轮建议、难度是否达标、ja 时 furigana/助詞质量。

### 2.7 开发 Playground（功能验证 + 产品 UI 试炼）

**背景**：整产品（`apps/web` + 完整页面流）在原型图 / UI 设计定稿前**跑不起来**，也不该为了调一个模块就把全应用拉起来。参考 [AIRI `dev:ui`](https://airi.moeru.ai/ui/)（Histoire 测 `stage-ui` 组件），我们要的是**另一层 playground**——主测**能力模块**，并逐渐承接**产品 UI 组件预演**（便利贴候选、声纹向导等），不是只测 shadcn 按钮长什么样。

| | AIRI `dev:ui` | 本项目 `apps/playground` |
|---|---|---|
| 目的 | UI 组件库隔离预览（Story / Variant） | 语音与对话 pipeline 功能验证 + 产品面视觉试炼 |
| 典型内容 | Input、Chat History、Level Meter… | VAD、STT、声纹录入+同页验证、说话人判定、LLM 出候选 |
| 界面要求 | 接近成品视觉 | **产品主舞台须精致**（纸感 / 品牌黄 / 便利贴）；实验室可高密度，但同壳不可糊弄。详见 [Playground 视觉重构](./playground-visual-refactor.md) |
| 与主应用关系 | 与 `stage-web` 并行 | 与 `apps/web` 并行；**共用 `packages/*`** |

**原则**

1. **先小后大**：先把可独立验证的模块在 playground 里打通，再接到完整会话流。
2. **能力优先，视觉跟进**：pipeline 能力已通的模块（尤其 Live、声纹）按 [视觉重构 spec](./playground-visual-refactor.md) 提升到可迁入正式 app 的组件质量；仍允许暴露用户不可见参数，但须与产品面分层。
3. **UI 组件库 Story 后置**：`packages/ui` 的 Storybook / Histoire 类工具**以后再做**；不阻塞 pipeline，但 shadcn 组件与 design token 须在 playground 实战中补齐。
4. **Playground 可拆页**：每个模块一页或一个 tab；删除已冗余的管线模拟器；Live = 产品主舞台，VAD/直连 = 实验室。

**建议页面 / 模块（按开发顺序）**

| 阶段 | Playground 页 | 验证什么 | 对应需求 |
|------|---------------|----------|----------|
| P0-a | 麦克风 + VAD | 一句结束检测、切段预览 | F03 前置 |
| P0-b | STT | 录音 → 转写、可手改文本 | F03 |
| P0-c | 声纹 Enrollment（同页） | 读固定文案 → 存 embedding | F01 |
| P0-d | 说话人判定（同声纹页） | 自由说话 → `user` \| `other` + raw `similarity` + 阈值即时重判 | F02 |
| P0-e | LLM 回复候选 | mock 对话历史 → 3 条候选 **或** `[]` 跳过 | F04、F06 |
| P0-f | 串联 Pipeline | VAD → speaker → STT → **任一** speaker 入库后请求 LLM（空数组则不刷新候选） | F02–F05 |
| 后续 | 组件库 Story | shadcn 封装稳定后再加，类似 AIRI `dev:ui` | F10 视觉层 |

**根脚本示例**

```json
{
  "scripts": {
    "dev:playground": "pnpm -F @lrc/playground dev",
    "dev:web": "pnpm -F @lrc/web dev"
  }
}
```

**与 `apps/web` 的分工**

- **`apps/playground`**：开发期工具 + 产品 UI 试炼；可注入 mock、暴露原始 embedding / 中间日志与调试旋钮；视觉按 [playground-visual-refactor.md](./playground-visual-refactor.md)（纸感主舞台 / 实验室分层）。**不**承担 PWA / 上架形态。
- **`apps/web`**：等产品 UI 定稿后，把已在 playground 验过的 `packages/pipeline`、`packages/speaker`、`packages/llm` 与可复用 UI 组件 **接进正式路由**；用户看到的才是 F10/F11 那套界面。

```text
packages/pipeline、speaker、llm、conversation  （真实实现）
        ↑                    ↑
 apps/playground          apps/web
 （极简 UI，先调通）    （原型定稿后的产品壳）
```

### 2.8 本地语音

Sherpaw 在 Worker 中进行 VAD 和本地模型转写。使用 Apple Speech 时，桌面主进程通过 xsAI Apple Speech 接收每段语音的 PCM 并流式转写。CAM++ 在独立 Worker 中提取声纹。
Sherpaw 模型按固定版本下载至 IndexedDB，Apple Speech 语言资源由 macOS 管理。音频不发送给回复模型。
使用系统音轨与麦克风双路输入时，两个音轨各有独立 VAD 与识别流。

### 2.9 回复模型配置

在「设置 → 模型」选择服务商和模型，或手填 OpenAI 兼容 Base URL 与模型 ID。
API Key 由用户提供。Web 保存在当前浏览器并直连，端点限制 CORS 时提示使用 macOS。
macOS 通过 Electron 主进程发送请求，并在本机加密存储 Key。

---

## 3. 平台与 Electron

### 3.1 需求拆分

| 能力 | Web / PWA | Electron |
|------|-----------|----------------|
| iPhone 麦克风 | ✅ | — |
| Mac 浏览器麦克风 | ✅ | — |
| Mac **系统声音** | ❌ | ✅ ScreenCaptureKit 等 |
| 一套 UI 代码 | ✅ `packages/*` | ✅ 同一批 `packages/*` |

### 3.2 结论：Web / PWA + macOS Electron

1. **移动端只需麦克风** → **PWA 足够**（Safari `getUserMedia` + 添加到主屏幕）。
2. **桌面浏览器也要做** → `apps/web` 响应式布局，Mac 打开 URL 即可演示。
3. **系统音频与状态栏工具形态** → `apps/desktop` Electron 薄壳；**与 web 共用 packages**，不是嵌 web 的静态 dist 壳（对齐 AIRI tamagotchi 模式）。

### 3.3 为何选 Electron

- 路路有 Electron 经验；[AIRI `stage-tamagotchi`](https://github.com/moeru-ai/airi)、[DeepChat](https://github.com/thinkinaixyz/deepchat) 均为先例。
- Mac 系统音需由主进程注册 loopback capture，再把独立音轨交给渲染进程 VAD / STT。

```text
Web / PWA：apps/web
macOS 状态栏应用：apps/desktop（Electron，共用 packages）
```

### 3.4 三端交付

| 端 | 工程 | 用户怎么打开 |
|----|------|--------------|
| iPhone | `apps/web` + PWA | Safari → 添加到主屏幕 |
| Mac 浏览器 | `apps/web` | 访问 URL |
| Mac 系统音 | `apps/desktop` | 安装 .dmg |

---

## 4. UI 与开发顺序

### 4.1 产品 UI（已按确认原型落地）

- 页面与组件在 **`packages/pages` + `packages/ui`**，`apps/web` 只负责挂载。
- Web 宽屏采用 A+B：顶部控制固定，完整对话与建议舞台等高、分别内部滚动；对话按钮始终可见并可用同一按钮展开 / 收起。
- Web 窄屏采用单栏建议舞台；对话按钮在内容区打开 / 收起响应式对话层。Web 不做上下翻转。
- 桌面透明窗口默认 `420 × 640`，范围 `360 × 420` 至约 `680 × 当前工作区高`，按显示器记忆位置和尺寸；八向不可见命中区缩放，悬浮时才显示连续细边框，不显示四角圆点。
- Island 水平居中，只通过四向箭头把手拖动。拖动松手后按 Island 所在半屏翻转内容，并保留中线滞回；转写永远位于所有便利贴上方。
- 便利贴所有端保持正直、不重叠。按可用高度最多显示当前 + 两轮旧卡；旧轮逐级透明，最旧底部渐隐；旧轮不可点击。骨架复用最终三候选结构。
- 日语候选用 `segments` 显示汉字假名与助词高亮。
- 设置、历史、权限、错误、停止 / 退出确认均复用 `packages/pages` 与 shadcn 组件，不在 apps 内平行重造。

### 4.2 推荐开发顺序

**阶段 A — Playground 打通核心能力（不等完整 UI）**

1. 搭 `apps/playground` + `packages/pipeline` 骨架  
2. VAD → STT（F03）  
3. 声纹 enrollment + 说话人判定（F01、F02）  
4. mock 对话流 + LLM 出 3 条候选或 `[]`（F04、F06）  
5. 串联：user / other 均可触发教练请求（F04、F05）  

**阶段 B — 产品壳（原型定稿后）**

6. 按原型实现 `packages/pages` + `packages/ui`  
7. `apps/web` 接入已验过的 packages；桌面浏览器调通完整流程  
8. 收窄 viewport / 真机 Safari 验 PWA（F10、F11）  
9. 结束回顾（F09）  

**阶段 C — 加分与工具**

10. P1：`apps/desktop`（系统音）  
11. 可选：`packages/ui` 组件 Storybook（类 AIRI `dev:ui`），与 playground 分工明确  

**要点**：整项目一时跑不起来是预期状态；**先在 playground 把「听 → 认人 → 转写 → AI 答」最小闭环做实**，UI 抛光与三端交付叠在后面。

---

## 5. 风险与对策

| 风险 | 对策 |
|------|------|
| 双人同麦 / 短句 / 音色接近导致 speaker 误判 | 本地声纹 verification + 阈值调参；安静 demo；enrollment 念够 5–10 秒；必要时换 NeXt-TDNN mobile / Eagle 等更稳模型；测 user↔other 混淆率。**不**用 LLM 纠 speaker；**不**做事后纠错；生产仅声纹判定，Playground 声纹页用于 enrollment / 阈值调参 |
| PWA 本地模型体积大 / iOS 慢 | 权重按需下载并缓存，设置显示模型大小和语言。可在会话前预下载。 |
| 权限延后申请被拒 / 打断录音 | 首次设置与录入流程中按平台申请所需权限。 |
| PWA iOS 后台杀进程 | 每轮即时写 IndexedDB；重开后以意外暂停恢复同一会话 |
| 桌面双路重复收音 | mic 与 system 分 lane、不混音；提示佩戴耳机并保留 echo cancellation；MVP 不做文本跨源去重 |

---

## 6. 待与神奈子确认

1. ~~MVP 是否接受浏览器 + PWA，Electron 仅 P1？~~ **已确认**：Web / PWA 与 macOS Electron 均落地。
2. ~~候选不可编辑，改为「换一批」是否 OK？~~ **已确认**：候选不可编辑，也不做「换一批」或点选 / 高亮。
3. 演示是否固定「便利店 3 轮对话」脚本？  

---

## 相关

- [产品想法原文](../brainstorm/2026-07-16-live-reply-coach-language-assist.md)
- [AIRI 插件 UI 范围](../notes/2026-07-16-airi-plugin-ui.md)
- 参考仓库：[airi](https://github.com/moeru-ai/airi) · [webai-realtime-voice-chat](https://github.com/proj-airi/webai-example-realtime-voice-chat) · [velin](https://github.com/moeru-ai/velin) · [vieval](https://github.com/vieval-dev/vieval) · [deepchat](https://github.com/thinkinaixyz/deepchat)
- Speaker 本地：[WeSpeaker ResNet34-LM](https://huggingface.co/Wespeaker/wespeaker-voxceleb-resnet34-LM) · [speaker-verification](https://github.com/jaehyun-ko/node-speaker-verification) · [Eagle Web](https://picovoice.ai/docs/quick-start/eagle-web/) · [wavlm-base-plus-sv](https://huggingface.co/Xenova/wavlm-base-plus-sv)
