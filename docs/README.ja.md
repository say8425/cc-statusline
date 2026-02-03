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

## CLIオプション

| オプション | 説明 |
|------------|------|
| [`--plan <plan>`](#プラン選択) | サブスクリプションプランのトークン制限を設定 (pro, max5x, max20x) |
| [`--no-usage`](#無効化) | 使用量メトリクス行を非表示 |

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
- **ブロック使用量**: 5時間ブロックのトークン使用量とパーセンテージ
- **バーンレート**: 1分あたりのトークン消費率

## 絵文字ガイド

| 絵文字 | 説明                         |
| ------ | ---------------------------- |
| 📁     | プロジェクトフォルダ名       |
| 🌿     | 現在のGitブランチ            |
| ⏱️     | セッション経過時間           |
| 💰     | セッションコスト（USD）      |
| 🧠     | コンテキストウィンドウ使用量 |
| ⏳     | 制限リセットカウントダウン   |
| 📊     | 5時間ブロックトークン使用量  |
| 🔥     | トークンバーンレート（毎分） |
| ✏️     | コミットされていない変更     |
| 📎     | Pull Requestリンク           |

## 使用量メトリクス

5時間ビリングブロックの使用量情報を表示します。

### 動作方法

`~/.claude/projects/`のJSONLファイルを自動的にパースして検出：

1. **使用量制限エラーメッセージ** - "Claude AI usage limit reached"エラーから正確なリセット時刻を抽出
2. **5時間ビリングブロック** - 最新のアクティビティに基づいてブロック終了時刻を計算（[ccusage](https://github.com/ryoppippi/ccusage)方式）
3. **トークン使用量** - 現在の5時間ブロック内の入力と出力トークンを合計
4. **バーンレート** - 1分あたりの平均トークン消費量を計算

手動設定は不要です。

### プラン選択

Claude Codeのプランによってトークン制限が異なります。`--plan`フラグでプランを設定してください：

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --plan max5x",
    "padding": 0
  }
}
```

| プラン | トークン制限 | コマンド |
|--------|--------------|----------|
| Pro（デフォルト） | 450K | `--plan pro` または省略 |
| Max 5x | 2.25M | `--plan max5x` |
| Max 20x | 9M | `--plan max20x` |

### 無効化

使用量メトリクス行（リセットタイマー、ブロック使用量、バーンレート）を非表示にするには、`--no-usage`フラグを使用してください：

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --no-usage",
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
| ブロック使用量 % | < 50%    | 50-80%     | > 80%      |

## ライセンス

MIT
