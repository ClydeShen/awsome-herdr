# awsome-herdr 需求整理

整理于 2026-11-25，**同日定稿**。这是需求和决定的汇总。**第 2 节是所有面板共用的设计系统和交互模式**，各面板只写自己特有的部分；两处不一致时以第 2 节为准。执行计划见第 5 节。

状态标记：✅ 已完成或已确认　🟡 原型已做、未提交　⬜ 未开始　❓ 待你决定

示意画板（**只帮助想象，不是另一份来源**，细节以本文件为准；画板里和第 2 节不一致的旧画法见 §2.8）：https://claude.ai/artifact/2J2Z23i8ahKnSxhkkhdSph

---

## 1. 文档分工（每件事只有一份唯一来源）

| 内容 | 唯一来源 | 说明 |
|---|---|---|
| 工作规则（胶水优先、三平台、设置走 awsome-config、安全约定）、Herdr 能做什么和不能做什么、踩过的坑 | **`CLAUDE.md`** | 每次会话自动读入 |
| 需求、决定、设计系统和交互模式、键位、执行计划、待决事项 | **本文件** | 不重复抄 `CLAUDE.md` 里的规则 |
| 颜色的具体色值 | **`themes/awsome.json`**（以及布局里的 `colors` 覆盖） | 本文件只写"用哪个令牌"；唯一的例外是 §2.4 的 6 个标记色 |
| 参考项目的借鉴边界 | 第 7 节 | — |

不另建 `design-system/MASTER.md`：设计系统就是本文件第 2 节加 `themes/awsome.json`。

---

## 2. 设计系统和交互模式（所有面板共用）

### 2.1 原则

1. **贴近 Herdr 原生**：能用 Herdr 自带的组件和 mod 就用（`confirm`、`notify` toast、`tooltip`、`Popover`、`pickFiles`），尺寸、圆角、用语跟 Herdr 自带界面一致。我们的界面放进 Herdr 里，应当像是它本来就有的。
2. **极简、克制**：一行只放必要的东西；不做彩色标签、竖线装饰、渐变、装饰动画；同一种意思只有一种画法（§2.3）。
3. **常识优先**：行为跟文件管理器、VS Code、浏览器一致（单击选中、Ctrl/Shift 多选、F2 重命名、Enter 打开、Esc 取消、Backspace / Enter 系列管文件夹的进出）。**不发明新手势**，不让同一个手势在不同面板里意思不同。
4. **最少步数**：常用动作 1～2 步；危险动作多一步确认，但只多一步。
5. **不只靠颜色**：状态、选中、当前项都有颜色之外的第二个线索（字形、粗细、描边、删除线、提示文字）。

### 2.2 尺寸和字体

| 项 | 数值 |
|---|---|
| 栅格 | 4px |
| 行高 | 树（Files、Changes 的文件树）**22px**；列表（侧边栏的 space、agent，Repositories）**28px**，和 Herdr 自带的 spaces 一致 |
| 缩进 | **每级 12px，所有树和分组都一样**；多级的树画缩进参考线（Files、Changes、Agents 的 sub agent），只有一级的分组（space 组）不画 |
| 字号 | 11（次要文字、区块标题）、12.8（菜单项，和 Herdr 菜单一致）、13（行内容）、15（对话框标题，和 Herdr `confirm` 一致） |
| 字体 | **Geist**（界面）+ **JetBrains Mono**（路径、哈希、数字、快捷键），都随 Herdr 自带 |
| 圆角 | 行 4px；菜单 7px、对话框 8px（和 Herdr 一致） |
| 图标 | UI 控件用 **Phosphor regular，14px**；文件、文件夹、程序图标用 **Material**。都放在共享的 `awsome-icons/`，按路径读 |
| 按钮 | 三种：主要（实心 `accent`）、次要（描边）、图标按钮（22px 点击区，悬停才显示底色，**必须有 tooltip**）。高度：对话框里 32px（和 Herdr 一致），面板里 24px |
| 动效 | 悬停 ≤150ms；除 agent"工作中"的呼吸动画外，不做装饰动画 |

### 2.3 行的状态（所有列表和树只有这一套）

| 状态 | 画法 | 说明 |
|---|---|---|
| 默认 | 无底色；正文 `foreground`，次要文字 `dim` | |
| 悬停 | 叠一层 `hover` | |
| 选中（单选或多选） | 叠一层 `selected` | 多选和单选画法相同 |
| 当前（只在"当前"和"选中"可能不同的地方：侧边栏的当前 space） | **名字加粗** | 不用颜色、不用描边 |
| 键盘光标 / 多选的锚点 | **1px `accent` 内描边**，只在这个列表有键盘焦点时显示 | 和 VS Code 一致；**不用左边竖线** |
| 禁用 | `dim` 文字，tooltip 写原因 | |

- 悬停和选中的行，**次要文字从 `dim` 换成 `muted`**，否则叠层会把对比度压到 AA 以下。实测：只用 `dim` 时悬停最低 4.0:1、选中最低 3.7:1，不达标；换成 `muted` 后深色主题最低 5.1:1、浅色主题最低 5.7:1。
- **不画**：左边的竖线、2px 的彩色描边环、整行实心色块。

### 2.4 颜色

- **一律用 `theme()` 的语义令牌**，不写死色值（`CLAUDE.md` 的规则）。
- **Git 状态：全局唯一一套 5 种**，用在 Files、顶部汇总、Changes、Recent、Repositories 五处：

| 状态 | 令牌 | 颜色之外的线索 |
|---|---|---|
| Modified | `ansi3`（黄） | 悬停提示写明状态 |
| New（已暂存的新增和未跟踪合并） | `ansi2`（绿） | 同上 |
| Deleted | `ansi1`（红） | **删除线** |
| Renamed | `ansi6`（青） | 悬停提示 |
| Conflict | `ansi5`（洋红） | 悬停提示 |

  状态就是**名字的颜色**，默认不画字母、不画小点；设置里有可选的"名字后显示状态字母"（`row.statusLetter`，默认关）。文件夹和 repo 取里面最严重的状态（冲突 > 删除 > 修改 > 新增）。
- **Agent 状态**：工作中 `working`、需要你 `blocked`、完成 `ansi2`、空闲 `dim`，画成状态点，旁边配文字（`2m`、`needs you`、`done`、`idle`）。
- **标记色（space 和组的颜色，唯一允许的非令牌颜色）**：无 + 6 个色相（teal、orange、blue、purple、green、pink，沿用 Herdr 侧边栏现有的那 6 个），**只在一处定义**，深浅两套。用法是行的**淡底色**（深色主题 12%、浅色 14%）。对比度实测：深色主题次要文字最低 4.7:1、正文 ≥ 10:1；浅色主题次要文字最低 4.9:1；都过 AA。更深就不达标（16% 时 4.39），所以浓度固定。存色名，渲染时取当前主题那一套。**标记色不表达状态**，所以不用红黄绿的 ansi 令牌，免得和 Git 状态混淆。

### 2.5 文字和用语

