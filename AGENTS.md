# 本仓库的约定

给在本仓库工作的 agent（以及未来的自己）。

> **发布流程以 [docs/RELEASING.md](docs/RELEASING.md) 为准**（squash、打标签、写 Release、
> 两个 profile 都要装）。这份文件只记"日常改代码时"容易踩的东西。

## 版本号：本地开发一律用 `<目标版本>-dev.<N>`，而且**只增不减**

本地迭代（改一点 → 推 pin → 真机验）**不消耗正式版本号**，一律写成：

```
5.7.1-dev.1  →  5.7.1-dev.2  →  …  →  验证通过  →  5.7.1
```

- 每推一次本地开发版，`N` 加一；**目标版本在真机验证通过之前不动**
- 验证通过、准备交付时，才去掉 `-dev.N` 写成正式号（那一步要去 CHANGELOG 合并 `dev` 条目）
- ⚠ **绝对不能让版本号往回走**：市场拿版本号判新旧，号变小 = 用户**永远收不到更新提示**
  （现象是"数据都对，就是没提示"，极难查）。已发布的正式号之后，目标版本必须**高于**它 ——
  例如 `5.7.0` 发布之后，下一个只能是 `5.7.1-dev.1`，**不能**是 `5.7.0-dev.3`。

推本地开发版时必须同时做两件事（**守卫 #40 会查**，含"只增不减"）：

1. `package.json` 的 `version` 改成新的 `-dev.N`
2. `CHANGELOG.md` 里必须有 `## [<同一个号>]` 的条目，且必须是**最新一条**

## `lib/panel.mjs` 的注释里**绝不能出现反引号**

`lib/panel.mjs` 整体是一个反引号模板字符串（`export const INJECT_SCRIPT = \`…\``）。
注释里写一个反引号就会**把整个注入脚本截断**，而 `node --check` 只查宿主文件、**查不出来**
（踩过两次）。守卫 #39 的 ⓪ 会直接 `new Function(INJECT_SCRIPT)` 把它抓出来。

同理，`INJECT_SCRIPT` 里也不能用模板插值 `${…}`。

## 不要用 shell 回写文本文件

中文 Windows 上 `Get-Content` 会按 GBK 读 UTF-8 文件，`[IO.File]::WriteAllText` 回写就是
一文件乱码（踩过，靠 `git checkout` 恢复的）。改文本一律用编辑工具。

## 改完必须跑

```
npm test                            # 前置自检 + 40 条守卫，必须 exit 0（要看 exit code！）
node <workspace>/rail-check.mjs     # 窄屏适配层的行为桩（30 条）
```

`npm test` 的第一环是 `test/check-inject.mjs` —— **它必须排在最前面**，因为
`test-dist.mjs` 里 `import { INJECT_SCRIPT } from '../lib/panel.mjs'` 是**静态 import**：
`panel.mjs` 一旦语法坏掉，整个测试文件根本加载不起来，里面写多少守卫都跑不到
（只能看到一个晦涩的模块加载错误）。而这个文件最容易坏的方式就是注释里混进反引号。

守卫是"结构断言"，行为桩是"真跑一遍"。**只有守卫过不代表能用** —— 加新逻辑时两边都要补。

## ⛔ 绝对不要 push / fetch（GitHub 另有专门的会话负责）

**这个仓库的 GitHub 侧由另一个专门的会话管理。本会话只负责本地 git。**

- **不要 `git push`** —— 无论改动多么"显然该上去了"
- **不要 `git fetch` / `git pull`** —— 那也是网络操作，会改动远端引用
- 本地 `git commit` 随便做 ✓（这是本会话该干的）

⚠ 为什么必须写死这条：这台机器上 `credential.helper = manager`
（Git Credential Manager，三级都配好了），**`git push` 会直接复用已有的 GitHub 凭据、
静默成功、不问一句** —— 也就是说"不小心推上去"这个失误在这里是**默认行为**，
没有任何阻力挡着它。只能靠这条纪律。踩过：我连续推了 9 个提交。

## 部署：两个 profile 都用 **GitHub pin**（用户 2026-10-12 决定"都改回 pin"）

> 历史：2026-10-11 曾改成 `link:` 本地路径（理由是"不要再依赖 GitHub"），
> 2026-10-12 用户改主意，**两个 profile 都改回 pin**。
> 现在的形态：`node_modules/dsh-web-remote` 是**真实目录**（不是 Junction），
> 内容来自 GitHub 上那个提交的 tarball。

两个 profile 的依赖写法（**当前值 = v5.7.1 发布提交**）：

```jsonc
"dsh-web-remote": "github:godchen520/dsh-web-remote#d2a669b87c0e6ce9be2bdd2b28d404c89dbc04dd"
```

**所以我的本地改动不会自动生效** —— pin 是远端快照。完整循环是：

```
我：改 checkout → npm test → **本地 git commit（绝不 push）**
GitHub 会话：推送 + 发布（squash 成 release 提交）
我（或它）：两个 profile 都换 pin → 各自 pnpm install → 重启 DSH
```

