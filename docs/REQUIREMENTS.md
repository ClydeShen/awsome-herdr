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
| 颜色的具体色值 | **主题 `config/themes/awsome-dark.json`、`awsome-light.json`**（布局 `awsome.json` 的根节点指定这一对）。**灰阶、底色、边框、圆角取自 shadcn/ui 的 Neutral 主题；强调色、状态色、终端 16 色取自 Apple 的系统色**（HIG 官方页面公布的 RGB）。只换算、不调色，对应关系见 §2.3 | 本文件只写"用哪个令牌"；唯一的例外是 §2.4 的 6 个标记色 |
| 参考项目的借鉴边界 | 第 7 节 | — |

不另建 `design-system/MASTER.md`：设计系统就是本文件第 2 节加上面的主题。

---

## 2. 设计系统和交互模式（所有面板共用）

### 2.1 原则

1. **贴近 Herdr 原生**（2026-11-26 用户再次强调，`docs/UI-LESSONS.md` L14）：**能复用 Herdr 就复用；新功能扩展的界面和交互要尽可能贴近 Herdr 的设计元素和视觉语言；代码复用不了，就复用它的设计系统和 UI / UX 风格；不能有新的 pattern。** 做新界面先找 Herdr 自带 mod 里同类的元素（`pane`、`menu`、`confirm`、`tabs`、`spaces`、`files`、`peek`），读源码取值。能用 Herdr 自带的组件和 mod 就用（`confirm`、`notify` toast、`tooltip`、`Popover`、`pickFiles`），尺寸、圆角、用语跟 Herdr 自带界面一致。我们的界面放进 Herdr 里，应当像是它本来就有的。
2. **极简、克制**：一行只放必要的东西；不做彩色标签、竖线装饰、渐变、装饰动画；同一种意思只有一种画法（§2.3）。
3. **常识优先**：行为跟文件管理器、VS Code、浏览器一致（单击选中、Ctrl/Shift 多选、F2 重命名、Enter 打开、Esc 取消、Backspace / Enter 系列管文件夹的进出）。**不发明新手势**，不让同一个手势在不同面板里意思不同。
4. **最少步数**：常用动作 1～2 步；危险动作多一步确认，但只多一步。
5. **文字克制**：凭常识、版式或设计语言已经表达的，就不写文字；说明只在标题和控件表达不出来时才写一句；格式和示例放进占位文字（2026-11-26，用户）。
6. **对齐线尽可能多地对齐**：同一层级的文字起点、控件的右边缘、同类图标所在的列，都对齐在同一条线上；相邻区块的横线、竖线也互相对齐（2026-11-26，用户）。
7. **不只靠颜色**：状态、选中、当前项都有颜色之外的第二个线索（字形、粗细、描边、删除线、提示文字）。

### 2.2 尺寸和字体

| 项 | 数值 |
|---|---|
| 栅格 | 4px |
| 版式 | 卡片四周和卡片之间 **4px** 缝隙；侧边栏底栏和主区域状态栏都是 **32px**，两根分隔线在同一高度；卡片上沿（标签栏 42 + 4）= 侧边栏品牌区高度 46，隐形对齐线尽量对齐 |
| 行高 | 树（Files、Changes 的文件树）**22px**；列表（侧边栏的 space、agent，Repositories）**28px**，和 Herdr 自带的 spaces 一致 |
| 缩进 | **每级 12px，所有树和分组都一样**；多级的树画缩进参考线（Files、Changes、Agents 的 sub agent），只有一级的分组（space 组）不画 |
| 字号 | 11（次要文字、区块标题）、12.8（菜单项，和 Herdr 菜单一致）、13（行内容）、15（对话框标题，和 Herdr `confirm` 一致） |
| 字体 | 只用 Herdr 自带的两种。**标识类文字一律用 JetBrains Mono**：文件名、路径、分支名、space 名、哈希、数字、快捷键，因为它们要逐字核对，而 JetBrains Mono 能分清 `O` / `0`（0 中间有点）和 `I` / `l` / `1`（衬线、尾巴、旗角）。**说明类文字用 Geist**：按钮、菜单、标题、提示。实测 Geist 和 Segoe UI 里 `I` 和 `l` 都是一根竖线、`O` 和 `0` 几乎一样，几乎所有无衬线界面字体都这样，所以不靠换界面字体解决 |
| 圆角 | 卡片（Files / Changes 面板、终端 pane）10px，即 shadcn 的 `--radius`；行 6px（shadcn `radius-sm`）；菜单 7px、对话框 8px（和 Herdr 一致） |
| 图标 | UI 控件用 **Phosphor regular，14px**；文件、文件夹、程序图标用 **Material**。都放在共享的 `awsome-icons/`，按路径读 |
| 按钮 | **文字按钮只有一种样子**：`raised` 底、1px `input` 描边、`foreground` 文字，悬停叠 `hover`（用户 2026-11-26 选定；原来的"主要 = 实心 `accent`"和 Herdr 的 `solid` 都不用：`solid` 在浅色主题里是黑色按钮）。**危险动作**（删除、discard、关闭）例外：实心 `blocked` 红色，不变。哪个是主要动作靠文字、位置（最右）和 Enter 区分。图标按钮：悬停才显示底色，**必须有 tooltip**。高度：对话框和提交按钮 32px（和 Herdr 一致），面板里 24px |
| 动效 | 悬停 ≤150ms；除 agent"工作中"的呼吸动画外，不做装饰动画 |

### 2.3 行的状态（所有列表和树只有这一套）

| 状态 | 画法 | 说明 |
|---|---|---|
| 默认 | 无底色；正文 `foreground`，次要文字（分支名、时间）`muted` | |
| 悬停 | 叠一层 `hover` | |
| 选中（单选或多选） | 叠一层 `selected` | 多选和单选画法相同 |
| 当前（导航列表里"正在看的那一项"：侧边栏的当前 space、Repositories 的当前 repo） | `selected` 叠层 + **左侧指示条**：4px 宽、24px 高、圆角、`accent`、垂直居中 | 画法取自 GitHub Primer 的 TreeView / NavList（`aria-current`）。只靠底色时和普通行只差约 1.2:1，看不出来；指示条（Apple 蓝）对侧边栏底色浅色 4.57:1、深色 5.54:1，过 3:1 |
| 键盘光标 / 多选的锚点 | **1px `accent` 内描边**，只在这个列表有键盘焦点时显示 | 和 VS Code 一致；**不用左边竖线** |
| 禁用 | `dim` 文字，tooltip 写原因 | |

- **`dim` 只用于刻意变淡、不需要读的东西**（被忽略的文件、空闲的 agent、禁用项），WCAG 对这些不作要求；**要读的次要文字一律用 `muted`**。`dim` 对应 shadcn 的 `ring`（深色 `#737373`），不用来写要读的字。
- **配色不自己调**：每个 Herdr 令牌对应一个公开来源的值。shadcn Neutral：`background` / `surface` / `popover` = `background` 或 `card`，`chrome` = `sidebar`（**浅色改用纯白**，让侧边栏上的文字也达标），`canvas`（卡片之间的缝隙）= 深色的 `background`、浅色的 `sidebar`，`raised` = `secondary`，`border` / `input` / `foreground` / `muted`（= `muted-foreground`）同名，`dim` = `ring`，`hover` / `selected` = `accent`（换算成叠层）。Apple：`accent` = 蓝，`working` = 橙，`blocked` = 红，`done` = 绿，终端 16 色 = 红、绿、黄、蓝、紫、青；**浅色一律用 Apple 的"增强对比度"值**（普通值是给色块用的，黄色 `#ffcc00` 写在白底上看不见），深色用普通值，不到 4.5:1 的（红、紫）换增强对比度值。唯一推出来的值：文字选区 = 强调蓝的 25%，两个来源都没定义它。
- **实测对比度**：深色所有文字在所有底色和状态下都 ≥ 4.71:1。浅色普通状态下都 ≥ 4.54:1；**悬停或选中的行上，次要文字和彩色文字降到 4.2～4.4:1**，保持来源原值不改（你确认）。
- shadcn 的悬停和选中是同一个值（`accent`），所以两者靠本节的其他线索区分：当前项有左侧指示条，键盘光标有描边。
- **不画**：除"当前项"的指示条外的任何竖线，2px 的彩色描边环，整行实心色块。

### 2.4 颜色

- **一律用 `theme()` 的语义令牌**，不写死色值（`CLAUDE.md` 的规则）。
- **Git 状态：全局唯一一套 5 种**，用在 Files、顶部汇总、Changes、Recent、Repositories 五处：

| 状态 | 字母 | 令牌 | 颜色之外的线索 |
|---|---|---|---|
| Modified | `M` | `ansi3`（黄） | 悬停提示写明状态 |
| New（已暂存的新增和未跟踪合并） | `A` | `ansi2`（绿） | 同上 |
| Deleted | `D` | `ansi1`（红） | **删除线** |
| Renamed | `R` | `ansi6`（青） | 悬停提示 |
| Conflict | `U` | `ansi5`（洋红） | 悬停提示 |

- **字母、颜色、文字、严重度只有一个来源**（2026-11-27，用户："there are many places use this system, all of them need aligned"）：`git-status.js`，在 `awsome-filetree`、`awsome-changes`、`awsome-viewer` 里逐字节相同（C5），其他代码不另写映射（C15）。字母和 Herdr 自带 `changes` 的一样（`A` 含未跟踪）。
  - git 的两位状态码（porcelain `XY`，或 `--name-status` 的一个字母）换成字母，按这个顺序取第一个成立的：**冲突** `U`（含 `U`，或 `AA`、`DD`）→ **删除** `D`（含 `D`）→ **新增** `A`（`??`，或含 `A`、`C`：复制出来的是新文件）→ **重命名** `R`（含 `R`）→ **修改** `M`（其余，含 `T`）。所以 `AM`（新增后又改）是 `A`，`RM` 是 `R`。
  - 文件夹取里面最严重的：`U` > `D` > `M` = `R` > `A`。
  - **列出几种状态时的顺序**（2026-11-27，用户定）：新增、修改、重命名、删除、冲突（`GIT_ORDER`）。Files 摘要的计数和比例条、文件夹悬停提示里的明细都按这个顺序。
  - Files 摘要的三个计数按字母分桶：`A` 算 new，`D` 算 deleted，`M`、`R`、`U` 算 modified。

  状态就是**名字的颜色**，默认不画字母、不画小点；设置里有可选的"名字后显示状态字母"（`row.statusLetter`，默认关）。文件夹和 repo 取里面最严重的状态（冲突 > 删除 > 修改 > 新增）。
- **Agent 状态**：工作中 `working`、需要你 `blocked`、完成 `ansi2`、空闲 `dim`，画成状态点，旁边配文字（`2m`、`needs you`、`done`、`idle`）。
- **标记色（space 和组的颜色，唯一允许的非令牌颜色）**：无 + 6 个色相（teal、orange、blue、purple、green、pink，沿用 Herdr 侧边栏现有的那 6 个），**只在一处定义**，深浅两套。用法是行的**淡底色**：**深色 8%、浅色 4%**。浓度按"淡底色的行上次要文字（`muted`）仍 ≥ 4.5:1"来定：浅色 4% 时 4.54:1（5% 就降到 4.49），深色 8% 时 6.23:1、叠上选中层仍有 5.19:1。所以浓度固定。存色名，渲染时取当前主题那一套。**标记色不表达状态**，所以不用红黄绿的 ansi 令牌，免得和 Git 状态混淆。

### 2.5 文字和用语

- **所有界面文字用英文**（按钮、菜单、提示、对话框、设置项、通知）；文档和对话用中文。
- **Sentence case**，和 Herdr 一致：`Close space…`、`New group…`、`Copy relative path`、`Stage changes`、`Discard changes`。
- **省略号 `…`**：点了之后还要再输入或确认的动作才带（`Rename…` 例外：行内编辑，不带）。
- **数字要有标签**：树里的文件夹、space 组头**不画裸数字**（明细放进悬停提示）；只有意思约定俗成的计数徽标可以用裸数字（Changes 标签的改动数、Repositories 行的改动数），并且悬停时写全。
- **按平台写的叫法**：`Reveal in File Explorer`（Windows）/ `Reveal in Finder`（macOS）/ `Open in file manager`（Linux）；`Recycle Bin` / `Trash`。Files、Changes、侧边栏用同一套叫法。
- **快捷键的写法**：菜单右侧、tooltip 括号里，等宽淡色，如 `Up a folder (Ctrl+Alt+Backspace)`；macOS 上显示 `⌘` 等符号。
- tooltip 只放纯文字，不放可点击的内容。
- **tooltip 只写元素上看不到的东西**（用户 2026-11-26；`docs/UI-LESSONS.md` L20）。只有三类可以写：① 只靠颜色表达的状态，写成字（§2.4 要求的第二个线索：`Modified`、`Ignored by Git`）；② 元素上没有位置放的事实（`Also staged +3 −1`、`Renamed from …`、`Binary file`、文件夹里有什么、行上没显示时的修改时间、提交的作者和精确时间）；③ 被省略的全文，**只在真的放不下时**才写（按宽度估算）。名字、`+N −N`、已经显示出来的文字一律不再写；三类都没有，就不显示 tooltip。按钮的 tooltip 写名字和快捷键，不在此列。

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
- 加载中写 `Loading…`；**空状态默认不写文字**，空白本身就说明是空的（2026-11-26，用户；和 §2.1 的"文字克制"一致）。
- **撤销只给低风险的文件操作**（新建、重命名、移动）；删除进回收站，不提供撤销；侧边栏的整理（分组、颜色）用拖拽或菜单就能改回，不做撤销。

### 2.7 各面板的布局（要点）

- **整体**：保持"左侧 Spaces + Agents ｜ Files / Changes 面板 ｜ 终端区"，每个区块用 VS Code 的视觉语法：大写小号的区块标题、折叠箭头、悬停才出现的操作图标。
- **Files**：标题行（根文件夹名 + 图标按钮）、汇总、过滤框、树。见 §4.3。
- **Changes**：分段控件 `Changes | History`、提交框在顶部、`Staged changes` / `Changes` 两组。见 §4.5。
- **侧边栏**：space 行是图标（或小圆点）+ 名字 + 分支，可有淡底色；agents 按 space 分组，sub agent 缩进。见 §4.2。
- **标签栏**：扁平标签，选中项底部一条 `accent` 线。**鼠标中键关闭 tab**（和浏览器一样，松开时生效，和 × 按钮是同一个操作；× 的提示写 `Close tab (middle-click)`）。
- **预览**：顶部面包屑路径，工具栏只留 3 个图标。
- **设置对话框**：左侧列表加搜索框。

### 2.8 统一时改掉的旧画法（画板里还能看到，以本节为准）

| 旧画法（出现在） | 改成 | 原因 |
|---|---|---|
| 锚点用左边蓝竖线（画板 03） | 锚点 = 1px `accent` 内描边 | 竖线只留给"当前项" |
| 当前 space 用 1px 灰描边 + 加粗（画板 13、14） | `selected` 叠层 + 左侧指示条（Primer 的画法） | 只靠底色太淡；描边留给键盘光标 |
| 组头显示成员数（画板 13、14） | 不显示，悬停提示写 `3 spaces` | 不画裸数字 |
| 双击组名重命名（画板 14） | `F2` 或右键 `Rename` | 点组头已是折叠，双击会折叠两次 |
| 组成员缩进 16px（画板 13） | 12px | 全局一个缩进值 |
| 拖拽要按住 200ms（画板 14） | 移动超过 6px 即开始 | 桌面常识，不迟钝 |
| Discard 对话框默认焦点在 Cancel（画板 08） | Enter 确认，和 Herdr 一致 | 只有一种对话框行为；discard 前自动留 git 快照，可以找回 |
| 状态"永远配字母 A / M / D"（旧 §2.1） | 状态 = 名字颜色 + §2.4 的第二线索，字母可选 | 已在 §4.3a 确认 |
| 菜单项首字母大写（`Discard Changes`、`Stage Changes`、`Open File`） | sentence case | 和 Herdr 一致 |
| 中文的界面文字（"已移到回收站"、"结果已截断"） | `Moved to Recycle Bin`、`Results truncated` | 界面只用英文 |

### 2.9 面板框架：Files 和 Changes 共用（P4a，2026-11-26，规格待预览确认）

> 两个面板在布局里是同一个位置（`panel-body`），互相切换时什么都不能跳。**模板是 §4.3 已定的 Files**，Changes 跟着它（用户 2026-11-26："应该是 changes 跟着 files 改"；`docs/UI-LESSONS.md` L15）。数值来源：标题栏是 `design/tokens.json` 的 `paneHeader`（Herdr 的 pane 头部，P2b 的预览列头部已经在用，用户确认过）；行和缩进是 §2.2；颜色是 §2.3、§2.4。两个面板现有的代码都只是初始状态，和本节不一致的地方都要改（差距见 §4.5a）。

**竖线**（整个面板只有这几条，切换面板时位置不变）
- **x = 10：内容的左边缘**。标题栏的名字（`paneHeader.px` 10）、分支行的分支图标、树和列表第一列（箭头 / 图标 / 第 0 条泳道）、分组标题的箭头，都从这里开始。
- **x = 4：悬停、选中底色的左边缘**。列表左右各留 4，行的左右内边距 6（4 + 6 = 10）。
- 右边对称：内容的右边缘 = 宽 − 10（最后一个按钮、行尾的数字），底色的右边缘 = 宽 − 4。
- P4b 里 History 的行和分组标题用侧边栏的 8 + 8（文字在 16），**改成这套**：侧边栏是另一个区块，面板里只用面板自己的竖线。

**1 标题栏**（`paneHeader`：高 30、px 10、gap 8、字号 12；`background` 底、下边 1px `border`，和 Herdr 的 pane 头部一样）
- 从左到右：**名字** → **视图按钮组** → 1×12 分隔线（`paneHeader.separator`，`border` 色）→ **这个视图的工具组**。
- 名字：JetBrains Mono 12、`muted`，占满剩下的宽度，放不下就省略。Files 写树的根文件夹名；Changes 写当前 repo 的名字（只有一个 repo 时是 repo 根文件夹名；多个时是它的相对路径，P4d）。
- 按钮：全部是同一种图标按钮（P2b 的 `PaneButton`：14px Phosphor 图标、内边距 3、圆角 4、`dim`，悬停 `hover` + `foreground`；**开着的开关**和**当前视图** `selected` 底 + `foreground`）；组内间距 2（`paneHeader.groupGap`）。**同一行里只有这一种按钮**，不放文字标签、不放计数。
  - §2.2 写的"图标按钮 22px 点击区"在标题栏里改用 Herdr pane 头部的 20（14 + 3 × 2），和预览列头部一致。
- **视图按钮组**：tooltip 带快捷键，面板有焦点时按数字键切换（Files 已有的做法）。
  - Files：`Tree (1)`（`tree-structure`）。~~`Recent (2)`~~（2026-11-26 去掉，§4.5b A5）。**只有一个视图时不画视图按钮组和它后面的分隔线**；§4.7 的 Search 加进来后再出现。
  - Changes：`Changes (1)`（Herdr 自带的 `mods/changes/changes.svg`）、`History (2)`（`git-commit`）。tooltip 第二部分写数量：`Changes (1) · 1,015 changed files`、`History (2) · 2 not pushed`。
- **工具组**（随视图变；开关的 tooltip 写点了以后的结果）：
  - Files · Tree：`Up a folder`、`Follow the focused pane`、`Show dotfiles`、`Show sizes`、`Collapse all`（§4.3 已定的 5 个）。
  - Changes：`Show as tree`（`tree-structure`）、`Refresh`（`arrows-clockwise`）。~~`Side-by-side diff`~~ 移到 diff 自己的头部（§4.5b B3）。
  - History：`Show graph`（`git-merge`）、`All branches`（`git-fork`，只在图视图）、`Refresh`。

**2 不再有分支行**（2026-11-26 交叉核对后用户同意：分支名已经同时出现在侧边栏当前 space 那一行和底部状态栏，面板里再写一次是重复信息）
- **Files 的摘要**（§4.3a）：高 28、px 10 的一行，左边 `1 new · 13 modified`（彩色数字加文字，顺序 new、modified、deleted，比例条同序，§2.4 `GIT_ORDER`，字号 11、`muted`，零值省略），右边 `+618 −559`（11、`ansi2` / `ansi1`）；下面 2px 比例条，左右各留 10；下边 1px `border`。不写分支名、不写 `↑ ↓`。
  - **放不下时（2026-11-27，用户报的溢出：面板拖到最小 280 宽、改动很多时，`−N` 被切掉。用户定的方向：始终一行，不截断成 `…`、不换行；放不下时缩成字母、藏掉一部分；按用户的方向直接定，2026-11-27 已实现）**：按估算宽度逐步收缩（每字 5.6：在预览截图里量的，11 号界面字体实测约 5.4，`23 modified` 61 px；单位之间 gap 10）：
    1. **文字缩成字母**：`23 M  11 A  1,632 D`（字母 `muted`，跟在彩色数字后面，gap 3 不变）。字母和 Herdr 自带 `changes` 的行、Files 的可选状态字母（`row.statusLetter`）同一套：`M` 修改、`A` 新增（含未跟踪）、`D` 删除。
    2. **还放不下，藏起右边的 `+N −N`**：Files 讲的是文件，行数次要（每个文件行还写着自己的行数）。
    - 按 5.6 估算，280 宽时第 1 步就能放下全部（`23 M 11 A 1,632 D +1,819 −129,165` 约 200 px），计数到上万、行数到十万也还放得下；第 2 步只在更窄时出现。不截断、不换行。
    - **摘要可以点**（2026-11-27，用户要求）：点整个摘要（计数、行数、比例条）= 切到 Git 面板的 Changes 视图（和顶栏 `Git` 按钮同一个切换，`layout.select`，再给 `awsome-changes` 发 `changes` 命令，所以落在提交框和 Staged 那一页，不是 History）。悬停：整块叠 `hover`，指针手形；tooltip 最后加一项 `Open Changes`（缩写或藏了东西时写在全文后面，用 ` · ` 隔开）。
    - **回来**：Changes 和 History 两个视图头部左边的名字（repo 名）可以点 = 切回 Files（`layout.select`）。悬停：文字从 `muted` 变 `foreground`（和头部图标按钮的悬停同一个写法），指针手形，不叠底色（名字的位置不动，x = 10 的对齐线不变）；tooltip `Show files`。Files 自己头部的名字不是按钮。鼠标对鼠标；键盘没有快捷键，和顶栏 `Files` / `Git` 按钮一样。
    - 缩写或藏了东西时才给这一行加 tooltip，写全：`11 new · 23 modified · 1,632 deleted · +1,819 −129,165`（§2.5 / L20：颜色和字母表达的状态写成字、被藏起的内容）；放得下时没有 tooltip。比例条不变。
- **Changes**：分支写进提交框的占位文字 `Message (Ctrl+Enter to commit on main)`（macOS `Cmd+Enter`；VS Code 的写法），提交时就在眼前；`↑2 ↓1` 写进 `History (2)` 按钮的提示：`History (2) · 2 not pushed · 1 not pulled`。
- **History**：没有分支行；当前分支在图里是实心标签，List 视图的组头写着分支名。
- 有多个 repo 时（P4d），Repositories 列表每行写着它的分支（画板 12），不另加分支行。