- **所有界面文字用英文**（按钮、菜单、提示、对话框、设置项、通知）；文档和对话用中文。
- **Sentence case**，和 Herdr 一致：`Close space…`、`New group…`、`Copy relative path`、`Stage changes`、`Discard changes`。
- **省略号 `…`**：点了之后还要再输入或确认的动作才带（`Rename…` 例外：行内编辑，不带）。
- **数字要有标签**：树里的文件夹、space 组头**不画裸数字**（明细放进悬停提示）；只有意思约定俗成的计数徽标可以用裸数字（Changes 标签的改动数、Repositories 行的改动数），并且悬停时写全。
- **按平台写的叫法**：`Reveal in File Explorer`（Windows）/ `Reveal in Finder`（macOS）/ `Open in file manager`（Linux）；`Recycle Bin` / `Trash`。Files、Changes、侧边栏用同一套叫法。
- **快捷键的写法**：菜单右侧、tooltip 括号里，等宽淡色，如 `Up a folder (Ctrl+Alt+Backspace)`；macOS 上显示 `⌘` 等符号。
- tooltip 只放纯文字，不放可点击的内容。

### 2.6 交互模式

**选择**（Files、Changes 的文件、侧边栏的 space 都一样）：

| 操作 | 结果 |
|---|---|
| 单击 | 选中它并执行它的主动作（文件 = 预览，space = 切换，文件夹 / 组头 = 展开或折叠） |
| Ctrl（macOS Cmd）+ 单击 | 加入 / 移出选中集合，锚点移到它，**不执行主动作** |
| Shift + 单击 | 从锚点到这里，**按可见顺序**连续选中（跳过折叠起来的项） |
| Shift + ↑ / ↓ | 用键盘扩展选择（有键盘导航的列表） |
| Esc / 点空白处 | 清空选中 |
| 右键未选中的项 | 选中集合先变成它（不执行主动作），出**单项菜单** |
| 右键已选中的项（选了 ≥ 2） | 出**多选菜单** |

- **双击**只在 Files 里有意思：文件 = 固定成 tab。会展开或折叠的行（文件夹、组头）**双击没有别的意思**，免得一次双击触发两次折叠。

**键盘**（只在面板有焦点时生效，不抢终端的按键）：

| 键 | 意思 |
|---|---|
| Enter | 主动作（打开、展开） |
| F2 | 重命名（文件、space、组） |
| Delete（macOS Cmd+Backspace） | 删除到回收站（只在 Files） |
| Ctrl+Alt+Backspace / Ctrl+Alt+Enter | 上一级 / 进入文件夹（只在 Files） |
| Ctrl+Z（macOS Cmd+Z） | 撤销新建、重命名、移动（只在 Files） |
| Esc | 取消编辑、关闭弹层、清空选中 |

**右键菜单**：
- 顺序固定：**打开类** → **新建类** → **编辑类**（Rename、Appearance）→ **整理类**（Group、Send to agent）→ **复制 / 定位类**（Copy path、Reveal）→ 分隔线 → **危险类**（红色，放最后，带 `…`）。
- **只显示对所选全体都成立的动作**；对这类对象**不适用**的项隐藏，**暂时不可用**的项变灰并在 tooltip 写原因（如 `Stage changes first`）。
- 菜单的样子和 Herdr 自带菜单一致（字号 12.8、圆角 7、快捷键右对齐淡色）。

**拖拽**（Files 移动文件、侧边栏的 space 和组、标签栏都一样）：
- **按下后移动超过 6px 才开始拖**，不要求按住多久（桌面上的常识；按住计时会让拖拽变迟钝）。`awsome-tabs` 现有的按住延迟统一成这个规则。
- 拖**已选中的项** = 整个选中集合一起走，跟手的小标签写 `3 items` / `3 spaces`；拖**未选中的项** = 只拖它。
- **插入位置**：2px `accent` 的线；插在容器（文件夹、组）里面时线跟着缩进。**放进容器**：容器行加 1px `accent` 描边。不能放的地方没有任何高亮，光标显示禁止。
- Esc、拖回原位、拖到列表外 = 取消。
- **不靠拖拽创建东西**（拖一个 space 到另一个 space 上不会建组；建组、新建文件都走菜单）。

**确认对话框**（全局只有一种，样子和行为跟 Herdr 的 `confirm` 一致）：
- 标题是问句，带数量：`Move 3 items to the Recycle Bin?`、`Discard changes in 2 files?`、`Close 3 spaces?`。
- 正文列出受影响的名字（超过 8 个折叠成 `+N more`），必要时一句后果说明。
- 按钮：`Cancel` + **写明动作的红色按钮**（`Move to Recycle Bin`、`Discard changes`、`Close spaces`）。**Enter 确认、Esc 取消**，和 Herdr 一致。
- `Don’t ask again` **只出现在可以找回的动作上**（删除到回收站）；不可逆的动作（discard）没有这个选项，只能在 awsome-config 里关。
- 只是一个 Herdr 命令的动作（关一个 space），直接用 Herdr 自带的 `confirm`。

**反馈**：
- 后台完成的动作用 Herdr 的 `notify` 发一个短 toast（`Moved 3 items to the Recycle Bin`）；出错留在原处显示（对话框里、行内），不弹额外的警告框。
- 加载中写 `Loading…`；空状态写一句话说明怎么开始。
- **撤销只给低风险的文件操作**（新建、重命名、移动）；删除进回收站，不提供撤销；侧边栏的整理（分组、颜色）用拖拽或菜单就能改回，不做撤销。

### 2.7 各面板的布局（要点）

- **整体**：保持"左侧 Spaces + Agents ｜ Files / Changes 面板 ｜ 终端区"，每个区块用 VS Code 的视觉语法：大写小号的区块标题、折叠箭头、悬停才出现的操作图标。
- **Files**：标题行（根文件夹名 + 图标按钮）、汇总、过滤框、树。见 §4.3。
- **Changes**：分段控件 `Changes | History`、提交框在顶部、`Staged changes` / `Changes` 两组。见 §4.5。
- **侧边栏**：space 行是图标（或小圆点）+ 名字 + 分支，可有淡底色；agents 按 space 分组，sub agent 缩进。见 §4.2。
- **标签栏**：扁平标签，选中项底部一条 `accent` 线；预览标签用斜体。
- **预览**：顶部面包屑路径，工具栏只留 3 个图标。
- **设置对话框**：左侧列表加搜索框。

### 2.8 统一时改掉的旧画法（画板里还能看到，以本节为准）

| 旧画法（出现在） | 改成 | 原因 |
|---|---|---|
| 锚点 / 当前 repo 用左边蓝竖线（画板 03、12） | 选中 = `selected` 叠层；锚点 = 1px `accent` 内描边 | 一种意思一种画法 |
| 当前 space 用 1px 灰描边 + 加粗（画板 13、14） | 只加粗 | 描边留给键盘光标 |
| 组头显示成员数（画板 13、14） | 不显示，悬停提示写 `3 spaces` | 不画裸数字 |
| 双击组名重命名（画板 14） | `F2` 或右键 `Rename` | 点组头已是折叠，双击会折叠两次 |
| 组成员缩进 16px（画板 13） | 12px | 全局一个缩进值 |
| 拖拽要按住 200ms（画板 14） | 移动超过 6px 即开始 | 桌面常识，不迟钝 |
| Discard 对话框默认焦点在 Cancel（画板 08） | Enter 确认，和 Herdr 一致 | 只有一种对话框行为；discard 前自动留 git 快照，可以找回 |
| 状态"永远配字母 A / M / D"（旧 §2.1） | 状态 = 名字颜色 + §2.4 的第二线索，字母可选 | 已在 §4.3a 确认 |
| 菜单项首字母大写（`Discard Changes`、`Stage Changes`、`Open File`） | sentence case | 和 Herdr 一致 |
| 中文的界面文字（"已移到回收站"、"结果已截断"） | `Moved to Recycle Bin`、`Results truncated` | 界面只用英文 |

