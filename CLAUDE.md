# awsome-herdr

Clyde 的 Herdr 配置仓库：`mods/` 下 7 个 mod（`awsome-*`，改自 munza/herdr-mods 和 cybertron288/herdr-mods）、`config/` 下的布局和键位、`install.sh` / `sync.sh`。用户用中文交流。

## 常用命令

- `./install.sh`：把 mod、布局、键位、设置装进 `~/.config/herdr-app`（`HERDR_APP_HOME` 可改）。旧文件移进备份目录，不删除。Windows 上在 Git Bash 里运行。
- `./sync.sh`：从 Herdr 目录把 mod 和布局同步回仓库。
- `herdr-app check mods/<name>`：加载一个 mod 并检查。改完必跑。
- `herdr-app status`：看 `errors`。`herdr-app shot <file.png>`：截取当前窗口，之后读图。
- 切面板：`herdr-app do layout.select '{"stack":"panel-body","child":"changes"}'`（或 `files`）。
- 试装不想碰正在用的窗口：`HERDR_APP_HOME=<临时目录>`，并把 `herdr-app` 从 `PATH` 里去掉再跑 `install.sh`。

## 做功能的规则

0. **先看别人怎么做，再看接口，最后才动手。** 开工前先查 herdr.dev/mods 和 GitHub 上有没有人做过同类 Herdr mod，读它的实现（克隆到临时目录，只读，不运行）；再把 `gpui-kit.d.ts` 和 `herdr.d.ts` 搜全（绘图有 `PathBuilder` / `paint_path`，我曾经因为搜漏而下错结论）。**借鉴思路和技术，不搬运整块功能。** 别人的 mod 常带着我们不需要的一大堆东西（别的 git 操作、多仓库、Rust 辅助程序等），范围以用户的需求为准。要复制别人的代码片段时先问用户。
1. **写胶水，不自研功能。** 按顺序找现成的：（A）Herdr 自带的命令和 `gpui-component`；（B）纯 JS 的 npm 库，打成单个文件放进 mod 文件夹（运行时没有 Node、DOM、`setTimeout`，有 `path`、`fs/promises`、`fetch`）；（C）成熟的命令行工具，用 `exec` 调用或放进终端 pane。每个功能开工前先做小验证：库能打包、`herdr-app check` 通过、能跑通一次。自己写的逻辑变多时，先告诉用户。
2. **Windows、macOS、Linux 三平台通用。** 按 `window().platform` 分支；快捷键存"逻辑键"，写进 `keys.json` 时翻译成各系统的真实按键（macOS 用 `cmd`，其余用 `ctrl`）。避开 `ctrl-alt`（Windows 上是 AltGr）、Option+字母（macOS 会打出字符）、单独的 `ctrl-字母`（终端程序在用）。`alt-shift`、`ctrl-shift` 在 Windows 上可能是切换输入法的系统热键，默认值都要可配置、要在用户机器上实测。脚本用 POSIX sh。
3. **设置都走 `awsome-config`。** 在 mod 的 `mod.schema.json` 里描述，值写在 `mod.json` 的 `settings` 下（`limits` 和 `default` 并列，不要放进 `default`）。快捷键设置用 `format: "key"` 加 `x-action`。
4. **所有界面文字用英文**：按钮、菜单、提示（tooltip）、对话框、设置项的标题和说明、通知。文档、需求和与用户的对话用中文；代码、提交说明用英文。
5. **安全约定。** 删除一律进系统回收站，不提供撤销。新建、重命名、移动这类低风险文件操作支持撤销，默认 Ctrl+Z（macOS 是 Cmd+Z），只在文件树有焦点时生效，不抢终端的按键。discard 这类会丢用户改动的 Git 操作要确认。
6. **界面先定稿，再动手。** 用户不接受半成品和返工（P0 的主题做了三遍、菜单重做过一次）。任何新界面或改样式，按这个顺序：
   0. **先查惯例**：任何交互（新做的、或从上游继承的）先写下至少两个常见软件（VS Code、Windows 资源管理器、macOS Finder、浏览器、Herdr 自己）的做法，登记进 `design/conventions.json`，照着做；要偏离写明理由（`docs/UI-LESSONS.md` L8）。
   1. **定来源**：设计系统是 shadcn/ui（Neutral 灰阶、间距、圆角、组件结构）+ Apple 系统色（`docs/REQUIREMENTS.md` §2）。每个数值都要能说出取自哪个公开来源的哪个令牌或类名，**从官方源码或页面数据里取，不凭记忆、不自己调**。来源没定义的值才推导，并写明推导规则。
   2. **一次定全规格**：这个界面用到的所有部件（行、菜单、对话框、按钮、空状态、悬停 / 选中 / 禁用）的尺寸、颜色令牌、字体、对齐线，一次写进 `docs/REQUIREMENTS.md`，不边做边补。**有去必有回**：把操作路径当成一张往返的图来设计，每个让用户去到别处、进入另一个状态的动作，都同时设计回来的动作，回来的方式覆盖去的方式（鼠标对鼠标、键盘对键盘），先登记进 `design/flows.json` 再做（`docs/UI-LESSONS.md` L6）。
   3. **算清楚再画**：对比度用**真实底色**（侧边栏 `chrome`、卡片 `surface`，以及叠上 `hover` / `selected` 后的颜色）算，深浅两套都算；版式算出每条横线、竖线的位置，和相邻区块的线对齐（底栏、标题行、卡片边）。
   4. **先给预览，用户确认**：用临时预览 mod（只放进 `~/.config/herdr-app/mods`，用 `herdr-app do mod.open` 打开、截图后关掉并移进备份）在深浅两种主题下截图，把截图和规格一起给用户看。确认之后才改正式代码。
   5. **做完再核对**：截图逐像素量关键的线和颜色，和规格对一遍；交互（右键、拖拽、悬停手感）列清单请用户试。