**3 树和列表的行**
- **树**（Files 的树、Changes 的文件树，§2.2）：行高 22，每级缩进 12，缩进参考线 1px `border`；第一列 12 宽放箭头（`caret-down` / `caret-right`，12px、`dim`），文件没有箭头留空；然后 16px 文件图标（Awsome Icons / Material），名字 JetBrains Mono 13，颜色是 Git 状态（§2.4，删除加删除线）；gap 4；圆角 4。
- **列表**（History 的行、Repositories 的行）：行高 28（§2.2），列表第一列从 x = 10 开始；其它尺寸见 §4.6a。
- **分组标题**（Changes 的 `Staged changes` / `Changes`，History 的提交 / 详情）：高 28，箭头在 x = 10 的 12px 槽里，标题 11、medium、`muted`，计数徽标（千分位）；右端操作只在悬停时出现（§4.5）。
- 状态、选中、悬停、键盘光标按 §2.3。

---

## 3. awsome-config（设置对话框）✅

基于上游 `better-config`，已提交（`269638b`）。

- 读各 mod 的 `mod.schema.json`，生成开关、加减数字、下拉、文本框，保存前校验，写回各 mod 的 `mod.json`；改过的值有圆点，可单项或整体重置。
- 设置项可以**绑定快捷键**（`format: "key"` + `x-action`，写进 `keys.json`）。
- **快捷键：`` Shift+Alt+` ``**，已确认能用（Herdr 在 Windows 上把它叫 `alt-~`，见 §8 的键名规则）。原来的 `Alt+Shift+,` 写成了 `alt-shift-,`（应是 `alt-<`），所以没反应，已换掉。Herdr 的命令面板不列 mod，不能靠它打开。
- **设置入口按钮**（⬜，P0）：布局里 `sidebar-footer` 块的 `mod` 从 `workspace-chrome` 改成 `awsome-sidebar`，传 `props: { view: "footer" }`；底栏三个图标按钮 `Settings`、`Mod settings`（打开 awsome-config）、`Add machine`，各有 tooltip。只改布局，不写新代码，还省一半底栏高度。
  - 验收：点底栏的设置图标能打开 awsome-config；换主题或缩放后图标仍清晰可点。
- **两个容易混的设置改名**（P0）：`Git refresh`（Changes 列表的轮询）→ `Changes list refresh`；`Git retry`（侧边栏分支的兜底轮询）→ `Sidebar branch check`。多 repo 做起来时统一成"监听为主、慢速兜底"。

- **快捷键设置用"按一次录下来"**（⬜，惯例见 `design/conventions.json` 的 `key-recording`；原型的样子已确认 2026-11-26）：
  - **平时**：当前快捷键显示成按键块（shadcn `Kbd`：高 20、最小宽 20、左右 4、圆角 6、底色 `raised`、字号 11、中等粗细、`muted`；块之间间隔 4），旁边是 `Change` 按钮和已有的重置。
  - **录制**：点按键块或 `Change` 进入；框变成 `accent` 描边，写 `Press a shortcut`；按住修饰键时按键块实时出现；按下完整组合后显示录到的组合。**Enter 保存；Esc 或点框外面取消，恢复原来的键**；录制时 `Change` 的位置变成 `Cancel`（不再并排两个按钮，原型里 Save 溢出了）。带修饰键的 Enter / Esc（如 `Ctrl+Alt+Enter`）照常录入。
  - **已占用**：录到的组合如果已经绑定了别的功能，提示 `Already used by <功能>. Saving moves it here.`（`working` 色）。`Ctrl+Alt+Shift+Escape`（Herdr 紧急重置）不能录。
  - **怎么收到已被 Herdr 占用的键**（实测 2026-11-26）：获得焦点的界面收不到 `keys.json` 里已绑定的键（Herdr 先执行它们，`Alt+↑` 还会切走焦点关掉对话框）。办法是在 `keys.json` 里维护一个 `mod:awsome-config` 分区（只在设置对话框有焦点时生效），把其他分区里已绑定的键都转给录制框（`awsome-config.cap:<键>`）；不在录制时，录制框照常执行这个键原本的功能，所以平时行为不变。原型验证过 `Alt+↑`、`Ctrl+Alt+Backspace` 能这样收到。
**设置对话框重新设计**（✅ 2026-11-26 已实现；惯例见 `design/conventions.json` 的 `settings-page`，数值在 `design/tokens.json` 的 `settings`）
- **为什么改**：文字挤在一起、按钮是文字、每行都露出设置路径、单项重置几乎看不见（一个很小的灰色 `Reset` 文字），说明又长又带术语。
- **版式**（来源：shadcn `Item` / `Field`，macOS 系统设置和 Windows 11 设置的分组写法）：
  - **左侧导航** 200 宽，和侧边栏同一种行（高 28、左右 8、圆角 8、行间 4）；当前页用 `selected` 叠层加左侧指示条。底部两行带图标：`Installed mods`（package 图标）、`Herdr settings`（gear 图标）。
  - **页面**左右 28、上下 24 留白。顶部是页面标题（15 号、半粗）和一行说明（12 号、`muted`：`Changes apply right away.`；设置文件的路径放进悬停提示），右侧是图标按钮"全部重置"。
  - **分组**：按设置所属的对象分组（例如 `keys` → Shortcuts），组标题 11 号、中等粗细、`muted`，组之间隔 24；组可带一句说明。
  - **每组一个圆角框**（圆角 10、1px 边框），行与行之间 1px 分隔线；每行上下 12、左右 16。左边：标题（13 号、中等粗细）和一行说明（12 号、`muted`、行高 18，标题和说明间隔 6）；右边：控件，再加一个**固定 24 宽的重置位**，有没有重置按钮控件都对齐，不会跳动。
  - **改过的设置**：标题后一个 6px 的 `accent` 圆点，重置位出现图标按钮（逆时针箭头），悬停提示 `Reset to <默认值>`。
  - **设置路径**（如 `git.retry_after`）不再常驻，只在标题的悬停提示里。
- **图标按钮**（24×24、图标 16、圆角 6、`muted`，悬停时有底色、变成 `foreground`；都有悬停提示）：全部重置（逆时针箭头，`Reset all settings to their defaults`，没有改动时变灰）；单项重置（逆时针箭头，`Reset to …`）；快捷键的"更改"（铅笔，`Change shortcut`），录制时变成取消（×，`Cancel (Esc)`）。
- **文字克制**（2026-11-26，用户）：凭常识、版式或设计语言已经表达的，就不写文字。
  - 没有页面副标题，没有分组说明；**只有一项的分组不加组标题**，没有分组的设置放在第一张卡片里。
  - **说明默认不写**，只在标题和控件表达不出来时写一句（全部 29 条里只有 3 条有说明）。
  - 格式和示例放进输入框的占位文字（标题仍是标签，不靠占位文字当标签）；单位放在控件旁边。
  - 标题用 sentence case、1～4 个词，自己说清楚是什么；开关的标题读起来是"打开时的样子"。
- **对齐线**（2026-11-26，用户：隐形对齐线尽可能多地对齐）：
  - 横向：页面标题、分组标题、每行标题在同一条线上（卡片边缘往里 16）；卡片边缘自成一条线。
  - 右侧：所有控件右对齐到同一条线；"全部重置"图标和每行的重置图标在同一列（重置位固定 24 宽）。
  - 纵向：左侧导航的第一个标题 `Mods` 和页面标题在同一条中线上（导航上留白 8 + 标题行 32 的一半 = 页面上留白 8 + 标题行 32 的一半）。
  - 这几条关系由检查 C3 核对 `design/tokens.json` 的数值。
- **分组名**：changes: Refresh, Limits, Defaults, Panel；filetree: Shortcuts；menu: Terminals；sidebar: Git；tabs: Tabs, Menu；viewer: Refresh, File manager（只有一项的组不显示组名）。
- **29 条设置的文字**（英文是界面上的文字）：

| mod | 设置 | 标题 | 说明 | 占位文字 |
|---|---|---|---|---|
| changes | `refresh.status` | Git refresh | — | — |
| changes | `limits.files` | Max files listed | — | — |
| changes | `limits.diff_lines` | Max diff lines | — | — |
| changes | `limits.line_length` | Max line length | — | — |
| changes | `limits.commits_per_page` | Commits per page | — | — |
| changes | `default.view` | File list | — | — |
| changes | `default.diff` | Diff layout | — | — |
| changes | `panel.toggle` | Panel key closes the panel | — | — |
| filetree | `keys.up` | Up a folder | — | — |
| filetree | `keys.into` | Into a folder | — | — |
| filetree | `keys.follow` | Follow the terminal again | — | — |
| menu | `terminals.hide` | Hidden terminals | — | Command Prompt |
| menu | `terminals.extra` | More terminals | — | Nushell: nu |
| sidebar | `git.retry_after` | Retry failed Git reads | — | — |
| sidebar | `combined` | Spaces and agents as tabs | — | — |
| sidebar | `pull_request_status` | Pull request status | Needs the GitHub CLI. | — |
| sidebar | `agent_name` | Agent names | — | — |
| tabs | `tabs.max_width` | Tab width | — | — |
| tabs | `tabs.drag_delay` | Hold before dragging | — | — |
| tabs | `tabs.auto_name` | Name tabs automatically | — | — |
| tabs | `tabs.middle_click_close` | Close tabs with middle-click | — | — |
| tabs | `menu.width` | Menu width | — | — |
| viewer | `refresh.tree` | Tree refresh | — | — |
| viewer | `refresh.file` | File refresh | — | — |
| viewer | `editors` | More editors | macOS app IDs, such as dev.zed.Zed. | — |
| viewer | `fileManager.name` | Name | — | File manager |
| viewer | `fileManager.command` | Command | — | open -a Finder |
| viewer | `gutter` | Changed lines | Off uses Herdr's editor, with selection and folding. | —（**默认关**，2026-11-26 用户选：预览要能选中、复制） |
| viewer | `markdown` | Markdown opens as | — | — |
- **中键关闭 tab 的开关**（⬜）：awsome-tabs 的设置 `Close tabs with the middle mouse button`，默认开。

后续每个功能的设置项都要先在对应 schema 里描述。

---

## 4. 各 mod 的需求

### 4.0 mod 的边界（所有 mod 共用，2026-11-27 用户确认）

**原则：mod 只消费外部工具，把结果呈现出来**（用户 2026-11-27）。项目自己的工具（git、formatter、linter、测试、构建）和 agent 才是做事的一方；mod 不造这些工具，也不为它们负责。mod 做两件事：把工具和 agent 做事的**效果和结果展示出来**（文件改了就重新载入、Git 的提交图、改动的行），以及**调用通用工具的命令**（`git add`、`git commit`）。例子：
- Git 提交图：不自己实现 git，读 `git log` 的结果画出来。
- 格式化：项目的 formatter 可能是 prettier、oxfmt、biome 或别的，mod 不认识它们，也不替项目选。格式化由项目的工具或 agent 去做（保存时的钩子、agent 按项目的规矩运行），viewer 只把改动后的文件呈现出来（§4.8 "外部改动"）。所以不做编辑器里的 `Format Document`。

**界定一个功能归谁**（每个功能的规格最前面写一段"边界"，回答这六条）
1. **主人**：它动的是谁的数据，功能就归谁。编辑器里没保存的内容归 viewer，Git 暂存区归 changes，每个 mod 的设置归它自己的 `mod.json`（config 只是编辑它们的界面）。按"作用在谁的数据上"分，不按功能名分：同叫"格式化"，作用在编辑器内容上和作用在磁盘文件上是两个主人。
2. **区域**：画在哪一块，那块归谁，样子就由谁决定；别的 mod 只能往里登记内容（statusline 的项）。
3. **通道**：跨 mod 只走三种：共享状态 `shared("<主人>.<键>")`、命令 `<mod>.<命令>`、按路径读文件。**一个键只有名字前缀那个 mod 写**，别人只读；要多方登记的（`awsome-statusline.items`），每个 mod 只写自己名下那一项。
4. **外部工具**：调用什么，只取它的结果；工具自己的配置（`.prettierrc`、`.gitconfig`）留给工具，我们的设置里不重复。
5. **拔掉测试**：这个 mod 不在时，别的 mod 少一个功能，但不报错、不坏。
6. **不做**：明确写出来。

**mod 的四类**

| 类 | 例子 | 拥有 | 规则 |
|---|---|---|---|
| 区域 mod | sidebar、tabs、filetree、changes、viewer、statusline | 一块屏幕和它的数据 | 只画自己的块；要别人的数据从共享状态读 |
| 服务 mod | menu、config | 一种界面模式 | 用 props 调用，不懂调用方的业务：调用方给内容，它只显示、返回选择 |
| 资源 mod | icons | 文件 | 只读，按路径取 |
| 外部工具 | git、sh、项目的 formatter | 它自己的配置 | 只调用、只呈现结果 |

**按这把尺量出来、待清理的地方**（还没排期）
1. viewer 里还带着一棵没用的文件树（README "Known rough edges"），那是 filetree 的。
2. menu 的 `space` 分区里写着 space 自己的操作（Terminals、Agents、worktree），menu 懂了 sidebar 的业务；`statusline` 分区由调用方传 `choices`，是服务 mod 该有的样子。
3. `awsome-viewer.viewers` 由 filetree 和 viewer 两边写，形式改一边就要改另一边；应当只有 viewer 写。
4. 逐字节相同的拷贝（`menu.js`、`file-icons.js`、`settings.js`）：能做成弹出层的做成服务 mod（像 menu），只有纯函数才复制。

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

- **Spaces**：图标（没设就是一个小圆点）+ 名字 + 分支（右对齐），可有淡底色（§2.4）。没有彩色方块头像。当前 space 是 `selected` 叠层加左侧指示条（§2.3）。
- **Agents 按 space 分组，sub agent 缩进**（每级 12px + 参考线），状态点见 §2.4。点 sub agent = 在新 pane 里看它（`terminal.keep`）。上游的 `awsome-sidebar/views/agents.js` **已经写好**（按 space 分组、按名字前缀分组、树状缩进、父 agent 显示最紧急的子 agent 状态），**只差接线**：布局里把 `agents` 块改成 `awsome-sidebar` 并传 `props: { view: "agents" }`。
- **底栏**：见 §3。

#### 4.2.2 外观（`Appearance…`）（P1b-1，✅ 已做，待你试用）

- **打开**：space 或组的右键菜单里的 `Appearance…`（多选时一次改全部）。菜单关闭，在鼠标处弹出一个小弹层。
- **它是菜单家族的一员**（L12）：边框、圆角 8、阴影、`popover` 底色、内边距 4 都和 `menu.js` 一样；**所有内容放在同一张网格里：7 列，每格 28×28，格子之间不留空**（菜单的行之间也不留空），弹层宽度由网格决定（7 × 28 + 2 × 4 + 边框 2 = 206），没有空白区域。
- **第一行是颜色**：无 + 6 个标记色（§2.4），每格中间一个 16px 圆点（和图标一样大）；"无"是只有 1px `border` 边框的空心圆点。
- **分隔线**：和菜单的分隔线一样（1px `border`，上下各 4，左右伸到弹层边，`-mx-1 my-1`）。
- **下面四行是图标**：7 × 4 = 28 个，图标 16 `muted`。
- **选中、悬停和菜单一样**：当前的颜色、当前的图标所在的格子叠 `selected`（图标变 `foreground`），悬停叠 `hover`，格子圆角 6（菜单项的圆角）。当前的颜色另外在色点外隔 2px 画一圈 2px `foreground` 圆环（Chrome 标签组的做法；外径 24，放在 28 的格子里不占额外空间）：浅色主题里选中底色很淡，色点又不像图标那样会变深，需要第二个线索。
- **组只有颜色那一行；组里的 space 只有图标**（颜色由组决定）；不在组里的 space 两部分都有。
- **没有重置按钮**：颜色选"无"就回到默认，**再点一次当前的图标就去掉图标**，两样都已经能回到默认，按钮是多余的（§2.1 克制）。
- **选了立即生效**，弹层不关，可以接着改；点外面或 Esc 关闭。键盘：方向键在网格里上下左右移动（跨过分隔线），Enter 选中。每格悬停提示写名字（`Blue`、`Code`）。
- **图标固定 28 个 Phosphor**，颜色和该行文字同色：folder-simple、code、terminal-window、globe、database、hard-drives、cloud、rocket-launch、flask、bug、book-open、shield-check、cpu、robot、cube、package、wrench、gear-six、chart-line-up、lightning、star、house-simple、briefcase、paint-brush、game-controller、git-branch、lock-simple、chat-circle。
- **行上的样子**：图标（或 8px 小圆点）占 16 宽；不在组里的 space，颜色是整行的淡底色（深色 8%、浅色 4%，§2.4）；在组里的 space 不画自己的颜色，整个组的色块就是它的颜色。
- **存储**：按**文件夹（+ 机器）**存在共享状态里，space 关了再开样子还在；同时写入 `space.colors`，兼容 Herdr 自带的菜单。

#### 4.2.3 选择与右键菜单

选择规则见 §2.6（单击 = 切换到该 space；Ctrl + 单击不切换；Shift 选一段只在同一台机器内）。**样子按 §2.3**：选中的行叠 `selected`；当前 space 另外有左侧指示条；点侧边栏的空白处或 Esc 清空选择。（P1b-1）

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
  - 下半部分是 space 自己的操作：`Tile agents (N)`（§4.2.5）、`Rename`（沿用 Herdr 的 `Shift+F2`；Herdr 的 `F2` 是重命名 tab）、`Appearance…`、`Group ▸`、`Reveal in File Explorer`、`Copy path`、`Close space…`（红色，用 Herdr 自带的 `confirm`）。
- **多选菜单**：`Appearance…`（一次应用到全部）、`Group ▸`、`Copy path`（每个一行）、`Close N spaces…`（用共用的 `confirm.js`：标题 `Close 3 spaces?`，列出名字，正在工作或需要你的 agent 用一句 `2 agents are still working.` 说明；红色按钮 `Close spaces`；Enter 确认、Esc 取消；不可找回，所以没有 `Don't ask again`）。不显示 Terminals、Agents、worktree、Rename、Reveal、Tile。
- **`Group ▸` 子菜单**：已有的组（当前所在的打勾）、`New group…`（把选中的**全部**放进新组，组名立刻进入编辑，颜色自动选一个没用过的）、`Remove from group`（选中里有组成员才显示）。
- **终端发现**（平台适配表的一项）：Windows 用 `where` 查 pwsh / powershell / cmd / bash / wsl，WSL 发行版用 `wsl -l -q`（输出是 UTF-16，要去掉空字符）；macOS / Linux 读 `/etc/shells`。可手动加、隐藏：`terminals.profiles`（名字 + 启动命令）、`terminals.hide`。
- **标签栏的 `+` 和单项菜单的上半部分用同一份代码**，做成独立的 `awsome-menu`（弹出层，props 传 space），`awsome-tabs` 和 `awsome-sidebar` 各自打开。

#### 4.2.4 分组（像 Chrome 的标签组）（P1b-2，✅ 已做，待你试用）

**一个组 = 一块组色的圆角色块**（2026-11-26，用户在三种方案里选了"色块"：分区、色块、缩进树）。三个问题都由这一块回答：**在不在组里**看在不在色块里；**是哪个组**看色块的颜色；**组有多大**看色块的大小。所以不再用缩进、组头色点、每行的淡底来表示分组。

- **色块**：宽度和行一样（左右不留边），没有边框（浅色主题下色块很淡，靠色块之间的 8 空隙分组，不再加线），圆角 8（和行一样，选中的首行、末行和色块的角重合）；底色是组的颜色，深色 8%、浅色 4%（和 space 的淡底同一个令牌 `label.tint`，对比度由 C2 检查）。色块和上下相邻的行、色块之间隔 8（shadcn `SidebarGroup` 的 `p-2`），比行距 4 大一倍，让每个组成为一个整体。
- **组头**：色块里的第一行，28 高：折叠箭头（12，`muted`）放在 16 宽的格子里，**和 space 的图标同一列**；组名（13、中等粗细、`foreground`，**可留空**）**和 space 的名字同一列**；组里有 space 需要你时，组名后面隔 8 一个 8px `blocked` 圆点。没有数字、色点、图标（折叠时悬停提示写 `3 spaces`）。**单击组头 = 折叠 / 展开**。
- **成员**：不缩进，图标和名字与组外的 space 对齐在同一列；不画自己的颜色（组的颜色就是它的颜色），只保留自己的图标。自己设过的颜色记着，离开组后恢复。
- **折叠**：只剩组头那一行色块；切换到折叠组里的 space 时，组自动展开。Agents 列表不受折叠影响。
- **重命名组**：组头右键 `Rename`，组名**就地变成输入框**并选中全部文字；Enter 保存、Esc 取消、点别处保存；清空也可以（组名留空）。惯例见 `design/conventions.json` 的 `inline-rename`。
- **新建组只走菜单**（`Group ▸` → `New group…`）：选中的 space 全部进新组，组名立刻进入编辑，颜色自动选一个没用过的。**不做** `Close group`（会连带关掉正在跑 agent 的 space）。
- **组头右键**：`Rename`、`Appearance…`（只有颜色）、`Collapse` / `Expand`、`Ungroup`。
- **拖拽**（通用规则见 §2.6：移动超过 6px 开始拖；插入位置是 2px `accent` 线：插进组里时线画在色块里面，放到组外时线画在色块之间的 8px 空隙里；放到组头上时整个色块加 1px `accent` 描边；不能放的地方没有高亮）：

| 松手位置 | 结果 |
|---|---|
| 组头 | 加到该组末尾（折叠的组也行，仍保持折叠） |
| 色块里两行之间 | 加入该组并插在那里 |
| 色块外的行之间、色块之间的空隙 | **离开原来的组**，放在那里 |
| 别的机器的区块 | 不允许 |

- **拖组头** = 整组连成员一起移动；只能放在组外的行之间，**组不能嵌套**（拖到别的组中间会落在那个组后面）。
- **移出组有三种**：把成员拖到色块外；`Remove from group`；组头的 `Ungroup`（成员原位留下，恢复各自的颜色）。最后一个成员离开，组自动消失。
- 松手后用 `space.move` **真的调整 Herdr 的 space 顺序**，让可见顺序和 `Alt+数字` 一致（worktree 嵌套现在就是这么做的）。**worktree 跟着它的主 space 走**，一整家人一起进出组。没有键盘拖拽，键盘用菜单。
- **边界**：组只在同一台机器的区块内；成员关系按文件夹（+ 机器）记，space 关了再开仍在组里；数字快捷键按全部 space 编号（含折叠的）。
- **常用动作的步数**：加入或移出组 = 拖 1 次；新建组 = 选中 → 右键 → `New group…`；改颜色 / 图标 = 右键 → `Appearance…`；折叠 = 点组头；重命名 space = `Shift+F2`。

#### 4.2.5 平铺：把 space 里的 agent / 终端集中到一个画面（⏸ 2026-11-26 推迟，用户决定以后再做）