---

## 3. awsome-config（设置对话框）✅

基于上游 `better-config`，已提交（`269638b`）。

- 读各 mod 的 `mod.schema.json`，生成开关、加减数字、下拉、文本框，保存前校验，写回各 mod 的 `mod.json`；改过的值有圆点，可单项或整体重置。
- 设置项可以**绑定快捷键**（`format: "key"` + `x-action`，写进 `keys.json`）。
- **快捷键：`` Shift+Alt+` ``**，已确认能用（Herdr 在 Windows 上把它叫 `alt-~`，见 §8 的键名规则）。原来的 `Alt+Shift+,` 写成了 `alt-shift-,`（应是 `alt-<`），所以没反应，已换掉。Herdr 的命令面板不列 mod，不能靠它打开。
- **设置入口按钮**（⬜，P0）：布局里 `sidebar-footer` 块的 `mod` 从 `workspace-chrome` 改成 `awsome-sidebar`，传 `props: { view: "footer" }`；底栏三个图标按钮 `Settings`、`Mod settings`（打开 awsome-config）、`Add machine`，各有 tooltip。只改布局，不写新代码，还省一半底栏高度。
  - 验收：点底栏的设置图标能打开 awsome-config；换主题或缩放后图标仍清晰可点。
- **两个容易混的设置改名**（P0）：`Git refresh`（Changes 列表的轮询）→ `Changes list refresh`；`Git retry`（侧边栏分支的兜底轮询）→ `Sidebar branch check`。多 repo 做起来时统一成"监听为主、慢速兜底"。

后续每个功能的设置项都要先在对应 schema 里描述。

---

## 4. 各 mod 的需求

### 4.1 总览

| mod | 现状 | 本轮要做 |
|---|---|---|
| awsome-sidebar | Spaces 列表；agents 区块还用 Herdr 自带的 `agents` | §4.2 |
| awsome-filetree | 树、汇总、过滤、Recent、Git 状态；🟡 原型 | §4.3、§4.4、§4.7 |
| awsome-viewer | 预览标签页（预览、Keep、在编辑器打开） | §4.4 |
| awsome-changes | Changes / Commits 两个标签页，stage、commit、amend，左右分栏 diff | §4.5、§4.6 |
| awsome-tabs | 可拖拽、可换行的标签栏 + Files/Changes 按钮 | §2.7 |
| awsome-menu（新） | — | space 右键菜单和标签栏 `+` 共用的菜单，§4.2.3 |

### 4.2 awsome-sidebar ✅（设计已确认）

> 画板 13（菜单、分组、颜色与图标）、14（选择、右键菜单与拖拽）、15（平铺）。

#### 4.2.1 侧边栏本身

- **Spaces**：图标（没设就是一个小圆点）+ 名字 + 分支（右对齐），可有淡底色（§2.4）。没有彩色方块头像。当前 space 名字加粗（§2.3）。
- **Agents 按 space 分组，sub agent 缩进**（每级 12px + 参考线），状态点见 §2.4。点 sub agent = 在新 pane 里看它（`terminal.keep`）。上游的 `awsome-sidebar/views/agents.js` **已经写好**（按 space 分组、按名字前缀分组、树状缩进、父 agent 显示最紧急的子 agent 状态），**只差接线**：布局里把 `agents` 块改成 `awsome-sidebar` 并传 `props: { view: "agents" }`。
- **底栏**：见 §3。

#### 4.2.2 外观（`Appearance…`）

- **一个小弹层**：上面一排 7 个色点（无 + 6 色，§2.4），下面 5×5 图标；选了立即生效。space 和组共用，**组只有颜色，没有图标**。
- **图标固定 25 个 Phosphor**，颜色和该行文字同色：folder-simple、code、terminal-window、globe、database、hard-drives、cloud、rocket-launch、flask、bug、book-open、shield-check、cpu、robot、cube、package、wrench、gear-six、chart-line-up、lightning、star、house-simple、briefcase、paint-brush、game-controller。
- **存储**：按**文件夹（+ 机器）**存，space 关了再开样子还在；同时写入 `space.colors`，兼容 Herdr 自带的菜单。

#### 4.2.3 选择与右键菜单

选择规则见 §2.6（单击 = 切换到该 space；Ctrl + 单击不切换；Shift 选一段只在同一台机器内）。

| 右键点在 | 菜单 |
|---|---|
| 一个 space | **单项菜单**（下面） |
| 选中的 space（≥ 2） | **多选菜单** |
| 组头 | `Rename`、`Appearance…`（只有颜色）、`Collapse` / `Expand`、`Ungroup` |
| 空白处 | `New space` |

- **单项菜单**：上半部分和标签栏的 `+` 菜单**是同一个**，只是在被点的 space 里打开：
  - **`Terminals`**（按类型分行）：Windows 上 `PowerShell 7`、`Windows PowerShell`、`Command Prompt`、`Git Bash`，以及**每个 WSL 发行版一行**（`Ubuntu`、`Debian`…，标 `WSL`）；macOS / Linux 上 zsh、bash、fish 等。默认的标 `Default`。Herdr 自己的 `+` 只有一个 `Terminal`，所以这份列表由我们生成。
  - **`Agents`**：来自 `knownAgents()`，未安装的变灰并写 `not installed`，数字键直接启动。
  - 点一行 = 在**这个 space** 里**新开一个 tab**（`tab.new {space, argv}`，和 Herdr 一致，不分屏）。
  - `New worktree…` / `Open worktree…`（Herdr 自带）。
  - 下半部分是 space 自己的操作：`Tile agents (N)`（§4.2.5）、`Rename`（F2）、`Appearance…`、`Group ▸`、`Reveal in File Explorer`、`Copy path`、`Close space…`（红色，用 Herdr 自带的 `confirm`）。
- **多选菜单**：`Appearance…`（一次应用到全部）、`Group ▸`、`Copy path`（每个一行）、`Close N spaces…`（确认对话框列出名字，并标出**有 agent 正在运行**的）。不显示 Terminals、Agents、worktree、Rename、Reveal、Tile。
- **`Group ▸` 子菜单**：已有的组（当前所在的打勾）、`New group…`（把选中的**全部**放进新组，组名立刻进入编辑，颜色自动选一个没用过的）、`Remove from group`（选中里有组成员才显示）。
- **终端发现**（平台适配表的一项）：Windows 用 `where` 查 pwsh / powershell / cmd / bash / wsl，WSL 发行版用 `wsl -l -q`（输出是 UTF-16，要去掉空字符）；macOS / Linux 读 `/etc/shells`。可手动加、隐藏：`terminals.profiles`（名字 + 启动命令）、`terminals.hide`。
- **标签栏的 `+` 和单项菜单的上半部分用同一份代码**，做成独立的 `awsome-menu`（弹出层，props 传 space），`awsome-tabs` 和 `awsome-sidebar` 各自打开。

#### 4.2.4 分组（像 Chrome 的标签组）

- **组头**：一行安静的小标题：折叠箭头、色点、名字（**可留空**）。没有彩色标签、竖线、图标、数字（悬停提示写 `3 spaces`）。**单击组头 = 折叠 / 展开**；重命名用 `F2` 或右键 `Rename`。成员缩进 12px。
- **颜色继承**：space 进组后，**默认底色就是组的颜色**；space 自己设过颜色就保留自己的；在 `Appearance…` 里选"无"回到组的颜色；移出组回到它自己的颜色；改组的颜色，所有没自设颜色的成员一起变。
- **折叠**：只剩组头；**组里有 space 需要你时，组头显示红点**（`blocked`）；Agents 列表不受折叠影响；选中（切换到）折叠组里的 space 时，组自动展开。
- **新建组只走菜单**（`Group ▸` → `New group…`）。**不做** `Close group`（会连带关掉正在跑 agent 的 space）。
- **拖拽**（通用规则见 §2.6）：

| 松手位置 | 结果 |
|---|---|
| 组头 | 加到该组末尾（折叠的组也行，仍保持折叠） |
| 组内两行之间（缩进的线） | 加入该组并插在那里 |
| 组外的行之间（不缩进的线） | **离开原来的组**，放在那里 |
| 别的机器的区块 | 不允许 |

- **拖组头** = 整组连成员一起移动；只能放在组外的行之间，**组不能嵌套**（拖到别的组中间会落在那个组后面）。
- **移出组有三种**：把成员拖到组外；`Remove from group`；组头的 `Ungroup`（成员原位留下，恢复各自的颜色）。最后一个成员离开，组自动消失。
- 松手后用 `space.move` **真的调整 Herdr 的 space 顺序**，让可见顺序和 `Alt+数字` 一致（worktree 嵌套现在就是这么做的）。**worktree 跟着它的主 space 走**，一整家人一起进出组。没有键盘拖拽，键盘用菜单。
- **边界**：组只在同一台机器的区块内；成员关系按文件夹（+ 机器）记，space 关了再开仍在组里；数字快捷键按全部 space 编号（含折叠的）。
- **常用动作的步数**：加入或移出组 = 拖 1 次；新建组 = 选中 → 右键 → `New group…`；改颜色 / 图标 = 右键 → `Appearance…`；折叠 = 点组头；重命名 = `F2`。

#### 4.2.5 平铺：把 space 里的 agent / 终端集中到一个画面（**先做小验证**）

- **做法**：用 Herdr 的 `openOverlay` 开一个**浮动窗口**，里面是这个 space 的终端，每个一块 `{ terminal: id }`，自动排成网格（1 个全屏，2 个左右，3～4 个 2×2，更多 3 列）。**不搬动任何 pane**，所以"复原"就是关窗口，原来的 tab 和分屏 100% 原样。
- **入口**：space 右键 `Tile agents (N)`（没有 agent 时写 `Tile terminals`）；**快捷键开关**（再按一次关闭），默认 `Ctrl+Alt+G`，可在 awsome-config 改，**上机实测后定**。
- **范围**：该 space 里所有 agent（含 sub agent）；没有 agent 就平铺所有终端。设置项 `tile.include`：`agents`（默认）/ `all`。
- **每一块**：小标题（名字、状态点、时间）；**需要你的排最前并自动聚焦**；点一块 = 键盘进入那块；标题上的 `Open in its tab` 跳回它真正所在的 tab 并关窗口。窗口用 `key` 记住大小和位置。
- **为什么不真的搬进一个 tab**：Herdr 没有"把 pane 移到另一个 tab"的命令，只能 `terminal.park` + `terminal.keep {place: right|down}` 拼，**原来的分屏比例恢复不了**，搬走最后一个 pane 时原 tab 可能被关。以后需要再加 `Gather into a tab`。
- **先做小验证**：同一个终端同时出现在原 pane 和浮窗里是否正常；键盘焦点、Esc 是否被终端吃掉；快捷键是否可用。验证不过就停下来和你商量。

### 4.3 awsome-filetree：视觉和基础操作 🟡

**原型已做（未提交，已同步到你的 Herdr）**：标题栏（根文件夹名 + Tree / Recent 切换 + 5 个 Phosphor 图标按钮：上一级、跟随终端、显示隐藏文件、显示大小、全部折叠，开着的有底色）；汇总（分支 +N −N、2px 细条、计数）；过滤框独立一行；树行高 22、缩进 12、缩进参考线；右键文件夹 `Open as root`。

**进入和退出文件夹（Backspace / Enter 系列，已确认）**：
- **上一级 = `Ctrl+Alt+Backspace`，进入选中的文件夹 = `Ctrl+Alt+Enter`**。单独的 Enter 已经是"展开或打开"，所以导航键带修饰键，不去抢它。Windows 上实测都能到达文件树。
- 原型里还留着旧键位（单独的 Backspace、Shift+Enter、Ctrl+Alt+↑ / ↓），**执行时去掉**，只留上面两个；改成可在 awsome-config 里重绑（§8 实现说明）。
- 上一级之后，光标停在刚离开的那个文件夹上，可以马上按 `Ctrl+Alt+Enter` 回去。

**执行时要验证**：缩进参考线、悬停、键盘光标的描边（§2.3）。

### 4.3a 文件树的行内信息：极简默认，详细可选 ✅

**默认视图：一行只有三样：图标、名字、名字的颜色。** 状态颜色见 §2.4；行数、时间、大小默认不显示。

- **文件夹**：名字取里面最严重状态的颜色，不画数字、不画小点；悬停给明细（`2 modified · 1 new`）。
- 其它标记一种状态一种写法：被忽略 = 名字变灰；隐藏文件 = 名字更淡；符号链接 = 名字后一个小箭头图标。
- **顶部汇总**：分支名、领先落后（`↑2 ↓1`）、一条 2px 的比例细条、**彩色数字加文字**（`3 modified · 1339 new · 2531 deleted`，零值省略）。多 repo 时跟随 Changes 里选中的 repo。

**详细模式（标题栏的滑杆图标开关，记住选择）= 极简 + 三个槽位**：

| 槽位 | 内容 | 规则 |
|---|---|---|
| 行数变化 | `+4 −1` | 只给有改动的文件；文件夹不显示，悬停时汇总 |
| 次要列 | 时间 / 大小 / 无 | 三选一，默认时间。相对时间（`2m`、`3h`、`1d`），所有文件都显示，文件夹显示里面最近一次修改。文件夹大小只在选中或悬停时算（POSIX 用 `du`，Windows 用 PowerShell） |
| "刚动过"小点 | 名字前一个 `accent` 小点 | 最近 N 分钟（默认 10，0 = 关）被修改过的文件；不依赖 hook |

- **对齐**：右侧信息靠右成列，各列固定宽度、右对齐，所有行上下对齐：行数变化（64px，`+N` 和 `−N` 各占固定宽度）在最左，次要列（34px）在右。名字过长在末尾省略，不推挤右边。
- **悬停提示**：极简视图里，悬停一行 = 看到详细模式的全部信息（`Modified · +4 −1 · 2m ago`；文件夹 `2 modified · 1 new · +12 −3`）。用 Herdr 的 `tooltip`（纯文字，贴着这一行，不跟随鼠标，延迟由 Herdr 决定）；手感不对再换 `HoverCard`（默认 600ms 出现、300ms 关闭）。
- **响应式**：只看名字那一列还剩多宽。不足约 120px（面板约 300px）就**整体退回极简**，不做中间状态；拉宽了自动恢复，开关的选择不丢，窄时滑杆图标变灰并在 tooltip 写原因。阈值 `row.detailMinWidth`（默认 300）。
- 每行最多 4 个子元素，渲染预算安全。**Recent 视图**沿用同样的槽位，按 `Today` / `Yesterday` / `Earlier` 分组。
- **agent 读写闪烁层**：去掉（依赖 Claude Code 的 hook，在这台机器上休眠）；"刚动过"小点代替它。以后要 agent 归因，用 Herdr 自己的 `agents()` 做。

**多 repo 的工作区**：
- **子 repo 里的文件用它自己的 Git 状态着色**；repo 的根文件夹名字后一个淡色的**分支小图标**，悬停给 `libs/foo · main ↑1 · 3 modified`。被主 repo 忽略的子 repo 也按它自己的状态着色；子 repo 自己忽略的文件才变灰。
- **实现**：现在 `readGit` 只读根目录一个 repo；改成**对每个已发现的 repo 各读一次**（cwd 设为该 repo），路径加上前缀后合并，文件夹的最严重状态跨 repo 向上累加。repo 列表来自 §4.6 的发现结果，两边共用。
- **易错处**：主 repo 状态里含子 repo 的未跟踪目录会被折叠成一条（`?? libs/`），**不能当成"新增"着色**；这类目录的颜色只由里面的 repo 决定，目录里**其它**未跟踪文件用 `git status -uall -- <目录>` 补读。
- **性能**：每个 repo 多两次 `git` 调用，用各自 `.git` 的文件夹监听触发刷新（`watchFolder`），不轮询；结果按 repo 缓存。`repos.colorFiles`（默认开）、`repos.maxStatusRepos`（默认 10）作为性能保险。
- 文件上的 `Show diff` 和 `Send to agent` 用**这个文件自己的 repo** 当上下文。

**设置项**：`row.detail`（默认关）、`row.lineDelta`、`row.column`（`time` / `size` / `none`，默认 `time`）、`row.recentMinutes`（默认 10）、`row.detailMinWidth`（默认 300）、`row.statusLetter`（默认关）。

### 4.3b 文件树的多选和批量操作 ✅

选择规则见 §2.6。另外：
- **多选时不打开预览**，预览只跟随单选。
- 选中 2 项以上，标题栏下出现**选择条**：`3 selected`，三个动作 `Send to agent`、`Copy path ▾`（`Copy relative path` / `Copy absolute path`）、`Delete…`，最右是清除。
- 折叠文件夹不丢里面已选的项；切换 Tree / Recent / Search 视图则清空选择。
- 拖动任意一个选中项 = 移动全部选中项（§4.4）。

**右键菜单**（只显示对所选全体都成立的动作）：

| 动作 | 选 1 项 | 选多项 |
|---|---|---|
| `Preview` · `Open in default app` · `Reveal in File Explorer` | 有 | 不显示 |
| `Open as root`（仅文件夹） | 有 | 不显示 |
| `New file…` / `New folder…`（仅文件夹） | 有 | 不显示 |
| `Rename`（F2） | 行内编辑 | 不显示（批量重命名暂缓，§10） |
| `Send to agent` | 有 | 有，一次发出 N 个路径 |
| `Copy relative path` / `Copy absolute path` | 各一项 | 仍是两项，每行一个 |
| `Delete…`（进回收站） | 有 | 有 |

- **Send to agent**：默认发给当前 space 的主 agent，子菜单里可以换；复用 `awsome-viewer` 已有的发送机制，多个路径拼成一条消息。
- **删除**：确认对话框（§2.6）：`Move 3 items to the Recycle Bin?`，按钮 `Cancel` / `Move to Recycle Bin`，带 `Don’t ask again`；macOS 上写 `Trash`。完成后 toast `Moved 3 items to the Recycle Bin`。设置项 `confirm.delete`（默认开）。

### 4.4 文件操作和打开方式 ⬜

**打开文件**（awsome-filetree + awsome-viewer）：
- **单击** → 在**当前 tab 里新开一个 pane**（`pane.split`）作临时预览；再单击别的文件，替换这个临时 pane。
- **双击** → 固定成一个独立的 tab（keep）。预览标签用斜体，和 VS Code 一致。
- 文件夹：单击展开 / 折叠，双击没有别的意思（§2.6）；进入文件夹用 `Ctrl+Alt+Enter` 或右键 `Open as root`。

**资源管理器的常见操作**：

| 操作 | 行为 |
|---|---|
| 新建文件、新建文件夹 | 在选中的文件夹下行内输入名字；Enter 确认、Esc 取消 |
| 重命名 | F2 或右键，行内编辑 |
| 删除 | 进系统回收站，确认（§4.3b），不提供撤销 |
| 拖拽移动 | 按 §2.6 的通用规则；放进文件夹时文件夹行加描边。Herdr 的 `on_drop` 只接系统外部拖入，树内拖拽用鼠标事件，参考 `awsome-tabs` 的实现 |
| 撤销 | 新建、重命名、移动支持，`Ctrl+Z`（macOS `Cmd+Z`），只在文件树有焦点时生效，记录逆操作 |

**技术路线**：
- 新建、重命名、移动：Herdr 的 `fs` 只能写 `~/.config/herdr-app`，所以用 `exec` 调系统命令，按 `window().platform` 选 PowerShell 或 POSIX，一个很薄的"平台适配表"。
- 删除到回收站：Windows 用 PowerShell 的 `Microsoft.VisualBasic.FileIO`；macOS 用 `osascript` 的 Finder 删除；Linux 用 `gio trash`。执行前先确认 Herdr 没有现成的回收站接口（目前没发现）。

**设置项**：`confirm.delete`；撤销的开关和键位。

### 4.5 awsome-changes：VS Code 化 + commit message + discard ✅（设计已确认）

> 画板 06（Changes）、07（提交框）、08（Discard）。

- **布局**：标题栏分段控件 `Changes N | History`，右边刷新、列表 / 树切换、更多。**提交框在最上面**（框内右下角两个小图标：`Generate commit message`、`Commit instruction`），下面通栏主按钮 `Commit`（下拉：`Commit (amend)`）。两组 `Staged changes` / `Changes`，可折叠，组头悬停才出现整组操作（`Stage all` / `Unstage all` / `Discard all…`）。
- **树视图（默认）**：按文件夹缩进（§2.2），文件夹在文件前面；**只有一个子目录的链合并成一行**（如 `mods/awsome-filetree`，VS Code 的 compact folders）；文件夹名取最严重状态的颜色，不显示数字；悬停出现整个文件夹的 `Stage changes` / `Discard changes…`。标题栏可切换成**列表视图**（不缩进，名字后面淡色目录）。
- **文件行**：名字用 §2.4 的状态色；右侧 `+N −N` 固定宽度右对齐；**悬停时右侧换成三个图标**（`Open file`、`Discard changes…`（仅 `Changes` 组）、`Stage changes` / `Unstage changes`），不推挤布局。
- **数量上限**：每组最多画 200 个文件（文件夹行另算，实现时要量渲染预算），超出写 `Showing the first 200 of N changed files.`。
- **Commit**：暂存区为空或 message 为空时禁用（tooltip `Stage changes first` / `Enter a commit message`）；`Ctrl+Enter`（macOS `Cmd+Enter`）提交，成功后清空输入框。多 repo 时提交框上方一行 `Committing to <repo>`。
- **生成 message**：点星星图标，读 `git diff --cached`，拼上指令交给 agent；暂存区为空时禁用；**后台运行不冻结**，生成中星星变成停止（Esc 也能取消）；输入框已有内容时结果替换它，`Ctrl+Z` 可恢复；**超时（默认 30 秒）或命令不可用就回退成"用文件名拼一句话"，并在框内写明原因**；diff 截断到 60 KB。
  - **指令二选一**：一段话（`Instruction text`）或一个文件路径（`Instruction file`，用 `pickFiles()` 选、`readTextFile` 读）；两者都填时以 text 为准。agent 和命令可配置（默认 `claude -p`，列表来自 `knownAgents()`）。弹层只是快捷入口，完整设置在 awsome-config 的 Commit message 页。
  - 借鉴 `git-grapher` 的 `generate.js`（只借思路）：`exec` 没有标准输入，所以 diff 拼进提示词；长 diff 后台运行再轮询。**Windows**：上游用 `sh -lic` 找命令，要按平台分支（Windows 用 `where`）。
  - 设置项：agent、命令、instruction（文本或路径）、截断字节数、超时。
- **Discard 按状态**：
  - Modified / Deleted / Renamed → 从 HEAD 还原（`git restore`），确认后执行；**执行前自动留一个 git 快照**（`git stash create`，存成隐藏引用，不污染 stash 列表），出错能找回。设置项 `discard.snapshot`（默认开）。
  - New（未跟踪）→ 移到系统回收站。
  - `Staged changes` 组里的文件**没有 Discard**（先 Unstage）。
  - Conflict → 变灰，tooltip `Resolve the conflict first`。
- **确认对话框**按 §2.6：`Discard changes in 2 files?`，列出文件名，红色按钮写明动作（`Discard changes` / `Move to Recycle Bin` / `Discard all changes`）；**没有 `Don’t ask again`**，只能在 awsome-config 里关（`confirm.discard`，默认开）。对话框的设计参考 `herdr-git-graph` 的 `dialog.js`（错误留在对话框里），**借鉴设计，不复制代码**。
- 左右分栏 / inline diff 保持现状。

### 4.6 awsome-changes：多 repo、History 的图视图和 review ✅（设计已确认，review 除外）

> 画板 09（History）、12（Repositories 列表）。画板 10、11 是被取代的早期方案。

**多 repo：工作区里有主 repo，下面还有独立的子 repo，要选择看哪个**
- **实测的事实**：主 repo 的 `git status` **看不到子 repo 的改动**（只有被折叠的 `?? libs/`），被 `.gitignore` 掉的子 repo 完全不出现，`git` 自己也发现不了深层的子 repo。所以必须**单独发现、单独读取**每个 repo。
- **Repositories 竖向列表**（只有 1 个 repo 时整块隐藏）：
  - 位置：标题栏 → Repositories 列表 → 分隔线 → 当前 repo 的分支行（分支图标 + 分支名，右边淡色 repo 名）→ 提交框 → 两组文件。下半部分和单 repo 时完全一样。
  - 列表标题行：折叠箭头、`Repositories`，右边三个图标按钮：`Rescan`、`Add repository…`、`Follow terminal`（亮着 = 正在跟随）。
  - **每一行**：repo 的相对路径（有改动用最严重状态的颜色，干净的变灰）、分支、`↑2 ↓1`、右对齐的改动数徽标（0 显示成淡色）。**单击就切换**；当前 repo 用 `selected` 叠层（§2.3）；悬停提示 `main ↑2 · 8 modified · 2 deleted · 4 new`。顺序固定：主 repo 第一，其余按路径字母序。
  - 最多显示 5 行，更多在列表里滚动；可折叠，折叠后只剩当前一行并写 `4 more · 1 has changes`。列表有焦点时 ↑ ↓ 移动、Enter 选定。
- **选中之后**：Changes 和 History 都显示这个 repo。
- **跟随与固定**：默认**跟随**焦点终端所在的 repo；在列表里点选 = **固定**，`Follow terminal` 图标熄灭，点它恢复跟随（和 Files 面板的跟随按钮同一个意思）。
- **其它 repo 有改动**：不把别的 repo 的数字加进 `Changes` 标签，免得和当前列表对不上；列表折叠时由 `1 has changes` 说明。
- **键盘**：`Next repository with changes`（只在有改动的 repo 之间跳，适合挨个 review），只在 Changes 面板有焦点时生效（`mod:awsome-changes`）；默认键位实测后定，可在 awsome-config 改。
- **提交后提示**：当前 repo 提交后变干净，显示 `Next: tools/bar · 2 changes`，点一下或 Enter 过去；**不自动跳**（`repos.suggestNext`，默认开）。
- 主 repo 的列表里不显示"本身就是 repo 的目录"；submodule 指针的改动照常显示。
- **发现**：默认扫 3 层（`repos.scanDepth`），跳过 `node_modules`、`target`、`.git` 内部，**包含被忽略的子 repo**；结果缓存，`Rescan` 或文件夹变化时刷新；手动添加的记在 `repos.extra`。**首选 ripgrep**（`rg --files --hidden --no-ignore -g "**/.git/HEAD"`，在本机一个放了几十个 repo 的目录上实测 58 ms）；没有 rg 时 Windows 用 PowerShell（157 ms）、macOS / Linux 用 `find`；都不行就只用手动列表（平台适配表的一项）。
- **不做**：所有 repo 平铺在一个列表里、跨 repo 的合并视图、同时提交多个 repo、跨 repo 的 push / pull。

**History：列表 / 图两种视图**
- 进入 History 后标题栏右边多一个 `List | Graph`，默认值可设置（`commits.view`），上次的选择也记住。`List` 是现在的平铺列表，原样保留；`Graph` 是同一批提交，左边多一列泳道。
- 范围下拉：`Current branch`（含上游，默认）/ `All branches`。点一行进入提交详情；**只读**。
- 画法：一条泳道一种颜色（8 色轮换），线只在分叉、合并处弯；HEAD 和合并提交是空心圆环，普通提交是实心圆点；引用标签：当前分支实心 `accent`，远程分支灰色描边，其它分支用泳道色描边，tag 用 `ansi3` 描边。一行：泳道、标签、标题、相对时间、短哈希（作者放进悬停提示，窄了先省略标题）。每页 50 条，已加载的全部提交重新算布局，线跨页接续。
- **只做**：`git log` 多取 `%P`（父提交）和 `%D`（标签）；几十行的泳道布局函数（按 `herdr-git-graph` 的思路自己写）；`PathBuilder` 画泳道和圆点。约 150 行，没有平台差异。
- **不做**：右键 git 操作、checkout、stash 和 WIP 行、冲突视图、文件历史、头像、Rust 辅助程序。

**GitHub 式 review（最后做，P5）**
- 在 diff 视图里**单选或多选行**（鼠标事件 + `selected` 叠层，复用现有 diff 的行；选择规则同 §2.6）。
- 选中后弹出 review 输入框（自带的 `Textarea`）。
- 评论数据**采用 GitHub PR review 评论的标准字段**（`path`、`side`、`line`、`start_line`、`body`）。
- 最后统一发给 agent 整改：复用 `Send to agent`，默认发给当前 space 的主 agent，发之前可改。
- 做之前先把数据结构给你看一眼。

### 4.7 awsome-filetree：内容搜索 ⬜

像 VS Code 的搜索，搜文件内容。
- **引擎**：`rg --json`（这台机器是 14.1.1）；没装 `rg` 就退回 `git grep`。三个平台都能用，默认遵守 `.gitignore`。
- **界面**：文件树标题栏的第三个视图 **Search**（Tree | Recent | Search）；输入框下面是 `Aa`（大小写）、`ab`（整词）、`.*`（正则）三个开关，以及包含 / 排除的 glob；结果按文件分组，文件头是图标、名字、路径、匹配数徽标，下面是命中的行，匹配的字高亮；虚拟列表。
- **点结果**：单击在临时预览里打开并跳到该行，双击固定（规则同 §4.4）；需要把行号传给 `awsome-viewer`（已有 `scroll_to_item`）。
- **范围**：文件树当前的根（所以"进入文件夹"也能用来缩小范围）。
- **限制**：每个文件最多 20 条、总数 500 条、15 秒超时，超出写 `Results truncated`。
- **坑**：`rg` 的匹配位置是 UTF-8 **字节**偏移，含中文的行要先转成字符位置才能高亮，要专门用中文测试。
- **不做**：替换（会批量改文件，以后单独讨论）。
- 约 250～350 行。先验证 `rg --json` 在 Herdr 运行时里能顺利解析。设置项：引擎偏好、默认开关、最大结果数、默认排除目录。

---

## 5. 执行计划

### 5.1 顺序和依赖

**顺序（已确认）：P0 → P1 → P1b → P1c → P2 → P4b → P4 → P3b → P3 → P5**。会动用户文件的 P3 放在靠后，等确认对话框和平台适配表在 P4 里用熟了再做。

| 阶段 | 内容 | 依赖 | 风险 |
|---|---|---|---|
| P0 | 主题 `themes/awsome.json`（含 §2.3 的叠层、§2.4 的标记色）；设置入口按钮（§3）；两个设置改名；文件树键位改成 `mod:awsome-filetree` 分区并去掉旧键位（§8）；Files 原型收尾；共用的确认对话框和右键菜单样式；`awsome-tabs` 的拖拽规则统一（§2.6） | — | 低 |
| P1 | 侧边栏：agents 接线（sub agent 缩进、点击开 pane）；`awsome-menu`；space 单项右键菜单（Terminals、Agents、worktree、space 操作） | P0 | 低（上游已写好） |
| P1b | 侧边栏：选择模型、多选菜单、`Appearance…`（颜色 + 图标）、分组和拖拽 | P1 | 中高 |
| P1c | 侧边栏：平铺（`Tile agents`、快捷键开关）；**先做小验证** | P1b | 中 |
| P2 | 打开文件：单击临时 pane、双击固定 tab、预览斜体；文件树的选择模型（§2.6）和选择条 | P0 | 中（两个 mod 联动） |
| P4b | History 的图视图 | P0 | 低 |
| P4 | Changes：布局、树视图、discard + 快照、commit message 生成；多 repo（发现、Repositories 列表、Files 着色） | P0 | 中高（discard 会丢改动） |
| P3b | 内容搜索 | P2 | 中 |
| P3 | 文件操作：新建、重命名、删除、拖拽移动、`Ctrl+Z`；批量发送给 agent、批量删除 | P2、P4 的确认对话框和平台适配表 | **高（改磁盘文件，三个系统命令不同）** |
| P5 | diff 行选择 + review + 发给 agent | P4 | **最大** |

### 5.2 每个阶段怎么做

1. **开工前**：按 `CLAUDE.md` 规则 0、1，先看现成的实现和接口，做一个小验证（能打包、`herdr-app check` 通过、能跑通一次）。自己写的逻辑变多时先告诉你。
2. **做完我自己验证**：`herdr-app check mods/<name>`、`herdr-app status` 没有 `errors`；静态界面用 `herdr-app shot` 截图确认（切布局后等 20 秒再拍）；长列表先量渲染时间。
3. **你来试**：我不能点击、右键、拖拽，所以每个阶段结束时给你一张**操作清单**（下表），你试完反馈手感。
4. **提交**：每个阶段单独提交，提交说明用英文；不推送，除非你说。

| 阶段 | 需要你亲手试的 |
|---|---|
| P0 | 底栏设置按钮能打开 awsome-config；文件树的 `Ctrl+Alt+Backspace` / `Ctrl+Alt+Enter`；在 awsome-config 里改这两个键后仍生效；换主题后颜色是否正常 |
| P1 | 右键 space 的菜单；从菜单开各种终端（含 WSL）和 agent；点 sub agent 开 pane |
| P1b | Ctrl / Shift 多选 space；多选菜单；`Appearance…`；拖进 / 拖出组、拖组头、折叠组的红点 |
| P1c | `Ctrl+Alt+G` 开关平铺；在平铺里打字、按 Esc；`Open in its tab` |
| P2 | 单击预览、双击固定；Ctrl / Shift 多选文件；选择条 |
| P4b / P4 | 切 List / Graph；discard 的确认和快照找回；生成 commit message；多 repo 的切换和跟随 |
| P3b | 搜索中文、正则；点结果跳到行 |
| P3 | 新建、重命名、删除到回收站、拖拽移动、`Ctrl+Z`（三个系统各试一次，macOS / Linux 需要你在那边的机器上跑） |
| P5 | 选行写 review 并发给 agent |

---

## 6. 决定和待决事项

**已确认**：
- 视觉方向 A（安静、高密度、极简）；Phosphor（UI）+ Material（文件）；布局方案 2（对齐 VS Code）；自定义主题；设计系统只有一份来源（第 2 节）。
- 界面只用英文；sentence case。
- 文件树：行内信息极简默认、详细可选；5 种状态色；多选；右键菜单；悬停提示；对齐和响应式；去掉 agent 读写闪烁层；子 repo 用自己的状态着色。
- 文件树进出文件夹：`Ctrl+Alt+Backspace` / `Ctrl+Alt+Enter`。
- 删除进回收站、默认确认、不提供撤销；新建 / 重命名 / 移动可撤销。
- Changes（画板 06～09）：discard 前自动留快照；History 范围默认"当前分支 + 上游"加 `All branches`。
- 多 repo：Repositories 竖向列表；Changes 的文件也按树缩进。
- 侧边栏：space 右键菜单和标签栏 `+` 同一个；点终端 / agent 新开 tab；`Appearance…`（7 色 + 25 图标）；分组规则；选择和拖拽规则；Ctrl + 单击不切换；建组只走菜单；平铺用浮动窗口（P1c，先验证）。
- 设置快捷键 `` Shift+Alt+` ``（`alt-~`）。
- 执行顺序。