⚠ **两个 profile 必须换成同一个 SHA**（桌面端走的是 `desktop` profile）——
只改一个会让另一端看不到改动，踩过。

### `link:` 的坑（万一以后又改回本地路径，先读这段）

**pnpm 把 `link:` 目标当"本地包"，不会装它自己的 `dependencies`**；而 Node 解析
`import` 走的是 **Junction 的真实路径**（`packages/dsh-web-remote/lib/…`），
只会往 `packages/node_modules`、`.dsh/node_modules` 找 —— **profile 的 node_modules
根本不在查找链上**。

2026-10-11 实际踩到：改成 `link:` 后漏了在 checkout 装依赖 → **所有依赖 SDK 的通道全哑**
（QQ 扫码报"扫码 SDK 未安装"、飞书/钉钉连不上），**只有微信正常**（微信不依赖 SDK）。
修法是 `cd packages/dsh-web-remote && npm install`（仓库自带 package-lock.json）。

**改回 pin 之后这个问题自动消失** —— 正规包安装会把插件依赖装进各自 profile 的
`node_modules`，四个 SDK 都从插件目录能 `import` 到（已验证）。

四个 SDK（`package.json` 的 `dependencies`）：

| 包 | 用途 |
|---|---|
| `@tencent-connect/qqbot-connector` | QQ 扫码绑定（`startQrConnect`） |
| `@tencent-connect/qqbot-nodejs` | QQ 连接（`QQBot`） |
| `@larksuiteoapi/node-sdk` | 飞书 |
| `dingtalk-stream` | 钉钉 |

**验证方法**（别只 `require.resolve` 包名根路径 —— 这些包是 `"type":"module"`，
`require` 会有 CJS/ESM 互操作假象，看着像缺文件其实没缺）：

```powershell
cd <profile>\node_modules\dsh-web-remote
node --input-type=module -e "await import('@tencent-connect/qqbot-connector'); console.log('ok')"
```

⚠ 为什么曾经有 push 事故：两个 profile 长期写 `github:godchen520/dsh-web-remote#<sha>`，
**那种 pin 要求提交必须已经在 GitHub 上**，而当时我以为"要部署就得先推" ——
这就是我越界 push 9 个提交的直接诱因。**正确做法是等 GitHub 会话推，不要自己推。**

> 中间短暂改成 `link:` 的那一天，插件管理器会把它标成「本地开发」、市场不再推更新提示；
> **改回 pin 后这些副作用都没了** —— 市场照常跟踪、能收到更新提示。

## 窄屏适配层的既有事实（改之前先读）

- 宽度改写走**纯 CSS + `!important`**（能压过 React 的内联样式），不要退回 JS 改写
- **必须逐列钉住 `grid-column`**：官方收起态侧边栏是绝对定位浮层、脱离网格流，
  `centerCol` 会落到已变 0 宽的第一轨道上把对话挤成 0 宽（间歇性）
- 第三条轨道是 **`_rightbarCol`**，不是参考实现里的 `_detailsCol`（本版 DSH 没有那个后缀）
- 选择器用**语义后缀**（`[class$="_xxx"]`），绝不写死哈希前缀；
  `_frame` 在 6 个包里都有，必须 `:has([class*="_centerCol"])` 限定；
  `navCell` 是 `clsx()` 拼类，只能包含匹配
- 所有规则挂在 `body.webrm-mobile` 下（style 标签常驻 head，不限定会改坏桌面端）
- 收起/展开必须**立刻**响应（盯 `data-sidebar-collapsed`），定时器只能当兜底
- **绝不给根节点加 `zoom`**（历史上有过 `@media(max-width:768px){html{zoom:80%}}`，已删）。
  它会把 `vw` 打坏：真机 `innerWidth=715`、官方判 fullscreen，而面板只有 `572 = 715×0.8`。
  官方在窄屏用 `width:100vw` 给右侧栏全屏 → 那条 zoom 让它永远铺不满；而且**只在
  `<=768px` 出现**，`>=768` 看着完全正常，排查成本极高。要放大请走官方字体设置。
  守卫 #39 ⑪ 会拦。同理，右侧栏那条规则里也**不许出现 `vw`**。
- 右侧栏是否全屏由**官方**决定：`autoFullscreen = innerWidth < 768`（`dsh-client-ui-sidebar-right`），
  全屏时给 `width:100vw`，非全屏走 `push`（部分宽度挂在 0 宽的列右边缘上）。我们用
  `[data-sidebar-right-panel="fullscreen"]` + `position:fixed;inset:0` 兜底。
- 排查这类问题**先加探针再改**：把 `innerWidth` / 面板模式 / 面板实际宽度与位置 /
  轨道的 `grid-template-columns` 一次报回来（`rightbarProbe` + `watchRightbar`）。
  这一轮就是靠它一眼看出 `572 = 715 × 0.8` 的。