> **验证结论（重启这个功能时先读这里）**：
> - **浮窗**：`openOverlay({ kind: "window", layout: { …{ terminal } 块 } })` 可行，不碰任何 pane；缺点是平铺期间原 pane 会被重排成浮窗的宽度，乱断行；Esc 交给终端，要自己画关闭按钮。
> - **主区域**：布局的 `main` 换成 `stack`（`{tab:"active"}` / `tile`），`layout.set` 生成 `tile`，`layout.select` 切换，来回都验证可行，且没有重排问题。但 **`layout.set` 会改写布局文件**（并把面板 `hidden` 等运行时状态写进去），所以必须用临时布局副本（`awsome-tile`）：切过去、退出时切回并删除，`awsome.json` 永不改写。
> - **长期的 edge case**：agent 增减时更新；切 tab / space 自动退出；平铺中重启要自检回到 `awsome`；临时布局会进 `Ctrl+Shift+L` 的循环；`sync.sh` / `install.sh` 要忽略它；终端块有焦点时 split / close / zoom 等隐式命令失效；格子数设上限；SIGWINCH 重绘；远程 space 未验证。
> - **来回**：去 = space 右键 `Tile agents (N)` / 快捷键；回 = 每块标题上的关闭按钮 / 同一快捷键 / 点标签栏的 tab。

以下是当初的设想，做的时候以上面的结论为准。

- **做法**：用 Herdr 的 `openOverlay` 开一个**浮动窗口**，里面是这个 space 的终端，每个一块 `{ terminal: id }`，自动排成网格（1 个全屏，2 个左右，3～4 个 2×2，更多 3 列）。**不搬动任何 pane**，所以"复原"就是关窗口，原来的 tab 和分屏 100% 原样。
- **入口**：space 右键 `Tile agents (N)`（没有 agent 时写 `Tile terminals`）；**快捷键开关**（再按一次关闭），默认 `Ctrl+Shift+G`，可在 awsome-config 改，**上机实测后定**。
- **范围**：该 space 里所有 agent（含 sub agent）；没有 agent 就平铺所有终端。设置项 `tile.include`：`agents`（默认）/ `all`。
- **每一块**：小标题（名字、状态点、时间）；**需要你的排最前并自动聚焦**；点一块 = 键盘进入那块；标题上的 `Open in its tab` 跳回它真正所在的 tab 并关窗口。窗口用 `key` 记住大小和位置。
- **为什么不真的搬进一个 tab**：Herdr 没有"把 pane 移到另一个 tab"的命令，只能 `terminal.park` + `terminal.keep {place: right|down}` 拼，**原来的分屏比例恢复不了**，搬走最后一个 pane 时原 tab 可能被关。以后需要再加 `Gather into a tab`。
- **先做小验证**：同一个终端同时出现在原 pane 和浮窗里是否正常；键盘焦点、Esc 是否被终端吃掉；快捷键是否可用。验证不过就停下来和你商量。

#### 4.2.6 P1 规格：侧边栏和 space 右键菜单（✅ 预览已确认 2026-11-25）

> 数值都在 `design/tokens.json` 的 `sidebar`、`menu` 里，来源是 shadcn/ui 的 Sidebar 和 ContextMenu；字号统一换算（shadcn `text-sm` → 13，`text-xs` → 11）。颜色只用主题令牌（§2.4）。

**区块（Spaces、Agents 各是一个区块）**

| 部件 | 规格 | 来源 |
|---|---|---|
| 区块 | 四周留 8px | `SidebarGroup p-2` |
| 区块标题 | 高 32，左右 8，字号 11、中等粗细、`muted`；右侧操作按钮 20×20、图标 16，悬停才有底色 | `SidebarGroupLabel`、`SidebarGroupAction` |
| 行与行 | 间隔 4 | `SidebarMenu gap-1` |

**space 行**

| 部件 | 规格 |
|---|---|
| 行 | 高 28，左右 8，图标与文字间隔 8，圆角 8；悬停叠 `hover` |
| 当前 space | 叠 `selected` + 左侧指示条（4×24，`accent`，§2.3） |
| 左侧 | space 图标或 8px 小圆点，占 16 宽（P1b 才有图标和颜色，P1 先是圆点） |
| 名字 | 13，`foreground`，JetBrains Mono（标识类文字，§2.2），过长省略 |
| 右侧 | 分支名 11、Mono、`muted`，**名字优先占位（最多 150px），分支名占剩下的宽度、靠右、放不下就省略**；`main` / `master` 这类常见分支名不显示（上游做法）；领先 / 落后用小徽标（高 20、左右 4、圆角 8、字号 11、等宽数字，`muted`，如 `↑2`） |
| 需要你 | 名字右侧一个 8px 的 `blocked` 圆点；悬停提示 `An agent needs you` |

**Agents 区（按 space 分组）**

| 部件 | 规格 |
|---|---|
| 分组标题 | space 名，高 28，字号 11、中等粗细、`muted`、Mono |
| agent 行 | 和 space 行同尺寸。左侧 8px 状态点 + 16px 程序图标（Herdr 自带）；名字 13；右侧状态文字 11 |
| 状态 | 工作中：`working` 点 + `muted` 的时长（`2m`）；需要你：`blocked` 点 + `blocked` 色 `needs you`；完成：`done` 点 + `done`；空闲：`dim` 点 + `dim` 的 `idle` |
| sub agent | 每级缩进 12，左侧 1px `border` 参考线（和 Files 树一样，§2.2；不用 shadcn 的 25px 缩进） |
| 当前 agent | 叠 `selected`（不加指示条，指示条只给导航的当前项） |
| 点击 | agent → 跳到它的 pane；没有 pane 的 sub agent → Herdr 的 `terminal.peek` 浮在当前 tab 上查看（自带"保留成 tab"和关闭，天然有去有回，比直接开新 pane 好，保留上游做法） |
| 分组方式 | 默认按 space 分组；排序菜单（标题右侧的时钟图标）里仍可切换，已保存的选择优先 |

**space 右键菜单 / 标签栏 `+` 菜单（共用 `awsome-menu`，基于 `menu.js`）**

| 部件 | 规格 |
|---|---|
| 分组标题 | `Terminals`、`Agents`：高 24，字号 11、中等粗细、`muted`（和侧边栏的分组标题同一种样式），不可点 |
| 终端 | 图标用 Herdr 的 `shell.svg`；名字如 `PowerShell 7`、`Git Bash`、`Ubuntu`；右侧淡色 `Default` / `WSL` |
| agent | **只列已安装的**：Herdr 的程序图标，右侧数字 `1`…`9`，菜单打开时按数字直接启动。最后一行 `More agents ›` 是**侧向展开的子菜单**（悬停、→ 或 Enter 展开；←、Esc 或悬停到别的项收起），列出没安装的 agent（整行半透明、右侧写 `Not installed`）。Herdr 认识 16 个 agent，全列出来菜单会超出窗口（2026-11-25 实测） |
| 其余 | `New worktree…`、`Open worktree…`｜`Rename`（`F2`）、`Reveal in File Explorer`、`Copy path`｜`Close space…`（红色，Herdr 自带确认）。`Appearance…`、`Group ▸` 在 P1b 加；`Tile agents` 已推迟（§4.2.5） |
| 标签栏 `+` | 同一个菜单，只有 Terminals、Agents、worktree 三组，作用于当前 space |
| 键盘 | ↑ ↓ 移动（跳过标题和不可用项）、Enter 执行、Esc 关闭、数字键启动 agent |
| 尺寸 | 紧凑、以 4 为单位，和侧边栏同比例：菜单项行高 28、分组标题 24、内边距 4、左右 8、图标 16、间隔 8、分隔线 9（`design/tokens.json` 的 `menu`） |

#### 4.2.7 agent 右键菜单 ⬜（规格已确认 2026-11-26，预览待确认）

做法取自 VS Code 终端 tab 的右键菜单和浏览器 tab 的右键菜单（登记在 `design/conventions.json` 的 `agent-menu`、`agent-close-confirm`、`inline-rename`）。**不引入新数值**：用 `awsome-menu` 现成的尺寸、字号、颜色令牌（§4.2.6 的"尺寸"行），新增一个 `scope: "agent"`，作用于被点的那个 agent（`props: { scope: "agent", terminal }`）。

- **触发**：右键 agent 行（含子 agent、Pinned 里的）。右键未选中的行 = 先选中它，再出菜单（§2.6）。agent 区暂不做多选，所以只有单项菜单。
- **菜单**（顺序按 §2.6，分隔线分组）：

| 组 | 项 | 做法 | 什么时候 |
|---|---|---|---|
| 打开 | `Focus` | `agent.focus {terminal}` | 总有 |
| 打开 | `Open in its own tab` | `terminal.keep {terminal, place:"tab"}` | 只对**没有 pane 的子 agent** 显示 |
| 编辑 | `Rename pane` `F2` | 行内编辑，写 `pane.rename {pane, name}` | 没有 pane 的子 agent 灰掉，tooltip `It has no pane to rename` |
| 整理 | `Pin` / `Unpin` | `terminal.pin {terminal, pinned}` | 总有，按当前状态换字 |
| 整理 | `Send back` | `terminal.park {terminal}` | 只对**有 pane** 的显示（agent 继续运行，只收起 pane） |
| 复制 | `Copy working directory` | 写剪贴板，toast `Copied` | 有 `cwd` 时 |
| 危险 | `Close agent…` | `terminal.kill {terminal}` | 总有，红色、放最后 |

- **只用 Herdr 自己的命令**：对所有 agent 一样有效。`/rename`、`/branch`（fork）、`/resume` 是各家 agent CLI 自己的命令，目前只在 Claude Code 的文档里查实，**其余 agent 没把握，所以不做**（2026-11-26 你定的）。以后某个 agent 的命令查实了，再单独加，并按"程序 → 命令"表逐个启用。
- **Rename pane 的行内编辑**：和 space、组一样（惯例 `inline-rename`）：行里的名字变成输入框并全选，Enter 保存、Esc 取消、点别处保存、留空 = 保持原名；`F2` 在 agent 行有焦点时同样触发。
- **Close agent… 的确认**（惯例 `agent-close-confirm`）：agent 是 `idle` 或 `done` → 直接关；`working` 或 `blocked` → 先用 Herdr 自带的 `confirm`：标题 `Close <name>?`，正文 `It is working. Closing stops it.`（`blocked` 写 `It is waiting for you. Closing stops it.`），红色按钮 `Close agent`，Enter 确认、Esc 取消。没有 `Don’t ask again`（关掉的 agent 找不回运行状态）。
- **有去有回**（`design/flows.json`）：菜单 ⇄ 点空白处、Esc；Rename pane ⇄ Enter / Esc / 点别处。
- **不做**：Rename session、Fork session、Resume session（见上）；多选 agent 的批量操作；读会话文件找会话 id；命令行 `--fork-session`（取"当前目录最近一次会话"，同目录多个 agent 会分叉错）。

### 4.3 awsome-filetree：视觉和基础操作 🟡

**原型已做（未提交，已同步到你的 Herdr）**：标题栏（根文件夹名 + Tree / Recent 切换 + 5 个 Phosphor 图标按钮：上一级、跟随终端、显示隐藏文件、显示大小、全部折叠，开着的有底色）；汇总（分支 +N −N、2px 细条、计数）；过滤框独立一行；树行高 22、缩进 12、缩进参考线；右键文件夹 `Open as root`。

**进入和退出文件夹（Backspace / Enter 系列，已确认）**：
- **上一级 = `Ctrl+Alt+Backspace`，进入选中的文件夹 = `Ctrl+Alt+Enter`**。单独的 Enter 已经是"展开或打开"，所以导航键带修饰键，不去抢它。Windows 上实测都能到达文件树。
- 原型里还留着旧键位（单独的 Backspace、Shift+Enter、Ctrl+Alt+↑ / ↓），**执行时去掉**，只留上面两个；改成可在 awsome-config 里重绑（§8 实现说明）。
- 上一级之后，光标停在刚离开的那个文件夹上，可以马上按 `Ctrl+Alt+Enter` 回去。

**执行时要验证**：缩进参考线、悬停、键盘光标的描边（§2.3）。

### 4.3a 文件树的行内信息：极简默认，详细可选 ✅

**默认视图：一行只有三样：图标、名字、名字的颜色。** 状态颜色见 §2.4；行数、时间、大小默认不显示。

- **文件夹**：名字取里面最严重状态的颜色，不画数字、不画小点；悬停给明细（`1 new · 2 modified`）。
- 其它标记一种状态一种写法：被忽略 = 名字变灰；隐藏文件 = 名字更淡；符号链接 = 名字后一个小箭头图标。
- **顶部汇总**：**彩色数字加文字**（`1339 new · 3 modified · 2531 deleted`，零值省略）、右边总行数 `+N −N`、一条 2px 的比例细条（§2.9）。~~分支名、领先落后~~（2026-11-26 去掉：侧边栏和状态栏已有分支名）。多 repo 时跟随 Changes 里选中的 repo。

**详细模式（标题栏的滑杆图标开关，记住选择）= 极简 + 三个槽位**：

| 槽位 | 内容 | 规则 |
|---|---|---|
| 行数变化 | `+4 −1` | 只给有改动的文件；文件夹不显示，悬停时汇总 |
| 次要列 | 时间 / 大小 / 无 | 三选一，默认时间。相对时间（`2m`、`3h`、`1d`），所有文件都显示，文件夹显示里面最近一次修改。文件夹大小只在选中或悬停时算（POSIX 用 `du`，Windows 用 PowerShell） |
| "刚动过"小点 | 名字前一个 `accent` 小点 | 最近 N 分钟（默认 10，0 = 关）被修改过的文件；不依赖 hook |

- **对齐**：右侧信息靠右成列，各列固定宽度、右对齐，所有行上下对齐：行数变化（64px，`+N` 和 `−N` 各占固定宽度）在最左，次要列（34px）在右。名字过长在末尾省略，不推挤右边。
- **悬停提示**：极简视图里，悬停一行 = 看到详细模式的全部信息（`Modified · +4 −1 · 2m ago`；文件夹 `2 modified · 1 new · +12 −3`）。用 Herdr 的 `tooltip`（纯文字，贴着这一行，不跟随鼠标，延迟由 Herdr 决定）；手感不对再换 `HoverCard`（默认 600ms 出现、300ms 关闭）。
- **响应式**：只看名字那一列还剩多宽。不足约 120px（面板约 300px）就**整体退回极简**，不做中间状态；拉宽了自动恢复，开关的选择不丢，窄时滑杆图标变灰并在 tooltip 写原因。阈值 `row.detailMinWidth`（默认 300）。
- 每行最多 4 个子元素，渲染预算安全。~~Recent 视图~~ 已去掉（§4.5b A5）。
- **agent 读写闪烁层**：去掉（依赖 Claude Code 的 hook，在这台机器上休眠）；"刚动过"小点代替它。以后要 agent 归因，用 Herdr 自己的 `agents()` 做。✅ 2026-11-26 已去掉（连同 git 动作小标签，§4.5b）。

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
- 选中 2 项以上，标题栏下出现**选择条**：`3 selected`，三个动作 `Send to agent`、`Copy path ▾`（`Copy relative path` / `Copy absolute path`）、`Move to Trash…`，最右是清除。
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
| `Move to Trash…`（只进回收站，见 §4.3c） | 有 | 有 |

- **Send to agent**：默认发给当前 space 的主 agent，子菜单里可以换；复用 `awsome-viewer` 已有的发送机制，多个路径拼成一条消息。
- **删除**：只进系统回收站，永不永久删除；确认对话框、命令、各系统的做法和 Windows 的限制见 §4.3c。设置项 `confirm.delete`（默认开）。

### 4.3c 文件树右键菜单重排；新建、重命名、移到回收站（2026-11-27）⬜

**决定的经过**（以后重读时不用再查）：用户要求在文件树右键加上删除、新建文件、新建文件夹、重命名，并按 VS Code 的行为重排菜单；又说"删除只进回收站，永远不永久删除"。用户已选：① 名字用**行内输入**（VS Code 做法）；② **F2** 重命名，全平台一样，只在文件树有焦点时生效；③ **只改文件树的菜单顺序**（Rename 和 Move to Trash 放在最后一组），§2.6 对别的菜单不变；④ **Windows 的回收站先禁用**，等在真机验证之后再开。

**来源**（规则 0）：
- VS Code 源码 `fileActions.contribution.ts`，资源管理器菜单分组：`navigation`（New File、New Folder）→ `3_compare` → `5_cutcopypaste` → `6_copypath` → `7_modification`（Rename…、Delete）。新建在文件夹菜单最上面，改名和删除在最后一组。命令名和验证文案同一文件；删除对话框的文案见 `fileActions.ts`。
- 别的 Herdr mod：只有 linziyanleo/herdr-mods 的 `files-plus` 做了新建、重命名、删除。借它的**技术**：新建用 noclobber（`set -C`）、重命名用 `mv -n`，都不会覆盖已有文件。**不采用**它的删除：它在 Windows 和 Linux 上是永久删除，违反本仓库规则。
- Herdr 自带 `confirm`：Cancel 在前、Confirm 在后，Enter 确认、Esc 取消。
- **已在真窗口验证**（2026-11-27）：`v_virtual_list` 的一行里放 `Input` 能画出来、能用代码（`InputState.focus()`）或点击拿到焦点、能打字。没测：行内 Enter / Esc 的处理、只选中主文件名。

**1. 菜单**（只对 Files 面板；顺序由用户 2026-11-27 选定，偏离 §2.6，见 `design/conventions.json`）

文件夹（单选，本机）：
```
New file…            新建类
New folder…
──────
Open as root         打开类（和现在一样）
Reveal in Finder
──────
Send to agent  A     整理类
──────
Copy relative path Y 复制类
Copy absolute path ⇧Y
──────
Rename…  F2          修改类：Rename 和 Move to Trash 放最后，Move to Trash 红色
Move to Trash…  ⌘⌫ / Delete
```
文件（单选）：第一组是 `Preview`（Space）、`Open in tab`（Enter）、`Open in default app`、`Reveal in …`；没有 New 和 Open as root；其余和文件夹一样。
多选（≥2 项，§4.3b 的规则：只显示对全体成立的动作）：`Send to agent` ｜ `Copy relative path` / `Copy absolute path` ｜ `Move N items to Trash…`；New、Rename 不显示。

- 名字：macOS / Linux 写 `Move to Trash`，Windows 写 `Move to Recycle Bin`（和 VS Code 一样）。`Move to Trash…` 一律带 `…`（§2.6：危险动作带 `…`，不随 `confirm.delete` 变化，这样标签只有固定的几种）。`New file…`、`New folder…`、`Rename…` 的 `…` 表示还要输入名字（VS Code 也这么写）。
- **没有** `Delete permanently`，也没有对应的键。**回收站失败时只报错，不提供"改为永久删除"**（VS Code 在这里会问是否永久删除，我们明确不这样做）。
- 远程 space（`on` 不为空）：New file / New folder / Rename 用 POSIX `sh` 经 `exec` 执行，可用；`Move to Trash…` 变灰，tooltip 写 `The folder is on another machine`（远程系统不确定，不赌 `gio` 在不在）。
- Windows：`Move to Recycle Bin…` 变灰，tooltip 写 `Not yet verified on Windows`。**原因**：微软的 `FileSystem.DeleteFile(..., 'OnlyErrorDialogs', 'SendToRecycleBin')` 会设 `FOF_SILENT | FOF_NOCONFIRMATION`（.NET `FileSystem.vb` 第 2040–2042 行），按 Windows 文档，回收站放不下（网络盘、U 盘、文件太大）时可能**静默永久删除**；进程不是交互式时 .NET 直接调 `IO.File.Delete`（同文件第 1235 行）。没有任何文档化的标志组合保证"进回收站，否则失败"。等在真机上验证后再开。
- **连带影响**：`awsome-changes` 的 discard 对未跟踪文件也用了同一个 Windows 回收站调用（`git/discard.js` 的 `trashCommand`）。在 Windows 上，只要这一批 discard 里有**未跟踪文件**，整批在动手之前就被拒绝（不会只做一半），提示 `Not yet verified on Windows`；只含已跟踪文件的 discard（`git restore`）不受影响。

**2. 快捷键**（只在 Files 有焦点时生效，写在 `mod:awsome-filetree` 区；`F2` 在别处仍是 Herdr 的 `tab.rename`；全部能在 awsome-config 里重绑，`format: "key"` + `x-action`）：

| 动作 | Windows / Linux | macOS |
|---|---|---|
| Rename | F2 | F2（不用 VS Code 在 macOS 上的 Enter，Enter 仍是"打开"，§4.4a） |
| Move to Trash | Delete | Cmd+Backspace |
| 撤销新建 / 重命名 | Ctrl+Z | Cmd+Z |
| 输入框里确认 / 取消 | Enter / Esc | Enter / Esc |

New file、New folder 没有默认键（VS Code 的资源管理器也没有）。`Cmd+Backspace` 在 Herdr 的 `terminal` 区是 `send:^U`，所以只有文件树有焦点时才拦。

**3. 新建文件 / 新建文件夹**
- **目标文件夹**（VS Code 的规则）：右键的是文件夹就用它；是文件就用它的上一级；没有选中就用当前根。
- 文件夹先展开，**在它的子项最上面**插入一行输入行（22px 行高，图标位用文件 / 文件夹图标，缩进和同级一样），自动拿到焦点。尺寸和颜色全部取自 `design/tokens.json` 的 `panel`：行高 `tree`（22）、字号和现有树行一样（13，`mods/awsome-filetree/main.js` 的根元素；`panel.text` 的 12 只用在过滤框和摘要）、输入框样式同面板的 `Filter files` 输入框（描边 `input`，输入中是 `accent`）。
- **Enter** 建立；**Esc** 取消；**点到别处**：名字合法就和 Enter 一样建立，名字为空或不合法就取消（VS Code 源码 `inlineEditInputBox.ts` 失焦时调用 `_finish(inputBox.isInputValid())`，和侧边栏现有的改名一致；用户 2026-11-27 选定）。不想建就按 Esc。
- 名字里有 `/` 就一并建中间文件夹（`a/b/c.txt`，VS Code 一样，用 `mkdir -p`）；**新建文件夹**时名字末尾的 `/` 忽略。名字以 `/` 开头不允许。
- 不会覆盖：POSIX 用 `set -C; : > "$1"`（已存在则失败）、`mkdir`；PowerShell 用 `New-Item -ItemType File`（已存在则失败，不加 `-Force`）。
- 建好后：**新文件夹**被选中；**新文件**被选中并在预览位打开（和 VS Code 打开新文件一样，§4.4a 的 `preview`）。
- **验证文案**（顺序和规则取自 VS Code `validateFileName`；文字按 L10 缩短，`ui-check` C14 不许新增长句；输入时即时显示在输入行下面，**文字用前景色，红色只用在输入框的边框上**，因为浅色主题下 `ansi1` 红字在 `raised` 底上只有 4.18:1，不到 4.5:1；输入行还没改过时不显示）：
  - 空：`Enter a name`
  - 以 `/` 开头：`No leading slash`
  - 已存在：`“{name}” already exists`
  - 不合法：`“{name}” is not a valid name`
  - 首尾有空格：`Leading or trailing space`（警告，不挡 Enter）
