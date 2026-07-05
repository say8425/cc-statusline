# cc-statusline

[English](../README.md) | [한국어](README.ko.md) | 日本語 | [中文](README.zh.md) | [Español](README.es.md)

Claude Code用カスタムステータスライン。

[![Claude Code](https://img.shields.io/badge/Claude_Code-D97757?style=flat&logo=claude&logoColor=white)](https://code.claude.com/docs/en/statusline)
[![npm](https://img.shields.io/npm/v/%40say8425%2Fcc-statusline?logo=npm&logoColor=%23CC3534&color=%23CC3534)](https://www.npmjs.com/package/@say8425/cc-statusline)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-black?style=flat&logo=bun)](https://bun.sh)

## インストール

`~/.claude/settings.json`に以下を追加してください：

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline",
    "padding": 0
  }
}
```

## スクリーンショット

### Git diffのみ

![scenario1_diff_only](scenario1_diff_only.png)

### PRのみ

![scenario2_pr_only](scenario2_pr_only.png)

### Git diff + PR

![scenario3_diff_pr](scenario3_diff_pr.png)

### ワークツリー

![worktree_diff](worktree_diff.png)

### ワークツリー + 使用量メトリクス

![worktree_usage](worktree_usage.png)

### 使用量メトリクス

![使用量メトリクス付きステータスラインのスクリーンショット](usage_metrics.png)

## 機能

- **セッション時間**: 現在のセッション経過時間
- **コスト**: セッションコスト（USD）
- **コンテキスト**: トークン使用量とパーセンテージ（色分け表示）
- **Git Diff**: ファイル数、追加、削除
- **クリック可能な Diff ビューア**: `✏️` をクリックすると、ローカルの diff ビューア（Pierre `@pierre/diffs` + `@pierre/trees`）がブラウザで開きます — ファイルツリー、working-tree / vs-base モード、watch モード（自動更新）、ファイルの折りたたみ、diff 全体を対象としたアプリ内検索（`Cmd/Ctrl+F`、削除された行も含む）
- **PR URL**: クリック可能なOSC 8ハイパーリンク
- **ワークツリーサポート**: `cc --worktree`セッションで実際のプロジェクト名を表示
- **TrueColor**: しきい値に基づく動的カラー
- **リセット時刻**: 5時間使用量リセット時刻（HH:MM）
- **ブロック使用量**: 5時間使用率
- **週間リセットタイマー**: 7日使用量リセット時刻（MM/DD HH:MM）
- **週間使用量**: 7日使用率

## 絵文字ガイド

| 絵文字 | 説明                         |
| ------ | ---------------------------- |
| 📁     | プロジェクトフォルダ名       |
| 🌲     | ワークツリー名（ワークツリーセッションで表示） |
| 🌿     | 現在のGitブランチ            |
| ⏱️     | セッション経過時間           |
| 💰     | セッションコスト（USD）      |
| 🧠     | コンテキストウィンドウ使用量 |
| ⏳     | リセット時刻                 |
| 📊     | 5時間使用率 %                |
| ⏰     | 週間制限リセット時間         |
| 📅     | 7日使用率 %                  |
| ✏️     | コミットされていない変更（クリックで diff ビューアを開く）     |
| 📎     | Pull Requestリンク           |

## 使用量メトリクス

Claude Codeのstdin JSON入力から使用量情報を表示します。

### 動作方法

Claude CodeがJSON入力で`rate_limits`を渡します（CLI 2.1.80+）：

1. **5時間使用率** - 現在のビリングブロックの使用パーセンテージ（`rate_limits.five_hour.used_percentage`）
2. **7日使用率** - 週間使用パーセンテージ（`rate_limits.seven_day.used_percentage`）
3. **リセットタイマー** - 正確なリセット時刻（`rate_limits.five_hour.resets_at`）、`HH:MM`形式
4. **週間リセットタイマー** - 週間制限リセット時刻（`rate_limits.seven_day.resets_at`）、`MM/DD HH:MM`形式（例：`02/15 17:00`）

使用量メトリクスはstdin JSONに`rate_limits`が含まれている場合、**自動的に表示**されます。追加のフラグや設定は不要です。

> [!NOTE]
> `rate_limits`はClaude.aiサブスクライバー（Pro/Max）のみ、最初のAPIレスポンス後に提供されます。完全なJSONスキーマは[公式statuslineドキュメント](https://code.claude.com/docs/en/statusline)を参照してください。

## 依存関係

- [Bun](https://bun.sh) - JavaScriptランタイム
- [gh](https://cli.github.com) - GitHub CLI（オプション、PR URL用）

## カラーしきい値

| 指標             | 正常（白） | 警告（黄） | 危険（赤） |
| ---------------- | ---------- | ---------- | ---------- |
| コンテキスト %   | < 50%      | 50-80%     | > 80%      |
| ブロック使用量 % | < 50%      | 50-80%     | > 80%      |

## ライセンス

MIT