**这次统一时我改掉的地方**（§2.8 有完整表）：拖拽不再要求按住 200ms；组头不显示数字、不靠双击重命名；当前 space 只加粗；锚点和当前 repo 不用左边竖线；确认对话框统一成 Enter 确认；菜单用 sentence case。**如果其中哪条你不同意，告诉我。**

**还没决定**：
- ❓ 平铺的默认快捷键 `Ctrl+Alt+G`、Repositories 的 `Next repository with changes` 键位：实测后定。
- ❓ review 评论的数据结构：做 P5 前给你看。

---

## 7. 参考项目（只借鉴思路，不搬运）

| 项目 | 许可 | 借鉴什么 | 不要什么 |
|---|---|---|---|
| `rabeeh-ta/herdr-git-graph` | MIT | 泳道布局思路、`PathBuilder` 画曲线、同色合并成一条路径、确认对话框的设计 | 右键 git 操作、多仓库（依赖 `find` / `env`，Windows 不行） |
| `TomiXRM/git-grapher` | MIT | commit message 生成经验（无标准输入、60KB 截断、30 秒超时回退、可配置命令）、纯函数的布局和解析写法 | 整个 git 客户端、Rust 辅助程序 |
| `munza/herdr-mods` 的 `better-config` | Apache-2.0 | 已采用并改名为 `awsome-config` | — |
| Herdr 自带的 `confirm`、`menu`、`new-menu`、`spaces` | — | 对话框和菜单的尺寸、行为、用语（§2.1） | — |