- **不合法的字符**（VS Code 的列表没查到，按系统自己的规则）：所有系统：`/` 和 NUL。Windows 另加 `\ : * ? " < > |`、结尾的空格和点、设备名 `CON PRN AUX NUL COM1–9 LPT1–9`（微软文档 *Naming Files, Paths, and Namespaces*；执行前核对原文）。

**4. 重命名**
- `F2` 或右键 `Rename…`：行内输入**替换**这一行的文件名，已选中**主文件名（不含扩展名）**：`report.final.txt` 选 `report.final`；文件夹或没有点的名字全选（VS Code 的规则）。
- Enter 确认、Esc 取消；点到别处：名字合法就和 Enter 一样，空或不合法就取消。名字没变 = 什么也不做。验证和新建一样（"已存在"按同一文件夹内）。
- 不覆盖：POSIX 用 `mv -n -- "$1" "$2"` 再确认原路径已消失；PowerShell 用 `Rename-Item -LiteralPath`（目标存在会报错）。
- **`mv -n` 的退出码不可信**（2026-11-27 在 macOS 实测）：目标已存在、或只改大小写时，`mv -n` **没有移动也返回 0**。所以一定要在命令后再检查"原路径已不存在、新路径存在"，不能只看退出码；检查不过就当作失败报错。
- **只改大小写**（`a.txt` → `A.txt`，macOS 和 Windows 的文件系统不分大小写；本机实测为不分大小写）：`mv -n a.txt A.txt` 什么也不做，所以先改成临时名（同一文件夹里不存在的隐藏名）再改成目标名，两步都用 `mv -n` 并各自检查。实测两步法可行。
- 改名后行仍被选中；如果这个文件正显示在预览位或有对应的 tab，预览位跟随新路径（用现有的 `${NAME}.preview` 共享状态）；已打开的 tab 暂不处理（见"待定"）。

**5. 移到回收站**
- 命令：**macOS** 用 `osascript -l JavaScript` 调 `NSFileManager.trashItemAtURL`（已实测：成功时进回收站；不存在的路径、只读文件夹里的文件都返回错误且文件原样不动；不触发 Finder 自动化授权）；**Linux** 用 `gio trash -- <路径>`（`g_file_trash` 在没有可用回收站时返回错误，不会删除；不用 `--force`）；**Windows** 先不做（上面）。文件夹同样处理。
- **永不回退到 `rm`**：命令失败就把错误写进 toast（`Could not move “name” to the Trash`），项原样留着。
- 确认对话框用 `confirm.js`（§2.6）：标题 `Move “name” to the Trash?`（多选 `Move 3 items to the Trash?`），说明 `Restore it from the Trash.`（按 L10 缩短，C14 不许新增长句；Windows 写 `Recycle Bin`，但 Windows 上这个功能先禁用），红色按钮 `Move to Trash`，Cancel 在前，带 `Don’t ask again`（勾上就把 `confirm.delete` 设为关）。完成后 toast `Moved “name” to the Trash`。
- 完成后光标落在原位置的下一行（没有下一行就落在上一行）。**删除没有应用内撤销**（§4.4）；在系统回收站里恢复。

**6. 撤销**（`Ctrl+Z` / `Cmd+Z`，只在 Files 有焦点；内存里的栈，最多 20 步，换根或关闭就清空）
- 撤销**重命名**：`mv -n` 改回原名；原名已被占用就失败并提示。
- 撤销**新建**：只在建出来的项**仍然是空的**（文件 0 字节、文件夹里没有东西）时才移除，否则不动并提示 `Not empty; left in place`。**移除用 `rm` / `rmdir`，不进回收站**（用户 2026-11-27 同意：空项里没有任何内容，不会丢东西；这是对"从不永久删除"的唯一例外，只限这一处）。
- 撤销不跨 space。

**7. 这一版不做**：Cut / Copy / Paste、Duplicate、拖拽移动（§4.4）、批量重命名（§10）、永久删除、侧边栏上的 New file / New folder 按钮、重命名输入里 F2 循环选中。

**8. 设置项**：`confirm.delete`（默认开），写在 `mod.schema.json`；快捷键 `awsome-filetree.rename`、`awsome-filetree.trash`、`awsome-filetree.undo` 用 `format: "key"` + `x-action`。

**9. 待定与已定**：
1. ✅ 撤销新建的移除方式：仍为空才用 `rm` / `rmdir`（用户 2026-11-27 选定）。
2. ✅ 输入行失焦：名字合法就生效，空或不合法就取消（用户 2026-11-27 改定；先前选的"取消"在查到 VS Code 源码和侧边栏现有惯例后作废）。
3. 按默认做，用户没反对：重命名后只让预览位跟随新路径，已打开的 tab 暂不处理。
4. 按默认做，用户没反对：远程 space 的 `Move to Trash…` 变灰。
5. 已改：`…` 一律显示（§2.6 原有规则），不再随确认开关变化。

### 4.4 文件操作和打开方式 ⬜

**打开文件**（awsome-filetree + awsome-viewer）：
- **单击** → 在布局里的全局预览位显示（再单击别的文件替换内容）；**双击** → 独立 tab。**以 §4.4a 为准**（最初写的"当前 tab 里 `pane.split`"和"预览标签斜体"已作废：全局预览位比每个 tab 一个 pane 更适合长期使用，斜体不需要，因为两者落在不同位置）。
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
- 删除到回收站：见 §4.3c 第 5 节（macOS 用 `NSFileManager.trashItem`，Linux 用 `gio trash`，Windows 先禁用；原先写的 Finder 删除和 `Microsoft.VisualBasic` 调用都可能在回收站不可用时永久删除，已作废）。

**设置项**：`confirm.delete`；撤销的开关和键位。

### 4.4a P2 的完整规格：打开文件 + 文件树的选择（2026-11-26，改定为 B：布局里的全局预览位，不要斜体）

**决定的经过**（以后重读时不用再查）：① 用户："单击在 pane、双击在 tab，区别已经明显，不要斜体"；② 查了 VS Code 源码和微软文档：单击立即执行、双击"转正"，VS Code 不闪是因为两者落在同一个位置；我们的预览和 tab 位置不同；③ 为长期使用比较了三个宿主：**每个 tab 里分 pane**（A，预览随 tab 越积越多，每次分出和关掉都让旁边的 agent 终端重排重绘，还要自己找目标 pane、还焦点）、**布局里的全局预览位**（B）、Files 面板内预览（C，面板窄）；④ 用户选 B。已验证 `layout.show / hide` 能直接显示、收起一个新加的布局节点，不抢 tab 里的焦点。**pane 自带的操作（头部关闭 / 放大、顶部拖拽把手）只属于 `{tab:"active"}` 块里的 pane，布局里的 mod 块拿不到**，所以关闭按钮自己画（调 `layout.hide`），拖宽用布局分隔线（自带）。`floating` 块（可拖、吸附边缘、不挤压终端）以后可作为同一个 viewer 的另一种宿主。

**结构**
- `config/layouts/awsome.json` 在 `work-body` 里 `panel` 和 `main` 之间加一个 `preview` 块：`content: { mod: "awsome-viewer", props: { mode: "slot" } }`，**`size.weight 4`、`min 280`，不设 `max`，不用 `px`**，`hidden: true`，外观（`surface` 底、1px `border`、圆角 10）和 `panel` 相同；同时 `main` 改成 `size.weight 3`、`min 360`。**默认宽度的依据**（用户要求宽一点，参考 VS Code 的代码宽度）：VS Code 的 `editor.wordWrapColumn` 默认 80；80 列代码加 viewer 的 6 列行号区，在默认 14px 字体、viewer 的字符宽度系数 0.62 下约 770px。布局只能写权重，所以按用户的窗口宽度（工作区 1334px）取 4 : 3：文件面板收起时预览位约 762px（≈ 80 列），文件面板展开时预览位约 547px、`main` 约 410px，仍高于 `main` 的 `min 360`。数值登记在 `design/tokens.json` 的 `preview`。大小、是否显示由 Herdr 记住（`layouts/.state`），不由我们存。为什么用权重不用像素，见下面"开、关、响应式、布局变化"。
- `awsome-viewer` 新增 `slot` 模式：读 `shared("awsome-viewer.slot")`（`{ space, file }`）显示文件，**不走 tab 的认领和清理逻辑**（`claimTab`、`pruneViewers` 都不碰，避免和现有注册表互相干扰）。格式、Markdown 预览、图片、代码、diff 标记、刷新全部沿用现有 viewer，一行不重写。头部多两个按钮：`Open in tab`（等于双击）、收起 ×（`layout.hide`，tooltip `Close preview (Esc)`）。
- 记在 `slot` 里的 `space` 和当前 space 不同时，预览位显示空白（不写字），切回来再显示。

**打开**

| 操作 | 结果 |
|---|---|
| 单击文件 | 写 `awsome-viewer.slot`，预览位没显示就 `layout.show`；再单击别的文件只换内容 |
| 双击文件 / Enter / 菜单 `Open in tab` | 在独立 tab 里打开（现有的固定 tab）；文件已有自己的 tab 就切过去。**tab 接管这个文件：预览位显示的正是它时收起预览位**，别的文件不动（2026-11-26 用户试用后改，原来是"预览位保持原样"，§4.5b A2） |
| `Space` | 预览光标行（Finder 的 Quick Look 惯例，不动光标，不开 tab） |
| 方向键 | 只移动光标，不预览（不一路刷新） |
| 预览位头部 `Open in tab` | 把当前预览的文件开成 tab，并收起预览位（"转正"，VS Code 的预览编辑器原地变成固定的） |
| 预览位头部 × / Esc | 收起预览位（Esc 在树里：先清选择，没有选择再收起预览位） |

- 双击用鼠标事件的 `click_count`；同一行才算，两下落在不同行各自当单击。
- **不让布局闪烁**：预览位已显示 → 单击立即换内容，布局不动。预览位**没显示** → 单击等 `open.previewDelay`（默认 250ms，`cx.timer.after`）才 `layout.show`；等待中来了第二下就取消，直接开 tab。所以双击时布局只变一次。取消等待的情况：第二下、点了别的文件、变成多选、切视图、换根、Esc、面板被关。
- 多选（≥2）时单击不打开（§2.6）；Ctrl / Shift + 单击只改选择，预览位保持原样。
- 文件夹：单击展开 / 折叠，不预览；双击没有别的意思。
- 没有斜体、没有新的 tab 标题样式；`awsome-tabs` 不改。

**开、关、响应式、布局变化**（2026-11-26 实测，用 `awsome-spike` 临时布局，已恢复原样）

| 情况 | 实测结果 | 决定 |
|---|---|---|
| 面板 + 预览位都显示，预览位拖到 900px | `main` 被挤成最右边一条细缝，终端一个字符一行 | **预览位不用 `px`、`max`**：Herdr 不保护 `main` |
| 给 `main` 加 `min: 420`（预览位仍是 `px`） | 不让别的块让位，`main` 被撑出窗口右边、被裁掉 | `min` 单独不够，Herdr 不会重新分配宽度 |
| 预览位 `weight 1`、`main` `weight 2`，三列都显示（第一版的数值，已改成 4 : 3） | 文件面板 368 \| 预览位约 320 \| 主区约 630，全部完整 | **用权重**：剩余宽度按比例分，窗口变窄时整体按比例缩，不会把 `main` 挤没 |
| `layout.resize {id:"preview", weight:2}` | 生效，比例立刻变成 1 : 1 | 用户拖分隔线也是改权重（拖拽手感待用户试）；Herdr 把权重记在 `layouts/.state`，重启保留 |
| 切到没有 `preview` 节点的布局（`main`、`terminals`、`win98`）后 `layout.show` | 报错 `no node "preview" in the shown layout` | **捕获这个错，退回面板内预览（C，现有的 `show()`）**；`layout.hide` 的错误忽略。只有 `awsome` 布局带预览位；用户切到别的布局就是 Herdr 自带的面板预览 |
| 面板收起时单击文件 | 文件树就在面板里，所以面板一定是显示的；`awsome-changes`、搜索等别处调用预览位时，面板收起也不影响 | 预览位和面板各自独立开关 |
| 窗口窄到所有块的 `min` 加起来超过窗口 | Herdr 不夹住，多出的部分被裁掉（上面 `min` 实验同理） | 这是 Herdr 的限制，不绕。缓解：`min` 取小（预览位 280、`main` 360），默认预览位收起；用户可以收起预览位或面板。预览位自己的宽度小于 200 时，只画收起按钮 |
| 预览位是否显示，我们怎么知道 | **已验证**：`layout()` 返回的树里，隐藏的节点有 `"hidden": true`，显示后这个字段消失，是实时的 | 用 `layout()` 读（`slotShown()`），不自己记；只有"没显示时等 250ms"用得到 |
| 用户在 Herdr 里手动收起 / 显示预览位（布局菜单、`layout.toggle`） | Herdr 负责 | 我们不另存显示状态，下一次单击再 `layout.show` |
| 重新安装布局（`install.sh`） | 旧布局文件移进备份；`layouts/.state` 里的运行时大小会被新文件里的值覆盖（AGENTS.md："deliberate layout-file edit beats a click"） | 用户重装后预览位回到默认比例，属预期 |

**长期使用的边界情况和决定**

| 情况 | 决定 |
|---|---|
| 预览位是全局的，会不会越用越多 | 不会：全局只有一个，不随 tab 增加；关掉 tab 不影响它 |
| 切到别的 space，它还显示上一个项目的文件 | 记着自己属于哪个 space，不是当前 space 就显示空白（不写字）；回来恢复 |
| 同一个文件已经固定在某个 tab 里 | 单击仍在预览位里显示（只是看，不切 tab、不打断你在做的事）；双击、Enter 切到那个 tab |
| Herdr 重启 | 显示与否、宽度由 Herdr 的布局状态恢复；预览位的文件由持久化的共享状态恢复，文件不在了就由 viewer 显示原因（沿用现有） |
| 显示 / 收起预览位会让 `main` 里的终端重排 | 固有的一次性代价：用户不收起它就不再变，所以不是"每次单击一次"。无法避免，推迟 250ms 已让双击不白重排一次 |
| 预览位隐藏时有没有后台开销 | 实现了但没法实测（看不到 Herdr 内部）：隐藏的块里的 viewer 不应该轮询（viewer 的 300ms 同步、2 秒读文件、git diff）；没有文件时 `slot` 模式不启动这些计时器 |
| 快速连点换文件 | 只写共享状态里最后一个，viewer 自己同步（现有 `reading` 防串），不排队；换文件重置滚动位置 |
| 二进制 / 超大 / 已删除 | 由 viewer 自己显示原因（现有行为），不弹框 |
| 远程 space（`on`） | `slot` 里带 `on`，和现有 viewer 一样 |
| 单击后文件树的键盘焦点 | `layout.show` 没有改变 tab 里的焦点 pane（已验证）；文件树自己的键盘焦点由用户确认，若被抢走再 `handle.focus()` 还回去 |
| 安装 | `install.sh` 会换掉 `layouts/awsome.json`（旧的移进备份）；用户自己改过的布局要从备份里拿，和现在一样 |

*设置*（`awsome-config`，文字英文）：`open.preview`（`slot` / `off`，默认 `slot`；`off` = 单击只选中，只有双击 / Enter 打开，Windows 资源管理器的习惯，VS Code 的 `workbench.list.openMode: doubleClick` 也是这样）、`open.previewDelay`（默认 250ms，0 = 不等，只在预览位没显示时起作用）。

*选择的边界情况*

| 情况 | 决定 |
|---|---|
| 文件在磁盘上被删 / 改名 / 刷新后不存在 | 刷新树时把选择集合里不存在的路径剔除；剔到 < 2 项选择条消失 |
| 折叠文件夹后，里面的已选项看不见 | 仍算选中（§4.3b），`N selected` 数的是全部；Shift 连选只按**可见**行算 |
| 过滤 / 搜索改变了可见行 | 过滤只改显示，不动选择；换视图（Tree / Recent / Search）清空 |
| 换根（上一级 / 进入 / Open as root） | 清空选择（路径相对根，保留会指错） |
| 选了很多（Shift 连选上千个） | 条上显示实数；`Send to agent` 超过 100 个路径时先用共用确认框问一次（`Send 250 paths to the agent?`），不静默截断；`Copy path` 不限 |
| 选择条出现让树下移 | 滚动位置按"第一行可见项"保持不动 |
| 选中集合 ≥2 时右键 | 右键的行在集合里 → 多选菜单；不在 → 集合变成它（§2.6） |
| 用 Ctrl 把集合减到 1 项 | 选择条消失，这一项仍是选中，**不自动预览**（预览只由单击和 Space 触发） |
| 拖拽、批量删除等 | P3 再做；P2 的选择集合只被 `Send to agent`、`Copy path` 使用 |

**选择**（规则全在 §2.6；本节只写文件树自己的部分）
- 状态：`cursor`（键盘光标，保留）+ `selected`（集合）+ `anchor`。单击 = 只选它；Ctrl（macOS Cmd）+ 单击加入 / 移出；Shift + 单击按**可见顺序**从锚点连选；Shift + ↑ / ↓ 扩展；**Ctrl+Space 切换光标行**（Explorer、VS Code 都有）；Esc、点列表空白处清空。
- 选中的行叠 `selected`（单选多选同一种画法，§2.3）；键盘光标行在列表有焦点时多一圈 1px `accent` 内描边。
- 文件夹行：单击只展开 / 折叠并把它设为唯一选中；Ctrl / Shift + 单击只改选择，不展开。折叠文件夹不丢里面已选的项。
- 右键：未选中的行 → 选中集合先变成它，出单项菜单；已选中且集合 ≥2 → 多选菜单（`Send to agent`、`Copy relative path`、`Copy absolute path`；`Delete…` 等 P3 再加，不放灰按钮）。

**选择条**（选中 ≥ 2 项才出现，在标题栏和树之间；P2 里只有三样，不留空位）
- 高 32（和 `layout.bar` 同一条横线网格），`px 8`，`gap 4`，底部 1px `border`，底色 = 面板底色（不另加色块）。
- 左：`N selected`，12px，`foreground`。右：`Send to agent`、`Copy path ▾` 两个 ghost 小按钮（高 24、`px 8`、12px、圆角 6、悬停 `hover`），最右一个 16px 的 × 图标按钮（tooltip `Clear selection (Esc)`）。
- `Copy path ▾` 点开的菜单就是共用菜单：`Copy relative path`、`Copy absolute path`。
- 条出现 / 消失会让树整体上下移一次：不做动画，直接切。
- 颜色、字体全部取现有令牌（`foreground`、`muted`、`border`、`hover`、`selected`、`accent`），没有新颜色；对比度沿用 §2.4 已算过的"行上 `muted` 文字 ≥ 4.2"。数值 32 / 24 / 8 / 4 是 4px 网格（`layout.bar` = 32），按钮 24 取自 shadcn `Button size="sm"` 的紧凑档。选择条和选中行的预览截图已给用户看，用户只对斜体提了意见，其余等用户明确确认。

**预览位的头部和外框**（2026-11-26，用户确认预览；原则："预览文件的 UI / UX 尽可能贴近 Herdr 原生 pane 的表达方式和视觉语言"）

- **来源**：Herdr 自带 `pane` mod（`~/.config/herdr-app/mods/pane/main.js`）：头部行高 30、左右 10、间距 8、字号 12；按钮是 14px 图标、`p(3)`、圆角 4，平时 `dim`，悬停变 `foreground` 加 `hover` 底；按钮**只在鼠标移到头部时显示**。外框取布局里 `main` 的 pane 外框：`background` 底、1px `border`、圆角 10、聚焦时 1px `accent` 边框（布局的 `focus` 对 mod 块不生效，改由 viewer 自己画，见 §4.4b）。
- **头部**：文件图标、文件名（中等粗细）、文件夹（`dim`）；右边两组图标按钮，组间一条 1px × 12px 的 `border` 线（同文件树标题栏）。
  - **文件视图组**（只有 Markdown 文件，**始终显示**，是状态）：`eye` = `Rendered view`、`code` = `Source`，当前的用 `selected` 底。它是文件的显示方式，和预览列无关，所以与下一组分开；在普通 tab 里的 viewer 也是这一组。
  - **预览列操作组**（只在预览列，**鼠标在头部时显示**）：`arrow-square-out` = `Open in tab`、`x` = `Close preview`；按钮间距 2。
- 图标全部取 Awsome Icons 里的 Phosphor 图标（`eye`、`code`、`arrow-square-out`、`x`）。其他文字按钮（`Expand all`、`Open in`、`Keep tab`）不是预览列的操作，这次不动。
- 数值登记在 `design/tokens.json` 的 `paneHeader`。

**往返**（登记在 `design/flows.json`）：预览位（去：单击 / Space；回：× / Esc / 再单击别的文件换内容）；独立 tab（去：双击 / Enter / `Open in tab`；回：关 tab）；单选 ⇄ 多选（去：Ctrl / Shift + 单击，或 Shift + ↑↓、Ctrl+Space；回：Esc、点空白、选择条 ×，或普通单击）。
**惯例**（`design/conventions.json`）：`preview-slot`：Windows 资源管理器的预览窗格（一个固定位置的窗格，跟着选中的项显示，可开关）、VS Code 的预览编辑器（单击预览、双击固定）、Finder 的 Quick Look（Space）。
**验证清单**：实现前：隐藏块里的 viewer 不轮询；文件树键盘焦点不被抢。实现后：`herdr-app check` 三个 mod；`ui-check.py`；用 `herdr-app do layout.show` 等模拟，截图确认；`ui-open-check` 核对预览位尺寸不为 0；点击手感请你试（§5.2 的 P2 一行）。

### 4.4b 预览列用起来像 pane（2026-11-27，预览用户确认，已实现，交互待你试）

**用户的意图**："预览列无法像 pane 一模一样的功能"。预览列看起来像 pane，用起来也要像：能聚焦、能看出聚焦、能放大、能用 `Alt+H/J/K/L` 进出。**快捷键不改**（用户 2026-11-27：现有键位是之前花很长时间调好的；原来规格里的 `Ctrl+Shift+Z` / `Ctrl+Shift+X` 已撤回）。**做不到的不做**（用户 2026-11-27）：分屏（`pane.split`）、拖动把手换位置、`pane.swap`、`pane.rename` 只属于 tab 里的 pane，布局里的 mod 块拿不到（`herdr.d.ts` 的 `movable`、AGENTS.md "Zoomed tabs and one-pane tabs don't drag"）。

**来源**：全部取 Herdr 自己：`pane` mod 的头部按钮（`split-right`、`split-down`、`zoom` / `unzoom`、`close`，只在鼠标在头部时显示）、布局 `main` 的 pane 外框（1px `border`，聚焦 1px `accent`，圆角 10）、`pane.go`（`Alt+H/J/K/L` 用现有键位，不新增、不改键）。

