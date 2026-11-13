---
title: 如何用「纯 Markdown + 本地 Studio」高效维护个人站点
summary: 支持标准 Markdown、> [!TIP] 提示框、Ctrl+V 截图粘贴与 Ctrl+K 全站命令搜索。
date: 2026-11-12
tags:
  - Markdown
  - 使用指南
related:
  - works/custom-site-engine
---

你不需要记住任何复杂前端语法，日常维护网站只有两种顺手方式：

## 方式一：打开浏览器 `/studio` 可视化操作

- **换皮肤、改颜色、调导航**：在「外观与导航」标签里直接点选。
- **拼装首页与页面**：在「页面编排」里像搭积木一样添加或上下移动区块。
- **写内容与贴图**：在「内容编辑」里左右分栏写 Markdown，截图后直接在编辑框按 `Ctrl + V`，图片会自动保存到 `content/assets/` 并插好链接。

> [!TIP]
> 提示框也完全使用 GitHub / Obsidian 通用语法（如 `> [!TIP]`、`> [!NOTE]`、`> [!WARNING]`），不需要学习自定义标签。

## 方式二：继续用你习惯的本地编辑器

如果你习惯 Obsidian 或 Typora，直接打开 `content/` 文件夹编辑对应的 `.md` 文件并保存，浏览器预览页会自动热更新刷新。
