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

### Context 正常 (< 50%)

![正常なコンテキスト使用量（50%未満）のステータスラインのスクリーンショット](context_normal.png)

### Context 警告 (50-80%)

![警告コンテキスト使用量（50%-80%）のステータスラインのスクリーンショット](context_warning.png)

### Context 危険 (> 80%)

![危険なコンテキスト使用量（80%超）のステータスラインのスクリーンショット](context_critical.png)

### 制限リセットタイマー

![制限リセットタイマー付きステータスラインのスクリーンショット](limit_reset.png)

## 機能

- **セッション時間**: 現在のセッション経過時間
- **コスト**: セッションコスト（USD）
- **コンテキスト**: トークン使用量とパーセンテージ（色分け表示）
- **Git Diff**: ファイル数、追加、削除
- **PR URL**: クリック可能なOSC 8ハイパーリンク
- **TrueColor**: しきい値に基づく動的カラー
- **制限リセットタイマー**: 使用量制限リセットまでの残り時間

## 絵文字ガイド

| 絵文字 | 説明                         |
| ------ | ---------------------------- |
| 📁     | プロジェクトフォルダ名       |
| 🌿     | 現在のGitブランチ            |
| ⏱️     | セッション経過時間           |
| 💰     | セッションコスト（USD）      |
| 🧠     | コンテキストウィンドウ使用量 |
| ✏️     | コミットされていない変更     |
| 📎     | Pull Requestリンク           |
| ⏳     | 制限リセットカウントダウン   |

## 制限リセットタイマー

Claude Codeの使用量制限リセットまでの残り時間を表示します。

### 設定

環境変数でリセット時刻を設定してください：

```bash
export CC_LIMIT_RESET_HOUR=9  # 午前9時（デフォルト）
```

### 無効化

制限リセットタイマーを非表示にするには、`--no-limit`フラグを使用してください：

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --no-limit",
    "padding": 0
  }
}
```

## 依存関係

- [Bun](https://bun.sh) - JavaScriptランタイム
- [gh](https://cli.github.com) - GitHub CLI（オプション、PR URL用）

## カラーしきい値

| 指標           | 正常（白） | 警告（黄） | 危険（赤） |
| -------------- | ---------- | ---------- | ---------- |
| コンテキスト % | < 50%      | 50-80%     | > 80%      |

## ライセンス

MIT