**1. 聚焦边框（修 bug）**
- 原因（已查）：布局节点的 `focus` 边框只在"焦点 pane 在里面"时画（AGENTS.md："`focus` … when the focused pane is inside"）。预览列是 mod 块，不是 pane，所以 §4.4a 写的"聚焦时 1px `accent`"从来没生效过；文件面板（`panel`）同理。**文件面板不要蓝边**（用户 2026-11-27），它那个无效的 `focus` 字段一并删掉；C3 拦下没有 pane 的节点上的 `focus`（L23）。
- 做法：布局 `preview` 块去掉 `border` 和 `focus`，保留 `background`、`radius 10`；viewer（只在预览列）自己在根元素画 1px 边框、圆角 10：平时 `border`，**viewer 有键盘时 `accent`**。像素位置和现在的灰边相同，不加粗、不内缩。
- "有键盘"：编辑器的 `focus` / `blur` 事件；没有编辑器时（Markdown 渲染视图、图片、说明文字）用 viewer 根元素自己的 `FocusHandle`，点一下就聚焦；跳行条输入框聚焦时也算。
- 对比度（实测令牌）：`accent` 对 `background`，深色 `#0091ff` / `#171717` = 5.5，浅色 `#1e6ef4` / `#ffffff` = 4.6，都高于非文字元素的 3:1；和 `main` 里 pane 的聚焦边框同一个令牌。

**2. `Alt+H/J/K/L` 进出**
- `mod.json` 加 `"focusable": true`：`pane.go` 能移进预览列（AGENTS.md："`pane.go` also reaches visible mods whose `mod.json` says `focusable: true`"）。收到 `focus` 命令时，把键盘给编辑器（没有编辑器就给根元素）。
- 出去：Herdr 自己处理（"starts from that mod while it holds the keyboard"），不用写代码；要实测编辑器没有吞掉 `alt-h/j/k/l`。

**3. 放大 / 还原**
- 头部预览列操作组变成三个按钮（同 Herdr `pane` 的顺序：放大在关闭左边）：`tabs` `Open in tab`（保留，用户 2026-11-27）、`arrows-out-simple` `Zoom`（放大后换成 `arrows-in-simple` `Exit zoom`）、`x` `Close preview`。图标是 Phosphor regular，形状和 Herdr 的 `zoom.svg` / `unzoom.svg` 相同（两个斜向箭头，向外 / 向内）；`arrows-*-simple` 在别处没用过，不和其他意思重复。
- 放大 = 记下 `panel` 当时是否显示，然后 `layout.hide` `main` 和 `panel`，预览列占满工作区（侧边栏、tab 栏、状态栏不动，和 Herdr 的 pane 放大一样只占自己那块区域）。2026-11-27 已实测：隐藏 `main` 和 `panel` 后预览列铺满，再 `layout.show` 能完整恢复，没有报错。
- 还原 = `layout.show main`，`panel` 原来显示才显示。记录放在共享状态 `awsome-viewer.zoom`（`{ panel, tab, pane }`：放大时的面板状态和焦点位置），代码在 `actions/zoom.js`。
- **自动还原**（不让用户困在看不到终端的状态）：预览列被关掉（×、Esc、`Open in tab` 接管，别的 mod 收起预览列时在 300ms 的同步里发现）；切 space；`focused()` 的 tab 或 pane 变了（点 tab 栏、`agent.focus` 到别的 pane、点通知）；Herdr 重启、切布局、mod 重新载入（预览列重新出现时发现有放大记录就还原）。限制：`agent.focus` 落在放大前同一个 pane 上时看不出变化，不还原，点 `Exit zoom`。
- 按钮只在鼠标在头部时显示（同 Herdr `pane`）。放大没有快捷键（快捷键不改）。

**4. 键**：不加、不改（用户 2026-11-27）。预览列有键盘时按 `Ctrl+Shift+Z` / `Ctrl+Shift+X`，仍是 Herdr 全局的 `pane.zoom` / `pane.close`，作用于 tab 里当前的 pane，和以前一样。

**往返**（`design/flows.json`）：放大 ⇄ 还原（鼠标：`Zoom` ⇄ `Exit zoom`；没有键）；进预览列 ⇄ 出来（键：`Alt+H/J/K/L`；鼠标：点预览列 ⇄ 点别处）。
**惯例**（`design/conventions.json`）：`preview-focus-ring`（VS Code 的 `focusBorder`、Herdr 自己 pane 的聚焦边框）；`preview-zoom`（Herdr 的 `pane.zoom`、VS Code 的 `Toggle Maximized Editor Group`、Windows Terminal 的 `Toggle pane zoom`：放大后切走或关掉就还原）。
**ui-ux-pro-max 过的结果**：聚焦必须看得见（Focus States，High）→ 第 1 条；悬停才显示的按钮要有别的方式 → 放大没有键，按用户决定接受（快捷键不改），和 Herdr pane 头部的按钮一样只靠悬停；键盘不能困住（Keyboard Navigation）→ 第 2 条实测出去、第 3 条自动还原。同屏交叉：`main` 里 pane 头部也有放大和关闭，图标形状、意思都一样，不冲突。
**不做**：分屏、拖动、换位置、重命名、`pane.resize`（Herdr 没有默认键，预览列用分隔线拖宽）；文件面板的聚焦边框（用户 2026-11-27：不要）。
**验证清单**：`herdr-app check`；`ui-check.py`；截图量边框像素（平时 `border`、聚焦 `accent`，深浅两套）；请你试：点预览列和 `Alt+H/J/K/L` 进出时的蓝边、悬停头部的三个按钮、放大和自动还原。

### 4.5 awsome-changes：VS Code 化 + commit message + discard ✅（设计已确认）

> 画板 06（Changes）、07（提交框）、08（Discard）。

- **布局**：~~标题栏分段控件 `Changes N | History`，右边刷新、列表 / 树切换、更多~~（2026-11-26 改：标题栏只放 `Changes | History` 文字标签，工具移到分支行，见 §4.6a）。**提交框在最上面**（框内右下角两个小图标：`Generate commit message`、`Commit instruction`），下面通栏主按钮 `Commit`（下拉：`Commit (amend)`）。两组 `Staged changes` / `Changes`，可折叠，组头悬停才出现整组操作（`Stage all` / `Unstage all` / `Discard all…`）。
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

### 4.5a P4a 的完整规格：Changes 的布局、文件行、树，和 Files 一起按 §2.9 改（2026-11-26，规格待预览确认）

> 需求：§4.5（画板 06、07）和 §2.9。P4a 不做的：discard（P4c）、多 repo（P4d，只有一个 repo 时 Repositories 列表本来就隐藏）、生成 commit message（P4e，提交框里那两个小图标留到 P4e）。

**Changes 视图从上到下**
1. 标题栏（§2.9）。
2. ~~分支行~~（交叉核对后去掉，§2.9 的 2）。
3. **提交框**（§4.5：在最上面）：多行输入框，左右 px 10、上下 8；4 行高（字号 12，`paneHeader.text`），圆角 8，1px `border`，有焦点时 `accent`（Herdr `changes` 的提交框）。下面 8，通栏 **Commit 按钮**：高 32、圆角 8（Herdr `changes` 和 `confirm` 的按钮），`raised` 底、1px `input` 描边、文字 `foreground`，深浅两套一样，也就是 §2.2 的文字按钮（用户 2026-11-26 从四种候选里选定：Herdr 的 `solid` 在浅色主题里是黑色按钮，Herdr 自带的 `paper` 主题也是 `#1b1b1e`，用户不要；实心 `accent` 也不要）；悬停叠 `hover`，右侧 30 宽的下拉触发。下拉菜单暂时仍是上游的 `Menu`（`Commit` / `Amend` 单选、当前项打勾）：共用的 `menu.js` 只有动作、没有打勾，换过去要先定菜单里放什么（例如 VS Code 的 `Commit (amend)` 动作），**挪到 P4e** 和提交框的其它改动一起设计（2026-11-26）。禁用时 `raised` 底、`dim` 字，tooltip `Stage changes first` / `Enter a commit message`。`Ctrl+Enter`（macOS `Cmd+Enter`）提交（原来没实现，P4a 补上）；占位文字 `Message (Ctrl+Enter to commit on <分支>)`，分支变了就换（输入框状态重建，已输入的文字保留）。Commit 按钮的图标是 Phosphor `check`（VS Code 的提交按钮是对勾），Amend 是 `pencil-simple`：`git-commit` 只留给 History 视图按钮，一个图标一个意思（交叉核对）。
4. **分组**：`Conflicts`、`Staged`、`Unstaged`（2026-11-26 改名，§4.5b B2；各自可折叠，§2.9 的分组标题）；组头悬停时右端出现整组操作：`Unstage all`（`minus`）、`Stage all`（`plus`）。（`Discard all…` 是 P4c。）
5. 超出上限时最下面一行 `Showing the first 200 of 3,912 changed files.`（11、`muted`、px 10）。

**文件行**（§2.9 的树行；平铺视图是同一种行、不缩进、名字后跟淡色目录）
- 右端 `+N −N`：固定 64 宽、右对齐，`+N` 和 `−N` 各 32（§4.3a 的行数槽位），字号 11，`ansi2` / `ansi1`。
- **悬停时右端换成操作**（同样 64 宽，不推挤）：`Open file`（`arrow-square-out`，在预览列打开当前版本，和 History 的文件一样）、`Stage changes`（`plus`）或 `Unstage changes`（`minus`）。`Discard changes…` 在 P4c 加。按钮是 §2.9 的图标按钮。
- 文件夹行：名字是里面最严重的状态色，不显示数字；只有一个子目录的链合并成一行（`mods/awsome-filetree`，VS Code 的 compact folders）。
- 单击文件：打开 diff tab（照现在的做法，用户 2026-11-26 选 A）。
- **右键菜单**（ui-ux-pro-max 复查：悬停才出现的操作要有不靠悬停的路径；用户 2026-11-26 同意）：共用 `menu.js`，`Open diff`（Enter）、`Open file`、分隔线、`Stage changes`（Space）或 `Unstage changes`（Space）；P4c 加 `Discard changes…`。右键的行成为键盘光标。
- **键盘光标**（和 Files 一样，§2.3）：面板有焦点时 ↑ ↓ 在可见的行之间移动（文件和文件夹，跨分组），1px `accent` 内描边；Enter 打开 diff（文件夹：展开 / 折叠），Space 暂存 / 取消暂存，← → 收起 / 展开文件夹。在提交框里打字时不响应。

**History 视图**：结构不变（§4.6a），只按 §2.9 改：标题栏换成 Files 式的；工具从提交分组的标题行移到标题栏；行和分组标题按 x = 10 / 4 的竖线重排；分组标题高 28；没有分支行。

**右上角的面板按钮**（`awsome-tabs`）：`Changes` 改叫 **`Git`**，图标 `git-branch`（交叉核对：右上角的 `Changes` 指整个面板，面板里的 `Changes (1)` 指其中一个视图，同一个词、同一个图标表示两件事；用户 2026-11-26 同意）。

**和规格的差距（代码只是初始状态，P4a 都改）**

| | Files（`awsome-filetree`） | Changes（`awsome-changes`） |
|---|---|---|
| 标题栏 | px 8、gap 4、`chrome` 底 → px 10、gap 8、`background` 底；按钮 22 高 → 20；视图组间距 1 → 2；分隔线 mx 3 → 两边 gap 8 | P4b 的文字标签 + 空标题栏 → Files 式：名字、视图按钮、分隔线、工具 |
| 分支行 / 摘要 | 摘要 px 8 → 10；`↑` 青、`↓` 蓝 → `muted`（§2.3 次要文字）；计数 `M 2`（字母、`dim`）→ `2 modified`（彩色数字加文字，§4.3a） | 没有分支行（P4b 把它当分组标题）→ §2.9 的分支行 |
| 树 / 行 | 列表 px 4 + 行 pl 4（内容在 8）→ 行 pl 6（内容在 10）；行尾总是画状态字母 → 只在设置 `row.statusLetter` 打开时画（§4.3a 默认关） | 行高 28、图标槽 14、缩进 20（上游 kit 的 `Row`）→ §2.9 的树行 22 / 12；组头 30（上游 `GroupHeader`）→ 28 |
| 提交框 | — | 在列表下面 → 最上面（§4.5）；下拉用上游 `Menu` → 共用 `menu.js` |
| History | — | 分组标题 32、行的文字在 16 → 28、10 |

**令牌**：`design/tokens.json` 新增 `panel`（标题栏 = `paneHeader`，竖线 10 / 4，树行 22 / 12，列表行 28，分组标题 28，提交框和按钮尺寸），`history` 里和它重复的值改成引用它；C9 核对两个 mod 的常量都等于 `panel`，并加 C3 的关系检查（标题栏高 = `paneHeader.height`、内容竖线 = `paneHeader.px`）。

**往返**：视图切换（`1` / `2` 键和点按钮，两个方向都一样）；分组折叠（点组头去、再点回）；悬停操作没有"去处"。

### 4.5b P4a 修订：试用反馈（2026-11-26；A、B 都已做，预览用户确认过，交互待你试）

> **实现时定下的细节**（2026-11-26，做的时候发现、按"小细节自己定"处理，这里写明）：
> - **正文的换行**：Git 的提交正文通常在 72 列处硬换行，面板比这窄时一行行参差不齐。所以段落里被硬换行的行接回同一段；空行、列表项（`- `、`1. `）、trailer（`Co-authored-by: …`）仍然各起一行。上面 B1 说的"保留原来的换行"按这条改。
> - **引用那一行的图标**用 `bookmark-simple`，不用 `tag`：`tag` 在侧边栏的排序菜单里已经是"按名字前缀分组"（`design/icons.json`）。
> - **B5 的待定项**：Markdown 的 `Rendered view` **保留 `eye`**（用户选），登记成 `design/icons.json` 里的例外。
> - **A5 的同一类一起清了**（用户同意）：文件树里 Claude hook 驱动的读写闪烁、git 动作小标签、`bridge.ts`、`config.json` 的 `activity` 都去掉。顺带发现 Files 的 Git 颜色和 §2.4 不一致（修改用了 `ansi11`、重命名用了 `ansi4`，为了和闪烁的橙色区分），闪烁没了，改回 §2.4 的 `ansi3` / `ansi6`，和 Changes 一样。
> - **Discard 恢复的是"暂存区里的样子"**（`git restore --worktree`），所以已暂存的部分不会丢；这和 VS Code 在 Changes 组里的 Discard 一样。§4.5 写的"从 HEAD 还原"指的是没有暂存时的结果，两者在那时相同。
> - **两条新检查**：C8 按 `design/icons.json` 检查"一个图标一个意思"（L16）；C3 检查面板里每个滚动列表都留了 `panel.end`（L18）。都在仓库副本里故意造错验证过能拦住。

> 用户试用 P4a 后提出 8 条。用户这次定的：Enter 保持 VS Code 的做法、预览用 Herdr 自带的编辑器、分组叫 `Staged` / `Unstaged`、提交详情用分区式。教训见 `docs/UI-LESSONS.md` L16～L18。B 部分按 `CLAUDE.md` 规则 6 先出预览，确认后才写正式代码。

**A 已做（行为，不涉及新界面）**
1. **选另一条提交，收起的详情块自动展开**：选一条提交就是要看它（`openCommit` 清掉 `h-detail` 的收起状态）。§4.6a 原来写的"换选中时标题跟着换、仍收起"作废。
2. **开成 tab = tab 接管这个文件**：双击、Enter、文件菜单的 `Open in tab`、预览列头部的 `Open in tab`，只要预览列显示的正是这个文件，就收起预览列（VS Code 的预览编辑器原地转成固定的，不会同时出现两份）。§4.4a 原来的"预览位保持原样"作废。
3. **Enter 保持 VS Code 的做法**（用户选）：VS Code 源码 `listService.ts` 里，键盘选择时 `pinned = !preserveFocus`，所以 Enter 打开固定的编辑器（我们的 tab），Space（`selectAndPreserveFocus`）打开预览。为了好发现，文件的右键菜单写出两个键：`Preview`（`Space`）、`Open in tab`（`Enter`，图标 `tabs`）。
4. **预览默认用 Herdr 的编辑器**（`gutter` 默认关，用户选）：能选中、复制、折叠。改动行的标记交给 Changes 的 diff；想要标记可以在设置里打开，打开后不能选中（设置说明已经写明）。
5. **去掉 Recent 视图**：它只认 Claude Code 的 hook，这台机器上 hook 没在跑，所以永远是空的；而且只对一种 agent 有效（agent 功能必须对所有 agent 有效）。看 agent 改了什么，用 Files 的状态色和 Changes。Files 标题栏只剩一个视图，不画视图按钮组（§2.9）。
   - 同一类还没处理的：文件树里还有 Claude hook 驱动的读写闪烁、git 动作小标签（`watchActivity`），§4.3a 早已定"去掉"但没执行。列给你，下次一起清。

**B1 提交详情块**（History 里提交列表下面那一块；用户选"分区式"）
- **标题行只放作用于这一块本身的操作**：§2.9 的分组标题（高 28，箭头在 x = 10，标题 11、medium、`muted`），标题固定写 `Details`（选中的是哪条，看提交列表里 `selected` 的那一行）；右端只有 `x` `Close (Esc)`，和所有分组标题一样悬停才出现。复制哈希、在 GitHub 打开是对**这条提交**的操作，放进内容（L16）。
- **内容**（整块竖向滚动；内容竖线 x = 10、右边 w − 10，§2.9）：
  1. **说明**（上 8）：标题行（subject）13、medium、`foreground`；正文（`%b`）13、`muted`，和标题隔 4，没有就不画。都换行，**可以选中复制**（Herdr `TextView`，`selectable(true)`；按纯文本显示，先转义 Markdown 符号，换行保留，因为 Git 的提交说明不是 Markdown）。
  2. **元数据**（和说明隔 12）：三行，每行高 20（= 图标按钮的高度，按钮放进来行高不变）；图标 14、`muted`，在 x = 10；文字从 x = 32（10 + 14 + 8）开始，字号 12（`paneHeader.text`）。
     - `user`：作者名，Geist，`foreground`；悬停提示 `Clyde Shen <邮箱>`。
     - `clock`：`2026-11-26 14:03 · 3h ago`，JetBrains Mono，`muted`。
     - `hash`：7 位短哈希，JetBrains Mono，`foreground`；**紧跟在哈希后面**（间隔 4）两个图标按钮（§2.9 的 `PaneButton`）：`copy` `Copy full hash`（写入完整 40 位，toast `Copied`），`arrow-square-out` `Open on GitHub`（只在远端已有这条提交时出现）。**始终显示**：它们是内容里的操作，不是行的悬停操作。GitHub 网页的复制按钮也紧挨着哈希。
     - 窄了：作者、日期在末尾省略，全文在悬停提示里；哈希不省略。
  3. **分隔线**：1px `border`，左右伸到块的两边（和分组标题行上边那条线一样宽），上面隔 12；下面直接接文件的标题行（标题行 28 高，自带上下空白，预览里再加 12 显得空）。
  4. **文件**：标题行 `3 files changed`，右边是 `+162 −17`（11、medium、`muted`，加减用 `ansi2` / `ansi1`；高 28；数字右对齐在 w − 10，和文件行的 `+N −N` 同一列）。文件行是 §2.9 的树行（22）、平铺：文件图标、名字（状态色，删除加删除线）、淡色目录、右端 64 宽的 `+N −N`；悬停时槽里换成 `eye` `Preview`（在预览列看**当前版本**）。单击打开这条提交对这个文件的 diff（现有的 `pick`，scope `commit`）。
  5. 列表最后留 12（B4）。
- **惯例**：GitHub Desktop 的历史详情、JetBrains 的 Git log 详情、VS Code Source Control Graph 的悬停卡片，都是"说明 → 作者、时间、哈希 → 文件"的顺序；GitHub 网页的提交页把复制按钮放在哈希旁边。

**B1 细化**（用户 2026-11-26 用 ui-ux-pro-max 要求"更完善的细节"；**和上面的 1～5 冲突时以这里为准**）

*版式：只有两条竖线、一套行高*
- **图标列 x = 10～26、文字列 x = 30**：元数据的图标改成 16（和文件图标一样大），图标和文字间隔 4（`panel.treeGap`）。于是元数据的图标和文件行的图标在同一列，作者名、时间、哈希和文件名都从 x = 30 开始。上面写的"图标 14、文字从 x = 32"作废。
- **平铺的文件列表不留箭头槽**：箭头槽（12）只在树里有意义，因为树里有文件夹；平铺列表没有文件夹，留着它只会让图标错开（预览里文件图标在 26、元数据图标在 10，就是这个原因）。所以详情的文件行和 Changes 的平铺视图都从 x = 10 画图标。树视图不变。
- **说明的行高 20**：字号 13 × 1.5（ui-ux-pro-max `line-height`：正文 1.5～1.75），落在 4px 栅格上。元数据行也是 20，所以整块的行距统一是 20 和 22（文件行）。
- **纵向**：上 8 → 说明 → 12 → 元数据 → 12 → 分隔线 → 文件标题行 28 → 文件行 22 × N → 12。

*说明*
- **标题行和正文放进同一个 `TextView`**，一次拖选就能把两者一起复制。标题行 semibold（600），正文 regular（400）；**两者都用 `foreground`**（ui-ux-pro-max `weight-hierarchy`：层次靠字重，不靠变灰。GitHub Desktop 和 GitHub 网页的正文也是正常的文字颜色，不是灰色）。上面写的"正文 `muted`"作废。
- 按纯文本显示：先转义 Markdown 符号，保留原来的换行（硬换行）；行尾的 `Co-authored-by:` 等 trailer 原样显示，不另做头像或合并到作者行（克制）。
- 长标题换行，不截断（ui-ux-pro-max `truncation-strategy`：能换行就不截断）。
- 预览里看到的（2026-11-26）：标题行用 `TextView` 的粗体（Markdown 的 strong）；正文里的网址、邮箱被 `TextView` 自动变成链接（GitHub 网页的提交说明也会把网址变成链接），保留。`TextView` 的 `line_height` 是倍数，不是像素：写 `20 / 13`。
- 引用标签在这里要写全名：现有的 `RefLabel` 最宽 120、会省略（图里需要），详情里加一个不限宽的写法，放不下就换行。

*元数据*（每行一个图标；只在有内容时出现）

| 图标 | 内容 | 字体、颜色 | 悬停提示 | 什么时候有 |
|---|---|---|---|---|
| `user` | 作者名 | Geist 12、`foreground` | `Clyde Shen <邮箱>`；提交者不是作者时（rebase、cherry-pick）加一行 `Committed by X · 2026-11-27 09:12` | 总有 |
| `clock` | `2026-11-26 14:03 · 3h ago` | JetBrains Mono 12、`muted` | 完整时间带时区 `2026-11-26 14:03:12 +08:00` | 总有 |
| `hash` | 7 位短哈希 + `copy` `Copy full hash` + `arrow-square-out` `Open on GitHub` | Mono 12、`foreground` | 完整的 40 位 | 总有；GitHub 按钮只在远端已有时出现 |
| `bookmark-simple` | 这条提交上的分支和 tag，用图里同一种引用标签（`RefLabel`），放不下就换行 | 同图里的标签 | 标签全名 | 只在这条提交有引用时。图里的标签窄了会被省略成几个字（§4.6a 已确认），这里是看全名的地方 |

