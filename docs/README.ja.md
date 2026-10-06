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
- **コスト**: セッションコスト（USD） — デフォルトでは非表示、`CC_STATUSLINE_SHOW_COST=1` で表示（[設定](#設定)を参照）
- **コンテキスト**: トークン使用量とパーセンテージ（色分け表示）
- **モデル**: 現在使用中のモデル名と reasoning effort（例: `Fable 5 high`）、ultracode セッションでは `⚡ultra` バッジを表示
- **Git Diff**: ファイル数、追加、削除
- **クリック可能な Diff ビューア**: `✏️` をクリックすると、ローカルの diff ビューアがブラウザで開きます（[Diff ビューア](#diff-ビューア)を参照）
- **PR URL**: クリック可能なOSC 8ハイパーリンク
- **ワークツリーサポート**: `cc --worktree`セッションで実際のプロジェクト名を表示
- **TrueColor**: しきい値に基づく動的カラー
- **リセット時刻**: 5時間使用量リセット時刻（HH:MM）
- **ブロック使用量**: 5時間使用率
- **週間リセットタイマー**: 7日使用量リセット時刻（MM/DD(金) HH:MM — 曜日名はロケールに従う）
- **週間使用量**: 7日使用率
- **セッション名**: このセッションのメンションアドレスを `@"名前"` の形で表示 — 他の Claude セッションに貼り付けて、このセッションにメッセージを送れます

## 絵文字ガイド

| 絵文字 | 説明                         |
| ------ | ---------------------------- |
| 📁     | プロジェクトフォルダ名（クリックでファイルマネージャーを開く） |
| 🌲     | ワークツリー名（クリックでワークツリーフォルダを開く） |
| 🌿     | 現在のGitブランチ            |
| ⏱️     | セッション経過時間           |
| 💰     | セッションコスト（USD） — デフォルトでは非表示（[設定](#設定)を参照） |
| 🧠     | コンテキストウィンドウ使用量 |
| 🤖     | 現在のモデルと effort        |
| `@`   | セッション名 — メンションアドレス |
| ⏳     | リセット時刻                 |
| 📊     | 5時間使用率 %                |
| ⏰     | 週間制限リセット時間         |
| 📅     | 7日使用率 %                  |
| ✏️     | コミットされていない変更（クリックで diff ビューアを開く）     |
| 📎     | Pull Requestリンク — 角括弧で状態を表示（`[Open]`/`[Draft]`/`[Merged]`/`[Closed]`）、チェックが存在する場合は括弧内に CI サマリー（`(N passed)`/`(N running)`/`(N failed)`）も表示 |

## 設定

デフォルトの動作は Claude Code が stdin で渡す JSON だけで完結するため、設定は不要です。以下の環境変数で表示内容を調整できます:

| 環境変数 | 効果 |
| -------- | ---- |
| `CC_STATUSLINE_SHOW_COST=1` | `💰` セッションコストのセグメントを表示（デフォルト: 非表示） |
| `CC_STATUSLINE_DIFF_PORT` | diff ビューアのポートを変更（デフォルト: `49573`） |
| `CC_STATUSLINE_DIFF_DISABLE=1` | diff ビューアを完全に無効化 |

statusline コマンドが実行される場所で指定します — 例えば `~/.claude/settings.json` で:

```json
{
  "statusLine": {
    "type": "command",
    "command": "CC_STATUSLINE_SHOW_COST=1 bunx @say8425/cc-statusline",
    "padding": 0
  }
}
```

## Diff ビューア

statusline の `✏️` をクリックすると、ローカル diff ビューアがブラウザで開きます。ビューア自体は [diffdeck](https://github.com/say8425/diffdeck)（npm の [`@say8425/diffdeck`](https://www.npmjs.com/package/@say8425/diffdeck)）が提供し、cc-statusline のランタイム依存関係として自動インストールされます — statusline がこれをバックグラウンドデーモンとして起動し、`✏️` エントリポイントからリンクします。

![diff_viewer](diff_viewer.png)

- **2つの diff モード**: `Working tree`（HEAD 比較）と `vs <base>`（PR ターゲットまたはデフォルトブランチとの merge-base 比較）。コミット後もエントリポイントは `✏️ vs <base>` として維持され、クリックするとビューアが base モードで開きます — レビュー中に diff が消えることはありません。

![diff_vs_base](diff_vs_base.png)

- **画像 diff**: 変更されたバイナリ画像（png/jpg/gif/webp/avif/bmp/ico）がファイルツリーと同じ順序で diff の流れにインライン表示 — チェッカーボード背景の Old/New パネル、他のファイルと同様に折りたたみ可能

![image_diff](image_diff.png)
- **Unified / Split** ビュー切り替え
- **Watch モード**: スクロール位置を保持したまま変更を検知して自動更新（約2秒ポーリング）
- **ファイルツリー**: 左右配置、ドラッグで幅を調整、flatten（空ディレクトリの折りたたみ）、サイドバー非表示の切り替え
- **ファイル折りたたみ**: ファイルヘッダーをクリックして開閉。ロックファイルと変更行数が1,500行を超えるファイルは最初から折りたたまれます
- **アプリ内検索**（`Cmd/Ctrl+F`）: 削除行を含む diff 全体を検索、マッチ移動とハイライト
- **パスのコピー**: ファイルヘッダーにホバーすると相対パスのコピーボタンを表示
- **diff-grab**: diff でコードを選択し（テキストのドラッグは文字単位、ガターの `+` ボタンは行単位）、プロンプトを入力して Enter — ファイルパス・行範囲・コードスニペットとプロンプトがクリップボードにコピーされ、Claude Code のようなエージェントにそのまま貼り付けられます
- **未追跡ファイルを含める** トグル

## 動作方法

statusline に表示される情報の大半は、Claude Code が stdin で渡す JSON から来ます — 完全なスキーマは[公式 statusline ドキュメント](https://code.claude.com/docs/en/statusline)を参照してください。stdin にないいくつかの値は、以下のようにローカルから直接読み取ります。

### 使用量メトリクス

Claude Code が stdin JSON で `rate_limits` を渡します（CLI 2.1.80+）。この値があれば使用量の行が自動的に表示され、追加のフラグや設定は不要です：

1. **5時間使用率** - 現在のビリングブロックの使用パーセンテージ（`rate_limits.five_hour.used_percentage`）
2. **7日使用率** - 週間使用パーセンテージ（`rate_limits.seven_day.used_percentage`）
3. **リセットタイマー** - 正確なリセット時刻（`rate_limits.five_hour.resets_at`）、`HH:MM`形式
4. **週間リセットタイマー** - 週間制限リセット時刻（`rate_limits.seven_day.resets_at`）、`MM/DD(曜日) HH:MM`形式。曜日名は `LC_ALL` / `LC_TIME` / `LANG` で決まるロケール準拠（例：`ja_JP.UTF-8` → `02/15(木) 17:00`、`en_US.UTF-8` → `02/15(Thu) 17:00`）。3つとも使える値でなければ（未設定・空、または「ローカライズしない」を意味する `C`/`POSIX`）ランタイム既定のロケール（現行の Bun では `en-US`）にフォールバック — macOS のターミナルは「Set locale environment variables on startup」が無効だと `LANG` が空のまま

> [!NOTE]
> `rate_limits`はClaude.aiサブスクライバー（Pro/Max）のみ、最初のAPIレスポンス後に提供されます。

### モデルと ultracode

モデル名と effort は `model.display_name` と `effort.level` から取得します（effort は対応モデルのみ送られます）。ultracode は stdin に含まれないため、Claude Code 設定ファイル（managed → プロジェクト local → プロジェクト → ユーザーの順）の `ultracode` キーを読み、セッションの effort が `xhigh` の場合のみ `⚡ultra` を表示します。

### セッション名

セッション名は、他の Claude セッションがこのセッションにメッセージを送るときに使うアドレスです — `/rename`・`claude -n` で付けた名前、なければ `my-app-3f` のようなデフォルト表示名。stdin の `session_name` では代用できません：名前のないセッションでは AI 生成のタイトル（メンションアドレスではない）を持ち、デフォルト表示名はまったく含まないためです。そのため Claude Code のローカルセッションレジストリ（`<CLAUDE_CONFIG_DIR または ~/.claude>/sessions`）から `session_id` が一致するエントリを読み取ります。スペースや非 ASCII 文字を含む名前もそのままメンションに貼り付けられるよう常に引用符で囲み、レジストリに該当セッションがなければ非表示にします。`rate_limits` とは無関係に表示されます。

### Diff ビューア

リポジトリに表示すべき変更があると、statusline が diffdeck を `127.0.0.1:49573` にバックグラウンドデーモンとして必要に応じて起動します。リクエストはトークンで保護され、localhost のみにバインドされます。

これを制御する `CC_STATUSLINE_DIFF_*` 環境変数 2 つは[設定](#設定)の表にまとめてあります。

> [!TIP]
> ブックマークではなく `✏️` リンクからビューアを開いてください — リンクには常に最新のトークンが含まれ、サーバーの起動も保証されます。

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
