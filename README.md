# 自研轻量级静态站点引擎 + 页内就地可视化编辑

零前端框架运行时（无 Astro / React / Tailwind 编译链路），**纯 Markdown + JSON 内容驱动**。本地访问真实网页时，点击底部悬浮按钮「✏️ 编辑此页」（或 `Ctrl+E`）即可**直接在当前网页上自由编辑文字、卡片、拖拽模块、写作 Markdown 并实时调整外观**；打包产物 `dist/` 为 100% 纯静态 HTML/CSS。

## 核心特点

- **不绑定固定场景**：支持自由新建任意栏目（作品、笔记、书单、实验日志等），支持网格 / 列表 / 时间轴三种展示视图与自定义前端属性。
- **真正的页内就地可视化编辑**：无需跳转到独立后台或包一层 iframe——打开 `http://127.0.0.1:4321/` 后点击「✏️ 编辑此页」，页面本身直接变成可编辑画布：点击文字直接修改、拖拽排序模块、随时插入/复制/隐藏/删除模块与卡片、双击正文原地展开双栏同步滚动 Markdown 编辑器（支持 `Ctrl+V` 贴图）、滑出左侧目录与右侧外观导航抽屉；再次点击「👁 预览模式」立即回到纯粹阅读视角。
- **双模式互通**：既可以在网页上直接就地可视化编辑，也可以继续用 Obsidian / Typora / VS Code 直接修改 `content/` 下的 `.md` 和 `.json` 文件（本地实时热更新）。
- **高性能纯静态部署**：打包时完全剔除编辑器代码，`dist/` 可零成本托管至 Cloudflare Pages / Vercel / GitHub Pages。

## 目录结构

```text
/
├── content/                 # 所有站点内容与配置（纯文本 + 图片）
│   ├── site.json            # 全站外观、主题、导航、社交链接
│   ├── pages/               # 自由页面（支持 .json 积木页与 .md 单页）
│   ├── collections/         # 自由合集（每个子目录即一个自定义栏目）
│   └── assets/              # 图片资源
├── engine/                  # 自研引擎（store / markdown / theme / renderer / builder / studio）
├── preview.ps1              # 一键前台预览与 Studio 启动脚本（关窗即停）
└── dist/                    # 纯静态打包输出目录
```

## 常用命令

| 命令 | 说明 |
| :--- | :--- |
| `pnpm install` | 安装极简依赖（`marked`、`highlight.js`、`gray-matter`） |
| `pnpm dev` | 启动本地站点预览与页内就地编辑（`http://127.0.0.1:4321/`） |
| `pnpm build` | 生成纯静态站点到 `./dist/` |
| `pnpm preview` | 本地预览 `./dist/` 静态打包结果 |

或者直接右键运行 `preview.ps1`（「使用 PowerShell 运行」），关掉窗口即停。