- 哈希本身也能选中复制（同样放进可选中的 `TextView`），所以键盘用户也有不靠按钮的路径（ui-ux-pro-max `tooltip-keyboard`：不能只靠悬停和点按钮）。
- 复制后 toast `Copied`，不抢焦点（Herdr 的 `notify`；ui-ux-pro-max `toast-accessibility`）。
- 作者名、时间放不下时末尾省略，全文在悬停提示里；哈希和按钮永远完整（280 宽时这一行约 126 宽，放得下）。

*文件*
- 标题行：`4 files changed`，右边 `+163 −17`；只有 1 个文件写 `1 file changed`。**合并提交**的文件是相对第一个父提交算的（现有的 `--diff-merges=first-parent`），标题行的悬停提示写 `Compared with the first parent`。没有任何文件改动（空提交、和第一个父提交相同的合并）：标题行写 `No files changed`，下面不画列表（这是标题本身，不是另加的说明句）。
- 文件行：§2.9 的行（22），图标在 x = 10、名字在 x = 30（见上，平铺不留箭头槽）。
  - **重命名**：名字和目录用新路径，名字是 `ansi6`；悬停提示 `Renamed from old/path.js`。
  - **二进制**：`+N −N` 那一格空着；悬停提示写 `Binary file`。
  - 悬停时右端换成 `eye` `Preview`；单击打开这条提交里这个文件的 diff；当前打开的那个文件行 `selected`。
- **上限**：最多画 `limits.files`（200）个文件，再多在最后一行写 `Showing the first 200 of 1,203 files.`（11、`muted`，和 Changes 同一句式）。整个详情块只有一个滚动区域，文件列表不再套一层滚动（ui-ux-pro-max `scroll-behavior`）。

*状态*

| 状态 | 画法 |
|---|---|
| 刚选中 | 说明和元数据**立刻**显示（数据已经在 `git log` 里），只有文件列表要再读一次 |
| 读文件中 | 300ms 内不画任何东西（Git 一般马上就回，避免闪一下 `Loading…`，ui-ux-pro-max `loading-states`）；超过 300ms 在标题行的位置写 `Loading files…`（11、`muted`） |
| 读文件出错 | 在文件那一段原地写错误（11、`ansi1`）和一个 `Retry` 文字按钮（§2.2 的文字按钮，高 24）；不弹框（§2.6） |
| 换另一条提交 | 内容替换，滚动回到顶部；收起的块自动展开（A1） |
| 很窄（280） | 说明换行；元数据末尾省略；文件行先省略目录，再省略名字（§2.9 已有） |

- **不做**：头像、签名验证、父提交列表（图里已经画出来）、"包含这条提交的分支"（要额外跑 `git branch --contains`，慢）。
- **还缺的**（不在这次范围，列给你）：History 的提交列表没有键盘导航（↑ ↓ 选提交），所以详情目前只能用鼠标打开。要加的话按 Changes 已有的键盘光标做。

**B2 Changes 的分组和文件操作**（VS Code 的 Source Control）
- **分组**：`Conflicts`、`Staged`、`Unstaged`（用户 2026-11-26 选；§4.5 原来的 `Staged changes` / `Changes` 作废）。**去掉 `Committed · not on origin/main`**：它是从上游继承来的；"有几个提交没推送"已经写在 `History (2)` 按钮的提示里。
- **文件行悬停时右端的操作**（64 宽的槽：三个 20 的按钮加两个 2 的间距 = 64，不挤动布局）：
  - Unstaged：`eye` `Preview`、`arrow-counter-clockwise` `Discard changes…`、`plus` `Stage changes`（VS Code 的顺序：打开、丢弃、暂存）。
  - Staged：`eye` `Preview`、`minus` `Unstage changes`。
  - Conflicts：`eye` `Preview`、`plus` `Stage changes`（标记为已解决，和 VS Code 一样）。
  - 文件夹行：Unstaged 有 `Discard changes…`、`Stage changes`；Staged 有 `Unstage changes`。
- **组头悬停时的操作**：Unstaged 有 `Discard all changes…`、`Stage all changes`；Staged 有 `Unstage all changes`。
- **右键菜单**（共用 `menu.js`，顺序按 §2.6，条目取自 VS Code）：
  - Unstaged：`Open diff`（Enter）、`Preview` ｜ `Stage changes`（Space）｜ `Reveal in File Explorer`（按平台写，§2.5）、`Copy relative path`、`Copy absolute path`、`Add to .gitignore`（只对未跟踪的文件）｜ `Discard changes…`（红色，放最后）。
  - Staged：`Open diff`、`Preview` ｜ `Unstage changes`（Space）｜ `Reveal in File Explorer`、`Copy relative path`、`Copy absolute path`。
  - Conflicts：`Open diff`、`Preview` ｜ `Stage changes` ｜ `Reveal in File Explorer`、Copy × 2。冲突的文件**没有** discard。
  - **不放 VS Code 的 `Reveal in Explorer View`**（我们的 `Reveal in Files`）：和 `Reveal in File Explorer` 读起来是同一件事，用户看预览时指出重复（2026-11-26）。只留系统的那一个，和 Files 菜单的叫法一样。
- **"Open file" 改叫 `Preview`、图标 `eye`**：它就是在预览列看，和 Files 的单击、Files 菜单的 `Preview` 是同一件事（一件事一个名字、一个图标）。
- **Discard**（P4c 提前到这次做；规则是 §4.5 早就定的）：确认框按 §2.6：`Discard changes in sidebar.js?` / `Discard changes in 3 files?`，正文列出文件名，红色按钮 `Discard changes`；未跟踪的文件写 `Move to Recycle Bin`（macOS `Trash`），进回收站。执行前先 `git stash create`，存成隐藏引用 `refs/awsome-changes/discard/<时间>`，可以找回（`discard.snapshot`，默认开）。没有 `Don’t ask again`，只能在 awsome-config 里关（`confirm.discard`）。完成后 toast `Discarded changes in 3 files`。
- 键盘：在 Unstaged 的行上 Space 暂存、在 Staged 的行上 Space 取消暂存（§4.5a 已有）；discard 不配单键（会丢改动），走菜单或按钮。

**B3 Diff 的头部**（awsome-changes 画的 pane 头部）
- 左边不变：图标、文件名、目录、`+N −N`。右边两组，中间一条 1 × 12 的 `border` 分隔线（`paneHeader.separator`），和预览列头部的分法一样（§4.4a：文件视图组 ｜ 预览列操作组）：
  - **diff 显示方式**（始终显示，因为它是状态）：`arrows-out-line-vertical` 全文开关（提示 `Show full file` / `Show changes only`），`columns` 分栏开关（提示 `Show side by side` / `Show inline`）。打开时 `selected` 底 + `foreground`。对所有 diff tab 同时生效（现在的 `Full file` 就是这样）。
  - **pane 操作**（照 Herdr 的 pane：鼠标在头部时才显示）：向右分屏、向下分屏、放大、关闭。
- `Full file` 文字按钮去掉（同一行只有一种按钮，L15）；Changes 面板标题栏的 `Side-by-side diff` 去掉（同一个功能只出现一次）。`default.diff` 设置保留，它是默认值。

**B4 列表的结尾留白**
- 面板里所有会滚动的列表，最后一行下面留 **12**（`panel.end`）：Files 的树、Changes 的列表、History 的列表和图、提交详情。最后一行的底色和面板的下边缘分开，一眼看出已经到底，不会以为下面还有。12 是 4px 栅格的 3 格，和设置页每行的上下内边距同一个值（`design/tokens.json` 的 `settings`）。

**B5 图标：一个图标只有一个意思**（和同时在屏幕上的 mod 交叉核对）

| 图标 | 意思 | 用在 |
|---|---|---|
| `eye` | 在预览列看 | Files 菜单的 `Preview`；Changes 行、详情文件行的 `Preview` |
| `tabs` | 开成 tab | Files 菜单的 `Open in tab`；预览列头部的 `Open in tab`（原来是 `arrow-square-out`） |
| `arrow-square-out` | 离开 Herdr（系统程序、浏览器） | `Open in default app`、`Open on GitHub` |
| `copy` | 复制 | `Copy … path`、`Copy full hash` |
| `arrows-out-line-vertical` / `arrows-in-line-vertical` | 展开 / 收起 | diff 的 `Show full file` / Files 的 `Collapse all` |
| `columns` | 左右分栏 | diff 的 `Show side by side` |
| `arrow-counter-clockwise` | 回到原来的样子 | `Discard changes…`；设置对话框的 `Reset`（同一个意思，不同时出现） |

- ~~待你定：`Rendered view` 也用 `eye`~~：用户选保留 `eye`（2026-11-26），登记为例外。完整的表在 `design/icons.json`，C8 检查。

**往返**（登记 `design/flows.json`）：discard 确认框（去：按钮或菜单；回：`Cancel` / Esc，误删后用快照引用找回）；diff 的两个开关（再点一次）；详情块（不变：再点同一条、Esc、×）。
**惯例**（`design/conventions.json`）：`commit-details`（GitHub Desktop、JetBrains、GitHub 网页）、`scm-file-actions`（VS Code Source Control、GitHub Desktop 的右键菜单）、`diff-view-toggles`（VS Code diff 编辑器工具栏的 `Toggle Inline View`、GitHub PR 的 `Unified / Split`）。代码写完时登记（C12 会核对代码里真的有这些字符串）。

### 4.6 awsome-changes：多 repo、History 的图视图和 review ✅（设计已确认，review 除外）

> 画板 09（History）、12（Repositories 列表）。画板 10、11 是被取代的早期方案。

**多 repo：工作区里有主 repo，下面还有独立的子 repo，要选择看哪个**
- **实测的事实**：主 repo 的 `git status` **看不到子 repo 的改动**（只有被折叠的 `?? libs/`），被 `.gitignore` 掉的子 repo 完全不出现，`git` 自己也发现不了深层的子 repo。所以必须**单独发现、单独读取**每个 repo。
- **Repositories 竖向列表**（只有 1 个 repo 时整块隐藏）：
  - 位置：标题栏 → Repositories 列表 → 分隔线 → 当前 repo 的分支行（分支图标 + 分支名，右边淡色 repo 名）→ 提交框 → 两组文件。下半部分和单 repo 时完全一样。
  - 列表标题行：折叠箭头、`Repositories`，右边三个图标按钮：`Rescan`、`Add repository…`、`Follow terminal`（亮着 = 正在跟随）。
  - **每一行**：repo 的相对路径（有改动用最严重状态的颜色，干净的变灰）、分支、`↑2 ↓1`、右对齐的改动数徽标（0 显示成淡色）。**单击就切换**；当前 repo 是 `selected` 叠层加左侧指示条（§2.3）；悬停提示 `main ↑2 · 8 modified · 2 deleted · 4 new`。顺序固定：主 repo 第一，其余按路径字母序。
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

### 4.6a P4b 的完整规格：awsome-changes 面板的框架和 History 的图视图✅（2026-11-26 规格确认、实现，用户试用通过）

> **需求**：§4.5、§4.6、画板 06（Changes）、09（History）、12（Repositories 列表，多 repo 的主要设计）。**标准是规格和公开来源，任何现有代码（awsome-changes、Files）都只是初始状态**（用户 2026-11-26；`docs/UI-LESSONS.md` L13、L15）。前两版预览被否定的原因见 L15：标题栏 42 高、文字标签和图标按钮混在同一层、计数进了标题栏、上游的 `Menu`、Lucide 图标、内容竖线不齐；第二版又照抄了 Files 的代码，把 Files 的摘要和进度条重复进来，而且没考虑多 repo。
>
> **布局（用户 2026-11-26 选定）**：标题栏只放 `Changes | History` 两个文字标签；图标工具放在**当前 repo 的分支行**右端（画板 09 也把范围控件放在分支行）。
>
> 数值来源：Herdr 自带 mod（`pane`、`tabs`、`changes`）；`design/tokens.json` 的 `sidebar`（shadcn Sidebar，用户已确认）、`paneHeader`；§2.2、§2.3；图的几何取 VS Code 的 Source Control Graph（`src/vs/workbench/contrib/scm/browser/scmHistory.ts`，2026-11-26 取自 main：线宽 1、`CIRCLE_RADIUS 4`、`CIRCLE_STROKE_WIDTH 2`）。

**从上到下**（Changes 和 History 共用前三块，只有内容不同）

| 块 | 有没有 | 内容 |
|---|---|---|
| 1 标题栏 | 总是 | `Changes`、`History` 两个文字标签，别的什么都不放 |
| 2 Repositories 列表 | 只有 ≥ 2 个 repo 时 | §4.6 + 画板 12：标题行、最多 5 行、可折叠 |
| 3 提交块的标题行（原"分支行"） | 总是 | 当前 repo 的分支；右端是这个视图的操作按钮；可折叠，见"分组式分屏" |
| 4 内容 | | Changes：提交框 + 分组（§4.5，P4 做）；History：提交列表或图 |

**竖线和横线**
- 竖线 x = 16：`sidebar.inset 8` + 行的 `sidebar.px 8`，是图标列的左边缘：标题栏标签的图标、每个分组标题行的折叠箭头、Repositories 的文件夹图标、文件图标、第 0 条泳道都从这里开始。竖线 x = 40（图标列 16 + gap 8）：分组标题（`Repositories`、分支名、短哈希）、repo 路径、文件名。悬停和选中的底色从 8 开始（和侧边栏相同）。
- 图标列：16 宽（`sidebar.icon 16`，组头的箭头槽也是 16），在 x = 16～32，中心 24。各分组标题行的折叠箭头、文件夹和文件图标、**第 0 条泳道**都落在这一列。
- 右边：行内最右的文字（徽标、哈希）右边缘 = 宽 − 16；按钮的点击区右边缘 = 宽 − 8（和悬停底色同一条线）。
- 横线：标题栏下边 = 旁边 pane 的头部下边（`paneHeader.height` 30，Herdr `pane`）。
- 1px `border` 线：标题栏下；每个分组标题行的上边（第一块除外）。

**1 标题栏**（Herdr `pane` 头部：高 30、`background` 底、下边 1px `border`、字号 12）
- 两个标签用 Herdr 标签栏的面板按钮（`tabs/main.js` 的 `panelButton`：px 8、gap 5、圆角 6、字号 12；选中 `selected` 底 + `foreground`，没选中 `muted`，悬停 `hover`），高从 26 改成 22，让上下各留 4，落在 4px 栅格上。图标 14：`Changes` 用 Herdr 自带的 `mods/changes/changes.svg`（和右上角的 `Changes` 按钮同一个图标），`History` 用 Phosphor `git-commit`。
- 标签名用需求里的 `History`（§4.5、§4.6、画板 09、12），不用代码里的 `Commits`。
- 两个标签间距 2（`paneHeader.groupGap`），第一个标签的底色从 x = 8 开始，所以标签的图标从 16 开始。
- **不放计数，不放任何按钮**。计数的位置：Repositories 每行的徽标、Changes 各组的组头（`Changes 1,000`）。tooltip：`Changes · 1,015 changed files`、`History · 2 not pushed`。

**2 Repositories 列表**（§4.6 和画板 12 已定的行为，这里只补尺寸）
- 标题行：`sidebar.labelHeight` 32、字号 11、medium、`muted`；箭头在图标列；右边三个图标按钮 `Rescan`、`Add repository…`、`Follow terminal`（`sidebar.action` 20、图标 16）。
- 行：`sidebar.row` 28，px 8，gap 8，圆角 8，字号 13；图标列放 16px Phosphor `folder-simple`（`muted`），所以 repo 路径和标题行的 `Repositories`、分支行的分支名落在同一条竖线（x = 40）；repo 路径用 JetBrains Mono，颜色是最严重的 Git 状态（§2.4），干净的 `muted`；分支名、`↑2 ↓1` 字号 11、`muted`；右端改动数徽标（`sidebar.badgeHeight` 20、px 4、字号 11、等宽数字，千分位 `1,000`，自己格式化，因为运行时的 `toLocaleString` 不加分隔符；0 用 `dim`）。
- 当前 repo：`selected` 底 + 左侧指示条（§2.3：4×24、`accent`）。
- 最多 5 行，更多在列表里滚动；折叠后只剩当前一行和 `4 more · 1 has changes`。

**3 提交块的标题行（原"分支行"）**：画法见下面"分组式分屏"（分组标题行，高 32，操作按钮 20 / 16）。
- 操作按钮是**开关**时，打开时 `selected` 底 + `foreground`（和 Files 的开关同一个意思）；tooltip 写点了以后的结果：`Show graph` / `Show list`、`Show all branches` / `Show current branch`。
- Changes 视图的同一行：`Show as tree`（`tree-structure`）、`Side-by-side diff`（`columns`）、`Refresh`。原来的 `Options` 菜单去掉，这两组选项变成两个开关。

**4 History 的内容**
- **List**：按本地 / 远程 / 默认分支分组（§4.6"原样保留"的是这个内容和分组）；行和组头按上面的竖线和 `sidebar` 尺寸重排（行 28、文字从 16 开始）。
- **Graph**，每行（`sidebar.row` 28，px 8，gap 8，圆角 8，悬停 `hover`）：**泳道列 → 标题 → 引用标签 → 时间 → 短哈希**。
  - 标题：13、`foreground`、省略号。**标签放在标题右边**（VS Code 的 Source Control Graph 也这样），所有行的标题从同一条竖线开始。
  - 时间：`now`、`5m`、`3h`、`2d`、`3w`、`4mo`、`1y`；字号 11、JetBrains Mono、`muted`、右对齐、固定宽 28。哈希：7 位、字号 11、JetBrains Mono、`muted`。
  - 窄了：先省略标题（§4.6 已定），标题最少留 64；再省略标签，每个标签最少留 32；时间、哈希永远完整。（第三版预览一度改成先省略标签，标签被压成只剩 `…`，而且改了已定的规则，已改回。）
  - 标题只显示 message 的第一行（`%s`），放不下就省略。悬停提示两行：完整的标题，下面 `Clyde Shen · 2026-11-26 14:03`（VS Code 的图悬停时也显示完整 message）。
  - **整行是点击区**（泳道、圆点、标签都算），单击选中这条提交（`selected` 底，§2.3）并在下方分屏显示详情；圆点、线、标签没有各自的动作（§4.6：只读）。

**分组式分屏**（用户 2026-11-26："像 VS Code 分屏也等于分组，可以收起来"；代替上一版的"分支行 + 下方详情"）
- 惯例：VS Code 侧边栏的各个视图（Source Control 的 Repositories、Changes、Graph）每块都是一个分组：标题行带折叠箭头，收起后只剩标题行；展开的几块之间是可拖动的分隔线。JetBrains 的工具窗口分屏也一样。我们自己的侧边栏（`Spaces`、`Agents`）和 Repositories 列表已经用同一种分组标题行，所以**三块都用这一种标题行，不新造**。
- History 视图从上到下三块：**Repositories**（只有 ≥ 2 个 repo 时）、**提交**、**详情**（只在选中了一条提交时）。
- **分组标题行**（`sidebar` 令牌，和 Repositories 的标题行同一个部件）：高 `labelHeight` 32；折叠箭头 12px 放在图标列（x = 16～32）；标题在 x = 40；右端操作按钮 `action` 20、图标 16，按钮之间 2，点击区右边缘 = 宽 − 8；每块的标题行上边一条 1px `border`（第一块除外）。单击标题行（按钮以外的地方）折叠或展开；状态记进 `localStorage`。收起的块不显示操作按钮（看不到内容，就没有可操作的；详情块的 × 例外，它让详情块整个消失）。
  - **提交块**：标题是分支名（JetBrains Mono 11、`foreground`），有多个 repo 时后面跟 repo 名（11、`muted`）；`↑2 ↓1`（11、`muted`）。操作：`Show graph`（`git-merge`，开关）、`All branches`（`git-fork`，开关，只在图视图出现）、`Refresh`（`arrows-clockwise`）。**原来的分支行就是这一行**，不再单独占一行；操作按钮也统一成分组标题行的 20 / 16，和 Repositories 的按钮同一种。
  - ~~**详情块**：标题是短哈希。操作：`Copy hash`、`Open on GitHub`、`Close (Esc)`~~。**以 §4.5b B1 为准**（2026-11-26：标题行只留 ×，复制和 GitHub 移进内容；详情块的内容、换选中时自动展开也按 §4.5b）。
  - Repositories：§4.6 已定"折叠后只剩当前一行和 `4 more · 1 has changes`"，照旧（这是已定的，不改成只剩标题行）。
- **分隔线和高度**：展开的块放进 gpui-component 的 `v_resizable`（拖动、分隔线、按 id 记住高度都是现成的，规则 1 A）；收起的块只画标题行，放在分组外面，按原来的顺序排。分组 id 按"哪几块展开"取名（例如 `history:commits+detail`），每种组合各自记住拖过的高度。只有一块展开时它占满剩下的高度。Repositories 展开时高度由内容决定（最多 5 行，不参与拖动）。
- **详情块的出现和收起**：没有选中提交时没有这一块。单击一条提交 → 选中（`selected` 底，§2.3），详情块出现（第一次占提交块和详情块合计高度的 40%，最小 120，提交块至少留 3 行）；单击另一条 → 换内容；**再单击已选中的那条、Esc、或 ×** → 取消选中，详情块消失。点箭头只是收起（只剩标题行，选中保留，换选中时标题跟着换）。
- **详情块的内容**（整块竖向滚动）：完整标题（13、medium、`foreground`、换行）；`Clyde Shen · 2026-11-26 14:03`（11、`muted`）；正文 `%b`（13、`muted`、换行，没有就不画）：左右 px 16，上下 8，行间 4。然后一行 `3 files  +162 −17`（11、medium、`muted`，高 28，文字在 x = 16），下面每个文件一行（`sidebar.row` 28：文件图标 16 在图标列、名字 13 用 §2.4 状态色在 x = 40、目录 11 `muted`、右端 `+N −N`），单击打开这条提交对这个文件的 diff，在中间的 diff tab 里（现有的 `pick`，scope `commit`；diff 的 `Full file` 开关可以看整个文件在这次提交时的样子）。悬停时右端换成 `Open file` 图标（§4.5 文件行的同一个动作），用 viewer 在预览列打开**当前版本**（和 Files 的单击一样）。viewer 不加读历史版本（用户 2026-11-26 选 A：照现在的做法；Changes 的打开方式要不要和 P2 统一，P4 再说）。
- 现有代码的详情页（整页替换、`chevron-left` 返回、px 14、`dim`）是初始状态，整块换掉。
- 要先验证：`v_resizable` 里换一组面板（分组 id 变了）时，新组合用初始大小、旧组合拖过的大小下次还在。不行就改成详情块固定在提交块下方、只记一个高度。

**数据**
- `git log --date-order --decorate=full --format=%H%x00%h%x00%P%x00%an%x00%ae%x00%at%x00%D%x00%s%x00%b%x1e`（和 List 一样用 `` 分记录，所以正文里的换行不会断开记录）；当前分支 = `HEAD` + `@{upstream}`，所有分支 = `--branches --remotes --tags HEAD`。
- 泳道布局：**不用 npm 的 `graph-lab`**（2026-11-26 验证：包里没有许可证，`package.json` 没有 `license`，README 写"见 NOTICE"但包里没有 NOTICE；GitHub 仓库 404；它移植自 Apache-2.0 和 MIT 的项目，缺 NOTICE 就不能合规使用）。用自己写的约 40 行 `layoutLanes`（`herdr-git-graph` 的 `lanes.js` 的思路，MIT，只借思路），放进 `git/model.js`。
- 设置：`default.history`（`list` / `graph`，默认 `list`），和 `default.view`、`default.diff` 同一组。