7. **界面规则由程序把关，并持续补充。** `python scripts/ui-check.py` 检查颜色出处、对比度、版式对齐、写死的颜色、共用件一致、英文界面、菜单写法、图标、规格常量、操作路径有去有回、交互符合常见软件的惯例、默认设置一致、界面文字克制（C1～C14，登记在 `design/flows.json`、`design/conventions.json`）。它在我每次编辑文件后（`.claude/settings.json` 钩子）和每次提交前（`.githooks/pre-commit`，新克隆的仓库先执行 `git config core.hooksPath .githooks`）自动运行。界面装进 Herdr 后、告诉用户之前，用程序确认它真的显示出来了：弹出层和菜单跑 `python scripts/ui-open-check.py <mod>`（核对实际排版的尺寸，不能是 0），版式跑 `python scripts/ui-shot-check.py`；截图只用来看样子，不用来判断"有没有出现"（L7）。**用户每纠正一次界面问题，就在 `docs/UI-LESSONS.md` 加一条教训**；能程序化的同时加一个检查，并先在仓库副本里故意造这个错，确认能拦住。设计数值只改 `design/tokens.json` 和 `config/themes/sources.json`，不在代码里另写。不许为了让检查通过去关掉检查或放宽阈值；要放宽，先问用户。

## Herdr 能做什么、不能做什么（以 `~/.config/herdr-app/*.d.ts` 为准）

- **不能**：HTML、CSS、web view、Node API、`setTimeout`；在自己的块之外画东西（只能用弹出层和对话框）；改终端怎么画文字；读别的 mod 的代码。所以 React、shadcn、Vercel UI SDK 之类不能直接用。
- **能画**：`PathBuilder` + `paint_path`（直线、贝塞尔曲线、圆弧、虚线）；阴影、圆角、透明度、`transition`（弹簧动画）、`loop`。没找到渐变。
- **自带组件**（`gpui-base` / `gpui-component`）：Button、Switch、Tabs、Table、Popover、Select、Input、Textarea、Slider、Accordion、虚拟列表、滚动条、`Editor`（只读代码视图）、`TextView`（Markdown）。
- **运行时模块**：`path`、`fs/promises`（只能写 `~/.config/herdr-app`）、`fetch`、`crypto`、`os`；`exec` 没有标准输入，有超时限制。
- **颜色**用 `theme()` 的语义令牌（`foreground`、`dim`、`muted`、`border`、`hover`、`selected`、`raised`、`chrome`、`popover`、`accent`、`ansi1..6`、`working`、`blocked`…），不写死色值，否则换主题会坏。
- **Herdr 已占用的键**：`alt-up/down`（agent 切换）、`alt-1..9`、`alt-h/j/k/l`、`alt-left/right`、`ctrl-1..`、大部分 `ctrl-shift-*`，以及 `ctrl-alt-shift-escape`（紧急重置，任何东西都不能占）。

需求、已做的决定、键位、视觉规则见 `docs/REQUIREMENTS.md`（那里是它们的唯一来源，这里不重复）。

## 在这个仓库里踩过的坑

- **mod 之间不能互相 import。** `file-icons.js`、`settings.js`、`syntax.js` 在几个 mod 里是逐字节相同的拷贝，改一份要同步改其他几份。图标包 `awsome-icons` 只能按路径读取。
- **一个视图渲染太久会被 Herdr 打断**：面板卡在"Loading…"，顶部出现 "This view could not be re-rendered"，小字 "interrupted"，没有日志。`awsome-changes` 的 `limits.files` 是 200（600 渲染不完，300 正常）。写长列表要先量。
- 有 `"place": "right"` 的 mod 会被 Herdr 自动加进当前布局，造成重复面板。
- mod 的名字出现在布局、共享状态的键、`props`、图标路径里，改名要一起改。每个 mod 在 `data/<mod>/` 里记住自己的状态（比如上次打开的标签页），所以"换了名字就坏"往往是状态不同，不是名字本身。
- 挪走一个正在运行的 mod，窗口会一直报 `... does not exist`，重启 Herdr 才消失，不影响使用。
- `herdr-app shot` 在 Herdr 忙时会拍到旧画面；切布局或重建大视图后等 20 秒以上再拍。
- **我发出去的命令里，成对的反斜杠 `\\` 会被合并成一个。** 写路径或正则时不要依赖反斜杠字面量：用 `String.fromCharCode(92)` 拿反斜杠，用 `[/]` 代替 `\/`。这条坑造成过"上一级"按钮失效（Windows 路径不匹配）。
- **我只能截图，不能点击、右键、拖拽。** 静态界面自己拍图确认；交互的手感请用户操作后反馈。

## 仓库约定

- 不提交：仓库根目录的截图（`changes-ui.png` 等）、`HANDOFF.md`、任何带本机路径的文件。没有用户要求不推送。
- 许可证和上游改动记录，等到发布 mod 时再统一处理。
- 界面审美用 `ui-ux-pro-max` skill 补足：取它的原则（间距、层次、反馈、可访问性），不套网页的实现，因为这套界面是 GPU 渲染的 Herdr mod，不是网页。
