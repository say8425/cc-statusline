# cc-statusline

[English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | 中文 | [Español](README.es.md)

Claude Code 自定义状态栏。

[![Claude Code](https://img.shields.io/badge/Claude_Code-D97757?style=flat&logo=claude&logoColor=white)](https://code.claude.com/docs/en/statusline)
[![npm](https://img.shields.io/npm/v/%40say8425%2Fcc-statusline?logo=npm&logoColor=%23CC3534&color=%23CC3534)](https://www.npmjs.com/package/@say8425/cc-statusline)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-black?style=flat&logo=bun)](https://bun.sh)

## 安装

将以下内容添加到 `~/.claude/settings.json`：

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline",
    "padding": 0
  }
}
```

## 截图

### 仅 Git diff

![scenario1_diff_only](scenario1_diff_only.png)

### 仅 PR

![scenario2_pr_only](scenario2_pr_only.png)

### Git diff + PR

![scenario3_diff_pr](scenario3_diff_pr.png)

### 工作树

![worktree_diff](worktree_diff.png)

### 工作树 + 使用量指标

![worktree_usage](worktree_usage.png)

### 使用量指标

![带有使用量指标的状态栏截图](usage_metrics.png)

## 功能

- **会话时间**: 当前会话经过时间
- **费用**: 会话费用（美元）
- **上下文**: 令牌使用量及百分比（颜色标识）
- **模型**: 当前使用的模型名称和 reasoning effort（例如 `Fable 5 high`，effort 仅在支持的模型上显示）
- **Git Diff**: 文件数、新增、删除
- **可点击的 Diff 查看器**：点击 `✏️` 即可在浏览器中打开本地 diff 查看器（Pierre `@pierre/diffs` + `@pierre/trees`）——文件树、working-tree / vs-base 模式、watch 模式（自动刷新）、文件折叠，以及对整个 diff 的应用内搜索（`Cmd/Ctrl+F`，包括已删除的行）
- **PR URL**: 可点击的 OSC 8 超链接
- **工作树支持**: 在 `cc --worktree` 会话中显示真实项目名称
- **TrueColor**: 基于阈值的动态颜色
- **重置时间**: 5小时使用量重置时间（HH:MM）
- **块使用量**: 5小时使用率
- **每周重置计时器**: 7天使用量重置时间（MM/DD HH:MM）
- **周使用量**: 7天使用率

## 表情符号指南

| 表情 | 说明                |
| ---- | ------------------- |
| 📁   | 项目文件夹名        |
| 🌲   | 工作树名称（工作树会话中显示） |
| 🌿   | 当前 Git 分支       |
| ⏱️   | 会话经过时间        |
| 💰   | 会话费用（美元）    |
| 🧠   | 上下文窗口使用量    |
| 🤖   | 当前模型和 effort   |
| ⏳   | 重置时间            |
| 📊   | 5小时使用率 %       |
| ⏰   | 每周限制重置时间    |
| 📅   | 7天使用率 %         |
| ✏️   | 未提交的更改（点击打开 diff 查看器）        |
| 📎   | Pull Request 链接   |

## Diff 查看器

点击 statusline 中的 `✏️`，即可在浏览器中打开使用 Pierre 的 [`@pierre/diffs`](https://www.npmjs.com/package/@pierre/diffs) 组件渲染的本地 diff 查看器。

![diff_viewer](diff_viewer.png)

- **两种 diff 模式**：`Working tree`（对比 HEAD）和 `vs <base>`（与 PR 目标分支或默认分支的 merge-base 对比）。提交后入口依然保留为 `✏️ vs <base>`，点击即可以 base 模式打开查看器 — 审查过程中 diff 不会消失。

![diff_vs_base](diff_vs_base.png)

- **图片 diff**：变更的二进制图片（png/jpg/gif/webp/avif/bmp/ico）按与文件树相同的顺序内联显示在 diff 流中 — 棋盘格背景的 Old/New 并排面板，可像其他文件一样折叠

![image_diff](image_diff.png)
- **Unified / Split** 视图切换
- **Watch 模式**：检测到变更后自动刷新（约2秒轮询），并保持滚动位置
- **文件树**：左/右布局与 flatten（折叠空目录）切换
- **文件折叠**：点击文件头部展开/折叠；锁文件和变更行数超过 1,500 行的文件默认折叠
- **应用内搜索**（`Cmd/Ctrl+F`）：搜索包括已删除行在内的完整 diff，支持匹配跳转和高亮
- **复制路径**：悬停文件头部即可复制文件的相对路径
- **包含未跟踪文件** 开关

### 工作原理（Diff 查看器）

当仓库有可展示的变更时，statusline 会按需在 `127.0.0.1:49573` 启动查看器服务。请求受令牌保护，且仅绑定到 localhost。

| 环境变量 | 效果 |
| -------- | ---- |
| `CC_STATUSLINE_DIFF_PORT` | 修改端口（默认: `49573`） |
| `CC_STATUSLINE_DIFF_DISABLE=1` | 完全禁用 diff 查看器 |

> [!TIP]
> 请通过 `✏️` 链接打开查看器，而不是使用书签 — 链接始终携带最新令牌，并确保服务已启动。

## 使用量指标

显示来自 Claude Code stdin JSON 输入的使用量信息。

### 工作原理

Claude Code 通过 stdin JSON 输入传递 `rate_limits`（CLI 2.1.80+）：

1. **5小时使用率** - 当前计费块的使用百分比（`rate_limits.five_hour.used_percentage`）
2. **7天使用率** - 周使用百分比（`rate_limits.seven_day.used_percentage`）
3. **重置计时器** - 精确重置时间（`rate_limits.five_hour.resets_at`），`HH:MM` 格式
4. **每周重置计时器** - 周限制重置时间（`rate_limits.seven_day.resets_at`），`MM/DD HH:MM` 格式（如 `02/15 17:00`）

当 stdin JSON 中包含 `rate_limits` 时，使用量指标会**自动显示**。无需额外标志或配置。

> [!NOTE]
> `rate_limits` 仅在 Claude.ai 订阅用户（Pro/Max）首次 API 响应后提供。完整 JSON schema 请参阅[官方 statusline 文档](https://code.claude.com/docs/en/statusline)。

## 依赖项

- [Bun](https://bun.sh) - JavaScript 运行时
- [gh](https://cli.github.com) - GitHub CLI（可选，用于 PR URL）

## 颜色阈值

| 指标       | 正常（白色） | 警告（黄色） | 危险（红色） |
| ---------- | ------------ | ------------ | ------------ |
| 上下文 %   | < 50%        | 50-80%       | > 80%        |
| 块使用量 % | < 50%        | 50-80%       | > 80%        |

## 许可证

MIT