---

## 8. 快捷键总表

所有键都**可在 `awsome-config` 里改**。默认值按"逻辑键"定义，写入 `keys.json` 时按平台翻译（"主修饰键"在 macOS 上映射到 `cmd`）。

| 动作 | 默认键 | 作用范围 | 说明 |
|---|---|---|---|
| 打开 mod 设置 | `` Shift+Alt+` `` | 全局 | Windows 上 Herdr 叫它 `alt-~`，已确认能用。底栏按钮是主入口 |
| 平铺 / 复原当前 space 的 agent | `Ctrl+Alt+G` | 全局 | **实测后定** |
| 文件树：上一级 | `Ctrl+Alt+Backspace` | 文件树有焦点 | §4.3 |
| 文件树：进入选中的文件夹 | `Ctrl+Alt+Enter` | 文件树有焦点 | 单独的 Enter 仍是展开 / 打开 |
| 文件树：撤销 | `Ctrl+Z`（macOS `Cmd+Z`） | 文件树有焦点 | 不抢终端的 Ctrl+Z |
| 重命名 | `F2` | 文件树或侧边栏有焦点 | 文件、space、组 |
| 文件树：删除（进回收站） | `Delete`（macOS `Cmd+Backspace`） | 文件树有焦点 | 弹确认 |
| 文件树：搜索内容 | `Ctrl+Shift+F` | 文件树有焦点 | 更具体的 `mod:awsome-filetree` 分区优先，不和 Herdr 终端里的查找冲突 |
| Changes：提交 | `Ctrl+Enter`（macOS `Cmd+Enter`） | 提交框有焦点 | 和 VS Code 一致 |
| Changes：下一个有改动的 repo | 待定 | Changes 有焦点 | **实测后定** |
| 取消 / 清空选中 | `Esc` | 当前面板 | |

**键名规则（实测得出）**：Windows 上，**带 Shift 的标点键，Herdr 用它产生的字符命名**（Shift+\` 是 `~`，Shift+, 是 `<`），`shift` 标志是 false；这和键盘布局有关。所以默认键尽量用字母、数字、方向键、Enter、Backspace、F 键，少用 Shift+标点。

**要避开的键**：`alt-up` / `alt-down`（Herdr 的 agent 切换）、`alt-1..9`、`alt-h/j/k/l`、`alt-left/right`、`ctrl-1..`、大部分 `ctrl-shift-*`；`ctrl-alt-shift-escape`（紧急重置，任何东西都不能占）。

**关于 Ctrl+Alt**：Windows 上 Ctrl+Alt 是 AltGr，但 Backspace、Enter 不打字符，没有冲突；`Ctrl+Alt+G` 在少数键盘布局上可能打出字符，所以要实测。Linux（X11）上 `Ctrl+Alt+Backspace` 历史上是"杀掉图形界面"，现在大多默认关闭，要在 Linux 上实测一次。

**实现说明**：文件树现在用视图的 `on_key_down` 直接读按键，不能被 `keys.json` 或 awsome-config 重绑。要改成 `mod:awsome-filetree` 键位分区：`keys.json` 里写 `"mod:awsome-filetree": { "ctrl-alt-backspace": "awsome-filetree.up", … }`，mod 通过 `nextCommand()` 接收命令。列入 P0。

---

## 9. 当前未提交的改动

- `mods/awsome-filetree/main.js`：Files 原型（已同步到你的 Herdr）。
- `mods/awsome-icons/ui/`：24 个 Phosphor 图标和许可证；`NOTICE.md` 要补记 Phosphor（MIT）。
- `config/keys.merge.json`：设置快捷键 `alt-~`。
- `CLAUDE.md`、`docs/REQUIREMENTS.md`（本文件）。
- 仓库根目录的 3 张截图（`changes-ui.png` 等）不是我创建的，**不提交**。

---

## 10. 暂缓的功能（需求已写好，等你说开始再恢复）

### 批量重命名
- 三种模式 + 实时预览：
  - **查找替换**：可选区分大小写、正则；默认只改文件名主体，不动扩展名。
  - **前后缀**：后缀加在扩展名之前。
  - **序号**：模板如 `photo-{n}`，设起始值和补零位数，按当前列表顺序编号。
- 预览每一项"旧名 → 新名"，三种状态：可改、未匹配（跳过）、**冲突**（整行红色并写明原因：已存在、与本批另一项重名、名字不合法）。**有冲突时 `Rename` 按钮不可用。**
- **整批算一步**，`Ctrl+Z` 一次撤销整批。
- 三个系统用同一套最严格的合法性检查：不允许 `\ : * ? " < > |`，不允许以空格或句点结尾，不允许 Windows 保留名（CON、NUL 等）。
- 自己写的少量逻辑（模式 + 预览 + 冲突检查），不依赖外部库。