**往返路径**（代码写完时登记 `design/flows.json`）
- `Changes` ↔ `History`：点标签去，点另一个标签回。
- 开关：点一次去，再点一次回。
- 详情块：单击一行出现；再单击同一行、Esc、或 × 消失。
- 每一块：单击标题行收起，再单击展开。
- 切换 repo：单击 Repositories 的一行去；单击原来那一行回（`Follow terminal` 回到跟随）。

**和现有代码的差距**（代码只是初始状态，这些都要改）：标题栏 42 高、px 14、`Changes 3 | Commits 2` 带框标签和计数、26px 按钮、`Options` 菜单（上游 `Menu`）、Lucide 图标、列表 px 6 + 行 px 8（文字在 14）、`Load more` 行、没有 Repositories 列表（P4）。

**已确认**（用户 2026-11-26）：泳道 6 种颜色（终端色 `ansi4 / 2 / 5 / 6 / 3 / 1`）、标签放在标题右边、`Options` 菜单换成两个开关、标签名用 `History`、280 宽时标签只剩几个字也可以。

**不做**（§4.6）：右键 git 操作、checkout、stash 和 WIP 行、冲突视图、文件历史、头像、列宽拖拽、Rust 辅助程序。

### 4.7 awsome-filetree：内容搜索 ⬜

像 VS Code 的搜索，搜文件内容。
- **引擎**：`rg --json`（这台机器是 14.1.1）；没装 `rg` 就退回 `git grep`。三个平台都能用，默认遵守 `.gitignore`。
- **界面**：文件树标题栏的第二个视图 **Search**（Tree | Search）；输入框下面是 `Aa`（大小写）、`ab`（整词）、`.*`（正则）三个开关，以及包含 / 排除的 glob；结果按文件分组，文件头是图标、名字、路径、匹配数徽标，下面是命中的行，匹配的字高亮；虚拟列表。
- **点结果**：单击在临时预览里打开并跳到该行，双击固定（规则同 §4.4）；需要把行号传给 `awsome-viewer`（已有 `scroll_to_item`）。
- **范围**：文件树当前的根（所以"进入文件夹"也能用来缩小范围）。
- **限制**：每个文件最多 20 条、总数 500 条、15 秒超时，超出写 `Results truncated`。
- **坑**：`rg` 的匹配位置是 UTF-8 **字节**偏移，含中文的行要先转成字符位置才能高亮，要专门用中文测试。
- **不做**：替换（会批量改文件，以后单独讨论）。
- 约 250～350 行。先验证 `rg --json` 在 Herdr 运行时里能顺利解析。设置项：引擎偏好、默认开关、最大结果数、默认排除目录。

### 4.8 awsome-viewer：预览变成编辑器（P6a，2026-11-26，片 1～5 都已做完并装好，待你试用）

**决定的经过**：用户要一个"尽量像 VS Code"的编辑器，并且能和 Herdr、在 Herdr 里运行的 agent 打通，尽量用 Herdr 自带的东西。顺序（用户同意）：**P6a 预览能编辑**（本节）→ P6b 和 agent 打通（选区发给 agent、终端里的 `path:line` 链接跳进编辑器、像 code review 一样在代码和 Markdown 上加评论，一起发给运行中的 agent；借鉴 Plannotator 的思路）→ P6c AI 改代码（让运行中的 agent 改选区，再逐块审查它的改动）。2026-11-26 用临时测试 mod 和用户实测了 Herdr 自带 `Editor` 的能力（下表）。用户决定：**做不到的就不做**（查找、替换、多光标、自动提示）；**Markdown 像 VS Code 一样默认打开源码**。

**Herdr 自带 `Editor` 实测**（Windows，`readonly: false`）

| 能用 | 不能用（原因） |
|---|---|
| 撤销 `Ctrl+Z`、重做 `Ctrl+Y` | `Ctrl+Shift+Z`（Herdr 的 `pane.zoom`） |
| `Tab` / `Shift+Tab`、回车自动缩进、括号和引号自动配对 | 查找、替换（编辑器吞掉 `Ctrl+F`，但 Herdr 没打开查找） |
| 双击选词、三击选行、拖选、复制粘贴 | 多光标、自动提示（Herdr 没开放） |
| 折叠：行号旁的箭头（预览截图里 `js` 文件有；测试 mod 用了 Herdr 不认识的 `typescript`，所以当时没有。实现时复查） | |
| 语法高亮（syntect：`ts` 要映射成 `js`，现有 `languageOf` 已处理） | 注释、跳到行、移动行（编辑器没有这些动作） |

- mod 不能用 `window.dispatch_action` 触发编辑器自己的动作（实测没有反应），所以**编辑器自带的功能只靠它自己的按键**，我们不做 Undo、Find 这类按钮。
- 补上的功能都走 `keys.json` 的 `mod:awsome-viewer` 分区（命令进 `nextCommand()`），用 `selected_range` + `replace` 改文字：实测保存、跳行（会滚动到那一行）、注释、移动行、复制行都能用，每次是一步撤销。

**范围**
- awsome-viewer 显示的文本文件，在预览位和独立 tab 里都**直接可以编辑**（`readonly: false`），没有"编辑模式"开关（VS Code 一样）。
- 仍然只读：渲染的 Markdown、图片、"Changed lines" 行视图（设置 `gutter`，默认已是关）、**远程 space 的文件**（`writeTextFile` 不支持 `on`）、二进制的文件（现有行为，显示原因）、**被截断的大文件**（现有的 `viewable()` 把超长文件截断并在末尾加 `… (file truncated)`；允许编辑的话，保存会把文件的后半截丢掉，所以截断的文件一律只读，并显示 §4.8 的只读标记，tooltip `Too large to edit`）。
- **Markdown 默认打开源码**：设置 `markdown` 的默认值由 `preview` 改成 `code`（VS Code 打开 `.md` 也是文本，预览另开）。头部 `eye`（`Rendered view`）/ `code`（`Source`）两个按钮不变；渲染视图显示的是**编辑中的内容**，不是磁盘上的。

**保存**（`Ctrl+S`，macOS `Cmd+S`）

| 情况 | 结果 |
|---|---|
| 没有改动 | 什么也不做 |
| 有改动 | `writeTextFile(path, text, base)`（`base` = 上次读到或保存的内容）；成功后改动标记消失，`base` = 新内容。不弹 toast：标记消失就是反馈（VS Code 一样） |
| 打开以后磁盘上的文件被改过（agent、别的编辑器），写入被拒 | 共用确认框（§2.6 的写法：问句带数量，名字放进等宽字体的名单框）：标题 `Overwrite 1 file changed on disk?`，名单 `viewer.ts`，说明 `It changed after you opened it.`，按钮 `Cancel` + 红色 `Overwrite`。Overwrite = 重新读一次磁盘内容作为 `expected` 再写。VS Code 这时给 `Compare` / `Overwrite`；对比放到 P6c 的审查里做 |
| 文件已被删除 | 保留内容和改动标记，头部的文件夹后面多写 `Deleted`（`dim`）；保存时重新建出这个文件（`expected = null`）。VS Code 一样 |

- **行尾和编码原样写回**：打开时记下行尾（LF / CRLF）、文件末尾有没有换行、有没有 BOM，保存时还原。Windows 上的仓库常是 CRLF，写错会让整个文件出现在 diff 里。
- **缩进跟着文件走**：打开时检测缩进（tab 还是空格、几格），调用 `set_tab_size`。用 npm 的 `detect-indent`（纯 JS，打成单个文件放进 mod），检测不出时用 Herdr 默认的 2 空格。VS Code 的 `editor.detectIndentation` 默认开。

**改动标记**：头部文件名前加 `*`（Windows 记事本的标题、JetBrains 的 "Mark modified (*)"），`foreground` 色，不加 tooltip（它是字形，不只靠颜色）。发布给 Awsome Changes 面板头部的 `pane-heads` 标题同样带 `*`。**不用 VS Code 的 `●`**：侧边栏已经用 `●` 表示 space 里有 agent 需要你或已完成（`awsome-sidebar/views/spaces.js`），同一个符号不表示两种意思（ui-ux-pro-max 交叉核对，❓ 待你确认）。

**外部改动**（viewer 现在每 2 秒读一次文件）

| 编辑器里 | 磁盘上变了 | 结果 |
|---|---|---|
| 没有改动 | 内容变了 | 直接换成新内容，**光标和选区留在原来的偏移**（夹到新长度内），滚动位置不变。agent 改文件时你看到的总是最新的（VS Code、Sublime 一样） |
| 有改动 | 内容变了 | 不动你的内容、不弹框；保存时走上面的冲突确认（VS Code 一样） |
| 任意 | 文件被删 | 见上表"文件已被删除" |

**离开有改动的文件**

| 情况 | 结果 |
|---|---|
| 预览位里单击别的文件；预览位的 × / Esc | 先问（§2.6 的写法）：标题 `Save changes to 1 file?`，名单 `viewer.ts`，说明 `Unsaved changes will be lost.`（VS Code 原文 `Your changes will be lost if you don't save them.` 太长，C14 要求缩短）。按钮：**左边**红色 `Don't save`（丢掉改动 = §2.2 的危险动作，和右边隔开，macOS 的保存对话框也是这样分开的）；**右边** `Cancel`、`Save`（最右，Enter）。Esc = Cancel。共用确认框加一个可选的左侧按钮（`other`） |
| 预览位头部 `Open in tab` | 带着改动一起转到 tab，不问 |
| `Rendered view` ⇄ `Source` | 同一份内容，不问 |
| Herdr 关掉 tab 或 pane、退出 Herdr、mod 重新载入（我们拦不住） | 把改动存成**草稿**（`data/awsome-viewer/drafts/`：路径、`base`、内容），下次打开这个文件时恢复，带改动标记，并发一个 toast `Restored unsaved changes to name`。保存或 `Don't save` 后删掉草稿；30 天没碰的草稿在启动时清掉。这是 VS Code 的 hot exit |

**编辑命令**（`mod:awsome-viewer` 键位分区，只在 viewer 有焦点时生效，不抢终端的键；都在 awsome-config 里可改）

| 动作 | Windows / Linux | macOS | 来源和说明 |
|---|---|---|---|
| Save | `Ctrl+S` | `Cmd+S` | 所有编辑器 |
| Go to line… | `Ctrl+G` | `Ctrl+G` | VS Code（macOS 上也是 `Ctrl+G`，`Cmd+G` 是"查找下一个"） |
| Toggle line comment | `Ctrl+/` | `Cmd+/` | VS Code |
| Move line up / down | `Ctrl+Shift+↑` / `↓` | `Cmd+Ctrl+↑` / `↓` | Sublime Text。VS Code 的 `Alt+↑↓` 是 Herdr 的 agent 切换 |
| Duplicate line | `Ctrl+Shift+D` | `Cmd+Shift+D` | Sublime Text。VS Code 的 `Shift+Alt+↓` 在 Windows 上可能是切换输入法 |
| Delete line | 不绑 | 不绑 | VS Code 是 `Ctrl+Shift+K`，但它在 Herdr 里是全局的 "Go to…" 选择器；让着 Herdr，设置里可以自己绑（2026-11-27） |
| Insert line below / above | `Ctrl+Enter` / `Ctrl+Shift+Enter` | `Cmd+Enter` / `Cmd+Shift+Enter` | VS Code、Sublime Text |
| Select line | `Ctrl+L` | `Cmd+L` | VS Code、Sublime Text；再按一次扩到下一行 |
| Indent / Outdent line | `Ctrl+]` / `Ctrl+[` | `Cmd+]` / `Cmd+[` | VS Code、Sublime Text |
| Toggle block comment | `Alt+Shift+A` | `Ctrl+Shift+A` | VS Code（`Shift+Alt+A`；Windows 上 `Alt+Shift` 可能是切换输入法，要实测）；macOS 的 `Option+Shift+A` 会打出字符，换成 `Ctrl+Shift+A` |
| Go to matching bracket | `Ctrl+Shift+M` | `Ctrl+Shift+M` | JetBrains。VS Code 的 `Ctrl+Shift+\` 是 Shift+标点，Herdr 在 Windows 上按产生的字符命名（§8），不可靠 |
| Join lines | `Ctrl+J` | `Ctrl+J` | VS Code（macOS `Ctrl+J`；Windows 默认不绑）、Sublime Text |
| Toggle word wrap | `Alt+Z` | `Ctrl+Alt+Z` | VS Code（macOS 的 `Option+Z` 会打出字符） |

编辑器自带：撤销 `Ctrl+Z`、重做 `Ctrl+Y`（macOS 的 `Cmd+Shift+Z` 待在 macOS 上实测）。

- **注释**（VS Code 的规则）：作用于选区碰到的所有整行。全部已注释 → 去掉注释符和它后面的一个空格；否则 → 在这些行**最小缩进的那一列**插入注释符加一个空格，空行跳过；只选了一个空行时也插入。只有块注释的语言（HTML、XML、Markdown、CSS）把整段包成 `<!-- … -->` / `/* … */`，再按一次拆开。注释符按语言查表，取值来自 VS Code 内置语言的 `language-configuration.json`（`comments.lineComment` / `blockComment`），手工录入、不复制代码；表里没有的语言不响应。
- **移动行 / 复制行**：作用于选区碰到的所有整行，选区跟着走；第一行上移、最后一行下移不动。
- **第一批补充命令**（2026-11-27，用户要"尽可能全面，贴近 VS Code"；行为照 VS Code 的同名命令）：
  - 删除行：删掉选区碰到的整行，光标留在下一行的同一列（没有下一行就到上一行）。
  - 在下方 / 上方插入新行：不管光标在行的哪里，在当前行后 / 前开一行，缩进和当前行一样，光标放到新行。
  - 选中整行：选中光标所在的整行（含换行符）；已经选中整行时再按，扩到下一行。
  - 缩进 / 反缩进：选区碰到的每一行加或去掉一级缩进；一级 = 文件检测出的缩进（tab 或 N 个空格，检测不出是 2 个空格）；空行不加。
  - 块注释：把选中的文字包成该语言的块注释（`/* … */`、`<!-- … -->`）；已经包着就拆开；没选中时插入一对，光标放在中间；语言没有块注释就不响应。
  - 跳到匹配的括号：光标挨着 `()[]{}` 之一时跳到和它配对的那个；不挨着时跳到包住光标的那一对的右括号。只按括号计数，不识别字符串和注释里的括号（已知的近似）。
  - 合并行：选区碰到多行时合成一行；只有一行时和下一行合并。换行和下一行开头的空白换成一个空格，光标停在接缝处。
- **自动换行**（`EditorState` 的 `soft_wrap`）：设置 `Wrap lines`，三选一：`Markdown only`（默认，VS Code 自带设置里 `[markdown]` 的 `editor.wordWrap` 是 `on`，代码不换）、`All files`、`Never`。`Alt+Z` 只切换当前这个 viewer 里的文件，不改设置（VS Code 的 `View: Toggle Word Wrap` 也是这样）。
- **保存时**（VS Code 的 `files.trimTrailingWhitespace`、`files.insertFinalNewline`，默认都关）：设置 `Trim trailing whitespace on save`、`Insert final newline on save`。打开时，保存前先把改动作为一步撤销放进编辑器里，再写文件。Markdown 不去行尾空格（行尾两个空格表示换行）。
- 每个命令是**一步撤销**（`replace`，已实测）。

**操作条：Go to line**（2026-11-26 用户改：跳到行不用弹窗。预览已确认，深浅两套截图）
- **是什么**：头部行（30 高）下面临时出现的一条，整宽，把编辑器往下推，不盖住代码。只在要用时出现，用完收起。以后同类的轻量输入（比如查找，如果哪天能做）都放在这里，同一时间只有一种。
- **出现**：`Ctrl+G`。出现时输入框拿到焦点；已经开着时再按 `Ctrl+G`，焦点回到输入框并全选里面的字。
- **收起**：Enter 跳转后收起；Esc（输入框有焦点时）或 × 直接收起。收起后焦点回到编辑器。点回编辑器时条不收起，输入框的边框变回 `border`。
- **尺寸和颜色**（来源：Herdr 自带 `changes` mod 底部的提交条 `p(10) gap(8)`、输入框 `h(32) px(10) rounded(8) border_1`、聚焦时 `accent` 否则 `border`、文字 12；按钮用 §2.2 唯一的文字按钮样子）：
  - 条：`p 10`、`gap 8`、高 52，底部 1px `border` 线，底色 `background`（和编辑器、头部行一样）。左右 10 和头部行的 `px 10` 对齐。
  - 左边标签 `Line`：11.5、`dim`（Herdr `prompt` 的输入框标签）。
  - 输入框：占满剩下的宽度，32 高、`px 10`、圆角 8、文字 12；边框聚焦时 `accent`，否则 `border`；输入的不是 `行` 或 `行:列` 时按 Enter，边框变成 `ansi1`，直到再改字。
  - 占位文字 `line or line:column, 1–N`（N = 打开条时的行数）。
  - 按钮 `Go`：32 高、`px 14`、圆角 8、`raised` 底、`input` 边框、文字 12。
  - 关闭：`PaneButton`（图标 `x` 14px，`dim`，悬停 `hover`），tooltip `Close (Esc)`。
- **跳转**：`行` 或 `行:列`；超出范围夹到第一行或最后一行（VS Code 一样）。行数在按下 Enter 时重新数，打开条之后改过文字也不会跳错。
- **头部由 Awsome Changes 的面板头显示时**（viewer 自己没有头部行）：条在 viewer 最上面；浮在右上角的那组按钮下移到条的下面（`top` = 6 + 53），不压在条上。
- **只读的文件**（远程、截断）也能用；渲染的 Markdown 和 "Changed lines" 视图里不出现（没有编辑器）。
- 不做：查找（用户 2026-11-26 决定先不做：编辑器没有焦点时不画选区，找到的字看不出来）。

**只读标记**：远程文件在文件名后显示 14px `pencil-simple-slash`（Phosphor，`dim`），tooltip `Read-only on another machine`。VS Code 用锁，但 `lock-simple` 已经是 `Appearance…` 里可选的 space 图标（`awsome-menu/picker.js`），同一个图标不表示两种意思，所以换成"不能编辑"的铅笔（ui-ux-pro-max 交叉核对）。

**不做**：查找、替换、多光标、自动提示（Herdr 没开放，用户 2026-11-26 决定不做）；自动保存（VS Code 默认也关）；`Compare`（P6c）；格式化（2026-11-27：项目的 formatter 由项目和 agent 运行，viewer 只呈现改动后的文件，§4.0）；粘贴图片存成文件（2026-11-27 用户：较复杂，先跳过；Herdr 不给 mod 读剪贴板图片，要按平台调 PowerShell、osascript、wl-paste / xclip）。

**往返**（登记在 `design/flows.json`）：Go to line 操作条（去：`Ctrl+G`；回：Esc、×）；保存冲突确认（去：`Ctrl+S` 被拒；回：Esc、`Cancel`）；未保存确认（去：离开有改动的文件；回：Esc、`Cancel`）。`Rendered view` ⇄ `Source` 已有。
**惯例**（`design/conventions.json`）：`editor-save`、`dirty-marker`、`save-conflict`、`external-reload`、`unsaved-prompt`、`hot-exit`、`go-to-line`、`toggle-comment`、`move-line`、`duplicate-line`、`markdown-source-first`、`detect-indentation`、`read-only-marker`。

**开工前要验证**（各做一个小测试）：
1. 折叠箭头在 viewer 里出现（`languageOf` 给的语言名 Herdr 认识）；`EditorState.value()` 是否保留 `\r\n`；`set_value` 之后撤销历史、光标、滚动位置怎样。
2. 关 tab 时 `View.close()` 来不来得及写完草稿。
3. `mod:awsome-viewer` 键位在预览位（布局里的 mod 块）里也生效（测试时是在 tab 里）。**`Ctrl+Shift+↑↓` 有没有被编辑器自己吞掉**（gpui-component 可能把它绑成"选到开头 / 结尾"，像 `Ctrl+F` 那样）；被吞掉就退回实测能用的 `Alt+Shift+↑↓`，并记下输入法的风险。
4. `detect-indent` 能打包，`herdr-app check` 通过。
5. viewer 现在的定时读文件，在编辑器有改动时不会覆盖内容。

**实现计划**（2026-11-26，用户确认规格和改动范围后写下；每一片做完都跑 `herdr-app check`、`ui-check.py`，给你一张试用清单，再做下一片）

*改动范围*（用户确认）：主要是 `mods/awsome-viewer`；另外 `confirm.js` 加可选的左侧按钮（逐字节拷贝同步到所有带它的 mod，awsome-viewer 也带一份）；`install.sh` 把 `mod:awsome-viewer` 键位合并进 `keys.json`（用临时 `HERDR_APP_HOME` 试装）。不动 `awsome-filetree` 自己那个只读的 `Editor`（`main.js:797`），不动 Herdr 自带的 mod。

*已验证*（开工前）：`EditorState.value()` 原样保留 `\r\n`，`replace` / `set_value` 也不改它；`detect-indent` 7.0.2（MIT）用 esbuild 打成 938 字节的单文件。

| 片 | 内容 | 主要文件 |
|---|---|---|
| 1 | 去掉只读；能不能编辑 = 本机文件、没被截断、不在 "Changed lines" 视图；`*` 改动标记（头部和 `pane-heads`）；`Ctrl+S` 保存；行尾、BOM 原样写回；只读标记（远程、截断）；`markdown` 默认改成 `code`；渲染视图显示编辑中的内容；外部改动：没改动时重新载入并保留光标，有改动时不动 | `views/viewer.js`、`files/model.js`（`viewable` 标出截断）、`main.js`（viewer 也接 `nextCommand`）、`mod.json`、`mod.schema.json`、`icons/` |
| 2 | 保存冲突确认、未保存确认（三个按钮）；`confirm.js` 加左侧按钮并同步各份拷贝 | `views/viewer.js`、各 mod 的 `confirm.js` |
| 3 | 草稿（hot exit）：`close()` 时写进 `data/awsome-viewer/drafts/`，打开时恢复并发 toast；保存或 `Don't save` 后删除；30 天清理 | 新文件 `files/drafts.js`、`views/viewer.js` |
| 4 | 命令：`Go to line` 操作条、注释（语言表）、移动行、复制行；`detect-indent` | 新文件 `files/edits.js`、`files/comments.js`、`detect-indent.js`、`views/viewer.js` |
| 5 | 键位：`mod.schema.json` 里的快捷键设置（`format: "key"` + `x-action`）、`install.sh` 合并键位；把 conventions 里这些条目的 `planned` 去掉、填上 `code` | `mod.schema.json`、`install.sh`、`design/*.json` |

*实现上的决定*
- **内部一律用 LF**：读进来时记下行尾（有 `\r\n` 就是 CRLF）和 BOM，去掉后再交给编辑器；保存时加回去。行级命令因此不会碰到多余的 `\r`。
- **三份文字分开记**：`raw` = 上次和磁盘对齐时的原始内容（保存时作为 `expected`）；`base` = 它去掉 BOM、换成 LF 之后（和编辑器里的比，判断有没有改动）；编辑器里的是当前内容。定时读文件时：没改动 → 换成新内容并更新 `raw` / `base`；有改动 → 什么都不动，所以保存时 `expected` 对不上，就走冲突确认。
- **命令只给有焦点的那一份 viewer**：预览位和多个 tab 里各有一份 viewer，都会收到 `nextCommand()`；用 `EditorState` 的 `focus` / `blur` 事件记下"编辑器有没有焦点"，没有焦点的那份忽略命令。
- **截断的文件只读**：`viewable()` 返回值里加 `truncated: true`，不再靠末尾的那句文字判断。
- **草稿边改边存**（片 3）：有改动时每秒最多写一次草稿，`close()` 再写一次。Herdr 退出时给 `close()` 的时间很短，只靠它写不保险（VS Code 的 hot exit 也是定时备份）。改动撤销回原样、保存、`Don't save` 都删掉草稿。
- **草稿记着它基于哪一版**：恢复时 `raw` 用草稿里记下的原始内容，不用磁盘上现在的。关掉期间文件被别人改过，保存时就走冲突确认，不会悄悄盖掉。
- **`Open in tab` 带着改动走**：预览位先把改动写成草稿，新 tab 第一次读文件时取走（不弹 toast），预览位退回磁盘上的内容。这个文件已经开在别的 tab 里时，预览位保留改动，之后离开时照常问。
- **注释符按扩展名查表**（`files/comments.js`），不按语法高亮的语言名：`toml` 借 `yaml` 的高亮、`jsonc` 借 `json` 的，但注释写法要按文件本身。
- **Go to line 先做成了弹窗，后改成操作条**：弹窗照 Herdr `prompt` 做，用户试看后改成头部下面的操作条（教训 L21）。操作条画在 viewer 自己的视图里，不经过 overlay 和共享状态的应答。

*片 1 做完后要你试的*：在预览位和 tab 里各改一下文件，看 `*`；`Ctrl+S`；让 agent 改一个你没动过的文件，看它自动刷新、光标不跳；Markdown 打开是源码；远程或很大的文件不能改并显示铅笔图标；折叠箭头出现；`Ctrl+Shift+↑↓` 有没有被编辑器吞掉（片 4 之前先测）。

**ui-ux-pro-max 审查**（2026-11-26，规格阶段）：按它的规则表逐条对照，改了四处：① 改动标记不用 `●`（和侧边栏重复，见上）；② `Don't save` 是丢掉改动的危险动作，改成红色、放左边和 `Save` 隔开（`destructive-emphasis`、§2.2）；③ Go to line 的输入框加标签 `Line`，不只靠占位文字（`input-labels`，Herdr 的 prompt 本来就有）；④ 只读图标换成 `pencil-simple-slash`（`lock-simple` 已是 space 图标）。预览截图后又改了一处：⑤ 两个确认框的标题改成 §2.6 的写法（问句带数量，名字进名单框），截图里标题里的反引号原样显示出来了。其余对得上：确认框有 Cancel 和 Esc（`escape-routes`、`sheet-dismiss-confirm`）；保存成功的反馈是标记消失（`success-feedback`，VS Code 一样）；只读图标有 tooltip（`icon-context`）；改动标记是字形，不只靠颜色（`color-not-only`）；快捷键只在 viewer 有焦点时生效，不碰系统和终端的键（`keyboard-shortcuts`）。操作条（2026-11-26）：⑥ 输入框左边有看得见的标签 `Line`（`input-labels`）；输错时边框变红，不只靠颜色——Enter 不跳转、条不收起（`inline-validation`）；关闭按钮的 tooltip 写上 `Esc`（`escape-routes`）；交叉核对：`x` 在所有 mod 里都表示关闭，标签 `Line` 和文件树的 `Filter files` 不会混淆。

**你来试**：保存；保存冲突（让 agent 先改一下同一个文件）；离开有改动的文件时三个按钮；关 tab 后再打开，草稿恢复；`Ctrl+G` 的操作条（Enter、Esc、×、输错、预览位和 tab 里各一次）；`Ctrl+/` 在 TS、Python、HTML 文件里；移动行、复制行；Markdown 默认打开源码。

---

### 4.9 awsome-statusline：底部状态栏，按模块组装（2026-11-27，方向已确认，预览待确认）

**决定的经过**：用户要编辑器的状态（光标位置、缩进、行尾……）像 VS Code 一样放在最下面的状态栏，要紧凑、尽量用图标，因为以后别的 mod 也要往这条栏上放东西（比如 agent 的详细信息）。两个办法里选了"新开一个 mod，把状态栏按模块装进去"。

**VS Code 的想法**：栏本身只管排版（左半、右半、按优先级排序），每一项由各个扩展自己贡献；每一项既是状态又是入口，点一下就能改它；有编辑器时才出现编辑器那一组；放不下时低优先级的先让位。

**范围**：新 mod `awsome-statusline` 接管布局里 `status` 那一块（现在是 Herdr 的 `workspace-status`，32 高）。Herdr 原有的几项作为它的内置项**原样保留，位置和内容都不改**（用户 2026-11-27：`1 agent` 暂时还在左边，需要调整时再改）：左边机器、分支、`1 agent`，右边命令提示 `Ctrl+Shift+P commands`（代码、字号、颜色、图标取自 `workspace-status`，规则 6 的来源是 Herdr 自己）。

**项的登记**（mod 之间不能互相 import，走共享状态，和 `pane-heads`、`mod-icons` 同一个做法）
- `shared("awsome-statusline.items")` = `{ "<mod 名>": [ item, … ] }`；每个 mod 只写自己名下那一项（读出、改自己、写回）。mod 关掉或不再有这些项时写 `[]`。
- `item` = `{ id, side: "left" | "right", order, keep, icon?, text?, tip?, choices?, shown? }`：
  - `order`：同一边里从外向中间的位置，数字小的靠外（左边靠左、右边靠右）。内置项：机器 10、分支 20、`1 agent` 100，命令提示靠最右；我们的编辑器项 30～60。
  - `keep`：放不下时谁先让位，数字小的先收成图标、再隐藏；默认 50。
  - `icon`：mod 自己文件夹里的图标路径；`text`：短文字，不超过约 14 个字符。
  - `tip`：悬停提示，只放栏上没有的信息（教训 L20），比如 `Indentation: 2 spaces`。
  - `choices`：`[{ id, label, checked? }]`，有它这一项就可以点开菜单；没有则点击只通知所有者（比如点 `Ln 12, Col 5` 打开跳到行的操作条）。
- 点击的通道：状态栏把 `{ item: "<mod>.<id>", choice?, at }` 写进 `shared("awsome-statusline.click")`，所有者 mod 在自己的定时检查里取走并处理（和确认框的应答 `awsome-viewer.answer` 同一个做法）。原因：点状态栏会让编辑器失去焦点，"只有编辑器有焦点才响应命令"的规则（§4.8）会把点击挡掉。
- 菜单：状态栏用共用菜单组件（§2.6、`menu.js`，向上弹出，贴着被点的项），选中后把 `choice` 写进上面的点击。

**排版**
- 栏：32 高（布局的 `status` 块）、`px 14`、`chrome` 底、上边线 `border`、文字 11.8 `muted`（取自 `workspace-status`）。
- **左对齐 = 这台设备，以及在这台设备上正在做的事**：机器（`This computer`）、分支、这台设备上当前打开的文件的编辑器状态（光标、缩进、编码、行尾……）。读起来是一条连贯的链：**这台机器 → 这个分支 → 这个文件的状态**（机器 → 分支 → 编辑器），最后才是 `1 agent`。所以我们的编辑器项插在分支和 `1 agent` 之间；`1 agent` 前面空一个大一点的间距（16，其余项之间是 6 + 4），并且它自己带着圆点，一眼看得出是另一个概念，不会和 `CRLF` 连读成一句话。Herdr 内置项的内容和样子不改，只是 `1 agent` 的位置往后挪了几个项。
- **右对齐 = 外部和辅助的信息**：命令提示（`Ctrl+Shift+P commands`，Herdr 原有）、以后 agent 的详细信息、其他 mod 的辅助信息；我们贡献的右边项靠在命令提示的左边。（参照用户之前备份的 `herdr-mod-reference/session-bar`：左边是文件夹、分支、git，右边是 Claude 的模型、上下文、用量。）
- 项与项之间 16；中间 `flex_1` 留空。栏上的项，左右两边各自按 `order` 排；放不下时按 `keep` 让位。
- 每一项是一个小块：`px 6`、`py 2`、圆角 5，悬停 `hover` 底、`foreground` 字（取自 Herdr 的 `Esc` 小按钮，`picker` / `help`）；块与块之间 4，加上块自己的左右 6，文字到文字是 16，和 Herdr 项之间的间距一致。
- 图标 13、`dim`，图标和文字之间 6（取自 `workspace-status` 的 `label()`）。
- **紧凑**：每项默认是图标加一个很短的值；图标表达不了的（`CRLF`、`UTF-8`）直接写文字。栏放不下时：先把优先级最低的几项收成只剩图标，再放不下就隐藏，不挤别人，也不换行；右边（辅助信息）先让位，左边（这台设备）最后让位。
- 没有任何项登记时，这一半是空的，栏就是 Herdr 原来的样子。

**编辑器的项**（登记在**左边**，紧挨着分支；`awsome-viewer` 登记，只有"最近一个拿到焦点的编辑器"登记，其余的 viewer 不登记；它关掉或换成图片 / 渲染的 Markdown 时清空）
| 项 | 显示 | 点击 | 来源 |
|---|---|---|---|
| 光标 | `12:5`，有选区时 `12:5 (8)` | 打开跳到行的操作条 | VS Code 状态栏 `Ln 12, Col 5`、点开 Go to Line |
| 缩进 | 图标 + `2`（tab 时 `Tab 4`） | 菜单：`Spaces` / `Tabs` 和 `2` `4` `8` | VS Code `Spaces: 2`、点开 Select Indentation |
| 编码 | `UTF-8`（文件原本有 BOM 时 `UTF-8 BOM`） | 只显示，不能改（用户 2026-11-27：不需要兼容旧系统，只管近 5 年的系统；BOM 是给老工具用的，不提供加 / 去的入口）。保存时原样写回 BOM（§4.8 "行尾和编码原样写回"） | VS Code `UTF-8` |
| 行尾 | `LF` / `CRLF` | 菜单：`LF`、`CRLF` | VS Code `CRLF`、点开 Select End of Line Sequence |
| 换行 | 图标，开着时高亮 | 切换当前文件的自动换行 | VS Code 没有状态项；`Alt+Z` 的鼠标版，同一个动作 |
| 只读 | 图标 `pencil-simple-slash` | — | 和头部的只读标记同一个图标，同一个意思 |
- 改缩进 = 只改 Tab 键插入什么（`set_tab_size`），不重排文件（VS Code 的 `Indent Using Spaces` 才会重排，不做）。改行尾 = 改下次保存时写回的样子，并把文件标成有改动（`*`）。

**去 / 回**（登记进 `design/flows.json`）：状态项的菜单（去：点那一项；回：Esc、点别处，和所有菜单一样）；光标项打开操作条（回：Esc、×）。

**要先验证的**（各做一个小测试）：1. 状态栏的 mod 能不能读到别的 mod 刚写的共享状态并马上重画（`workspace-status` 读 `spaces()`、`agents()` 是 Herdr 的，没用过 `shared`）；2. 向上弹出的菜单贴着被点的项（`at: "pointer"` 在底栏点击时的位置）；3. 把布局的 `status` 块换成新 mod，`install.sh` 在临时 `HERDR_APP_HOME` 里装得上、切回旧布局不坏；4. 12 个项放满时的收缩规则。
**设置**（`awsome-config`）：状态项各自开 / 关（默认全开）。

---

## 5. 执行计划

### 5.1 顺序和依赖

**顺序（已确认）：P0 → P1 → P1b → ~~P1c~~（2026-11-26 推迟，见 §4.2.5）→ P2 → P4b ✅ → P4（拆成 P4a → P4c → P4d → P4e）→ P3b → P3 → P5**。会动用户文件的 P3 放在靠后，等确认对话框和平台适配表在 P4 里用熟了再做。**P6（编辑器）用户 2026-11-26 要求先做 P6a**，插在当前位置；P6b、P6c 排在 P6a 之后，P6b 的评论和 P5 的 review 一起设计（同一套评论数据和发给 agent 的格式）。

| 阶段 | 内容 | 依赖 | 风险 |
|---|---|---|---|
| P0 | 主题（`awsome-dark` / `awsome-light`：shadcn + Apple，§1、§2.3）；版式（4px 缝隙、底栏对齐，§2.2）；字体规则（§2.2）；设置入口按钮（§3）；两个设置改名；文件树键位改成 `mod:awsome-filetree` 分区并去掉旧键位（§8）；Files 原型收尾；共用的确认对话框和右键菜单样式；`awsome-tabs` 的拖拽规则统一（§2.6） | — | 低 |
| P1 | 侧边栏：agents 接线（sub agent 缩进、点击开 pane）；`awsome-menu`；space 单项右键菜单（Terminals、Agents、worktree、space 操作） | P0 | 低（上游已写好） |
| P1b | 侧边栏：选择模型、多选菜单、`Appearance…`（颜色 + 图标）、分组和拖拽 | P1 | 中高 |
| P1c | ⏸ 推迟（nice to have，复杂）：侧边栏平铺（`Tile agents`、快捷键开关） | P1b | 中 |
| P2 | 打开文件：单击在布局的全局预览位（`layout.show`）、双击固定 tab（§4.4a）；文件树的选择模型（§2.6）和选择条 | P0 | 中（文件树、viewer、布局三处联动） |
| P4b | History 的图视图 | P0 | 低 |
| P4 | Changes，2026-11-26 拆成四块，每块单独预览、提交： | P0 | 中高（discard 会丢改动） |
| P4a | Changes 的布局、文件行、树视图；**Files 一起改**（用户 2026-11-26：两个面板在同一个位置切换，标题行、文件行、树按同一份规格）。**方向：Changes 跟着 Files 改**（用户 2026-11-26："应该是 changes 跟着 files 改"）：Changes 的标题栏照 §4.3 的 Files 标题栏（名字 + 视图图标按钮 `Changes (1)` / `History (2)` + 分隔线 + 这个视图的工具，全是 22px 图标按钮），P4b 的文字标签和"工具放在分支行"改回来；分支行只留分支（Files 摘要的第一行），比例条和计数只在 Files。提交按钮的下拉改用共用 `menu.js`（L15 遗留） | P4b | 中（动到已试用过的 Files 和刚做的 P4b） |
| P4c | Discard + 快照、确认对话框 | P4a | 高（会丢改动） |
| P4d | 多 repo：发现、Repositories 列表、Files 着色 | P4a | 中 |
| P4e | 生成 commit message | P4a | 中 |
| P3b | 内容搜索 | P2 | 中 |
| P3 | 文件操作：新建、重命名、删除、拖拽移动、`Ctrl+Z`；批量发送给 agent、批量删除 | P2、P4 的确认对话框和平台适配表 | **高（改磁盘文件，三个系统命令不同）** |
| P5 | diff 行选择 + review + 发给 agent | P4 | **最大** |
| P6a | 预览变成编辑器：直接编辑、保存、冲突、外部改动、未保存提示和草稿、跳行、注释、移动和复制行、Markdown 默认源码（§4.8） | P2 | 中高（写用户的文件；行尾写错会让整个文件出现在 diff 里） |
| P6b | 和 agent 打通：选区发给 agent、终端链接跳进编辑器、agent 打开文件、代码和 Markdown 上的评论一起发给 agent（和 P5 一起设计） | P6a | 中 |
| P6c | AI 改代码：让运行中的 agent 改选区，逐块审查它的改动 | P6b | 中高 |

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
| P1c | `Ctrl+Shift+G` 开关平铺；在平铺里打字、按 Esc；`Open in its tab` |
| P2 | 单击预览位、Space、双击开 tab、预览位的 × 和 Esc；Ctrl / Shift 多选文件；选择条 |
| P4b / P4 | 切 List / Graph；discard 的确认和快照找回；生成 commit message；多 repo 的切换和跟随 |
| P3b | 搜索中文、正则；点结果跳到行 |
| P3 | 新建、重命名、删除到回收站、拖拽移动、`Ctrl+Z`（三个系统各试一次，macOS / Linux 需要你在那边的机器上跑） |
| P5 | 选行写 review 并发给 agent |
| P6a | 见 §4.8 末尾"你来试" |

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
- 配色：shadcn Neutral 的灰阶 + Apple 系统色，主题名 `awsome-dark` / `awsome-light`；浅色侧边栏用纯白；悬停或选中行上的文字降到 4.2～4.4:1，**保持来源原值不改**（你确认）。
- 当前项：左侧指示条，画法取自 Primer（方案 A，你确认）。
- 字体：标识类文字用 JetBrains Mono，说明文字用 Geist。
- 编辑器（2026-11-26）：用 Herdr 自带的 `Editor`；Herdr 没开放的（查找、替换、多光标、折叠、自动提示）不做；Markdown 像 VS Code 一样默认打开源码（§4.8）。

**这次统一时我改掉的地方**（§2.8 有完整表）：拖拽不再要求按住 200ms；组头不显示数字、不靠双击重命名；当前项用左侧指示条（画法取自 Primer，你选了 A），锚点用描边；确认对话框统一成 Enter 确认；菜单用 sentence case。**如果其中哪条你不同意，告诉我。**

**还没决定**：
- ❓ 平铺的默认快捷键 `Ctrl+Shift+G`（你提的，已查过 Herdr 没占用）在你机器上实测；Repositories 的 `Next repository with changes` 键位：实测后定。
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

**按平台写默认键的做法**（P6a 定下，以后的 mod 都照这样做）：
- `mod.schema.json` 的快捷键设置写 `default`（Windows / Linux 的拼法）；macOS 拼法不同时再写 `x-default-macos`。
- 仓库里两份键位文件：`config/keys.merge.json`（Windows / Linux）和 `config/keys.merge.macos.json`（只放 macOS 的拼法）。`install.sh` 在 macOS 上按**动作**替换：`keys.merge.json` 里绑到同一个动作的键换成 macOS 文件里的键。
- awsome-config 在 macOS 上把 `x-default-macos` 当作默认值来显示、重置、写进 `keys.json`。
- `ui-check.py` C13 检查三处一致：设置的默认值在 `keys.merge.json` 里绑到它的动作，`x-default-macos` 在 `keys.merge.macos.json` 里绑到它的动作，macOS 文件里的动作在 `keys.merge.json` 里也有。

| 动作 | 默认键 | 作用范围 | 说明 |
|---|---|---|---|
| 打开 mod 设置 | `` Shift+Alt+` `` | 全局 | Windows 上 Herdr 叫它 `alt-~`，已确认能用。底栏按钮是主入口 |
| 平铺 / 复原当前 space 的 agent | `Ctrl+Shift+G`（macOS `Cmd+Shift+G`） | 全局 | Herdr 没占用，和它的 `Ctrl+Shift+T` 等应用级命令同一族。**不用 `Ctrl+Tab`**：Herdr 已绑成 `tab.next`，也是浏览器的"下一个 tab"。不用 `Ctrl+Shift+G`：在 AltGr 键盘布局上可能打出字符。macOS 上 `Cmd+Shift+G` 在很多应用里是"查找上一个"，要实测 |
| 文件树：上一级 | `Ctrl+Alt+Backspace` | 文件树有焦点 | §4.3 |
| 文件树：进入选中的文件夹 | `Ctrl+Alt+Enter` | 文件树有焦点 | 单独的 Enter 仍是展开 / 打开 |
| 文件树：回到跟随终端 | `Ctrl+Alt+Home` | 文件树有焦点 | 上一级 / 进入文件夹之后，用键盘回到跟随（房子按钮的键盘版），有去有回（L6） |
| 文件树：撤销 | `Ctrl+Z`（macOS `Cmd+Z`） | 文件树有焦点 | 不抢终端的 Ctrl+Z |
| 重命名 | `F2` | 文件树或侧边栏有焦点 | 文件、space、组 |
| 文件树：删除（进回收站） | `Delete`（macOS `Cmd+Backspace`） | 文件树有焦点 | 弹确认 |
| 文件树：搜索内容 | `Ctrl+Shift+F` | 文件树有焦点 | 更具体的 `mod:awsome-filetree` 分区优先，不和 Herdr 终端里的查找冲突 |
| Changes：提交 | `Ctrl+Enter`（macOS `Cmd+Enter`） | 提交框有焦点 | 和 VS Code 一致 |
| Changes：下一个有改动的 repo | 待定 | Changes 有焦点 | **实测后定** |
| 取消 / 清空选中 | `Esc` | 当前面板 | |
| 编辑器：保存 | `Ctrl+S`（macOS `Cmd+S`） | viewer 有焦点 | §4.8 |
| 编辑器：跳到行 | `Ctrl+G`（macOS 也是 `Ctrl+G`） | viewer 有焦点 | §4.8 |
| 编辑器：注释 | `Ctrl+/`（macOS `Cmd+/`） | viewer 有焦点 | §4.8 |
| 编辑器：上移 / 下移行 | `Ctrl+Shift+↑` / `↓`（macOS `Cmd+Ctrl+↑` / `↓`） | viewer 有焦点 | Sublime Text 的键；VS Code 的 `Alt+↑↓` 被 Herdr 占用 |
| 编辑器：复制行 | `Ctrl+Shift+D`（macOS `Cmd+Shift+D`） | viewer 有焦点 | Sublime Text 的键 |

**键名规则（实测得出）**：Windows 上，**带 Shift 的标点键，Herdr 用它产生的字符命名**（Shift+\` 是 `~`，Shift+, 是 `<`），`shift` 标志是 false；这和键盘布局有关。所以默认键尽量用字母、数字、方向键、Enter、Backspace、F 键，少用 Shift+标点。

**要避开的键**：`alt-up` / `alt-down`（Herdr 的 agent 切换）、`alt-1..9`、`alt-h/j/k/l`、`alt-left/right`、`ctrl-1..`、大部分 `ctrl-shift-*`；`ctrl-alt-shift-escape`（紧急重置，任何东西都不能占）。

**关于 Ctrl+Alt**：Windows 上 Ctrl+Alt 是 AltGr，但 Backspace、Enter 不打字符，没有冲突。Linux（X11）上 `Ctrl+Alt+Backspace` 历史上是"杀掉图形界面"，现在大多默认关闭，要在 Linux 上实测一次。

**实现说明**：文件树现在用视图的 `on_key_down` 直接读按键，不能被 `keys.json` 或 awsome-config 重绑。要改成 `mod:awsome-filetree` 键位分区：`keys.json` 里写 `"mod:awsome-filetree": { "ctrl-alt-backspace": "awsome-filetree.up", … }`，mod 通过 `nextCommand()` 接收命令。列入 P0。

---

## 9. 当前未提交的改动

无（2026-11-25 全部已提交）。许可证和上游改动记录，等到发布 mod 时再统一处理。

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
