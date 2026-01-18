# VOICEVOX Editor - 拡張辞書機能ドキュメント

## 目次

- [概要](#概要)
- [機能一覧](#機能一覧)
- [セットアップ手順](#セットアップ手順)
- [バックエンド連携](#バックエンド連携)
- [追加・変更したファイル一覧](#追加変更したファイル一覧)
- [使い方](#使い方)
- [アーキテクチャ](#アーキテクチャ)
- [トラブルシューティング](#トラブルシューティング)

---

## 概要

VOICEVOX エディターのフォーク版に追加した拡張辞書機能は、通常の読み方・アクセント辞書に加えて、**モーラ別のピッチ（音高）と長さを細かく調整できる**高度な辞書機能です。

### 主な特徴

- **ビジュアルエディタ**: キャンバス上でピッチ曲線を直感的に編集
- **モーラ単位の調整**: 各モーラのピッチ（0.0〜10.0）と長さ（0.05〜0.5秒）を個別に設定
- **リアルタイムプレビュー**: 編集中の単語を即座に音声合成して確認
- **外部サーバー連携**: FastAPI バックエンドと連携してデータを永続化

---

## 機能一覧

### 1. 単語登録（ピッチ・長さ調整可能）

- 単語の追加、編集、削除
- 発音（カタカナ）の自動取得
- モーラ単位でのピッチと長さの詳細設定
- 話者ID（speaker_id）の指定（デフォルト: 1）

### 2. ピッチ曲線エディタ（キャンバス）

- インタラクティブなキャンバス UI
- マウスドラッグでピッチポイントを編集
- ベジェ曲線による滑らかな曲線表示
- グリッド・軸ラベル表示で視認性向上

### 3. モーラ別スライダー

- 各モーラに対して以下を調整:
  - **ピッチ**: 0.0〜10.0（0.1刻み）
  - **長さ**: 0.05〜0.5秒（0.01秒刻み）
- スライダー操作時にキャンバスも連動

### 4. リアルタイムプレビュー

- 編集中の単語を音声合成
- Web Audio API を使用した再生
- プレビュー中はボタンがローディング状態

---

## セットアップ手順

### 1. Node.js 24.11.0 のインストール

nvm を使用して Node.js 24.11.0 をインストールします。

```bash
# nvm のインストール（未インストールの場合）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# シェルの再起動、または以下を実行
source ~/.bashrc  # または ~/.zshrc

# Node.js 24.11.0 をインストール
nvm install 24.11.0
nvm use 24.11.0

# バージョン確認
node -v
# 出力: v24.11.0
```

### 2. pnpm のセットアップ

corepack を有効化して pnpm をセットアップします。

```bash
# corepack を有効化
corepack enable

# pnpm バージョン確認
pnpm -v
```

### 3. 依存関係のインストール

プロジェクトルートで以下を実行します。

```bash
# 依存パッケージをインストール
pnpm install
```

### 4. 開発サーバーの起動

ブラウザ版の開発サーバーを起動します。

```bash
# ブラウザ版開発サーバーを起動
pnpm browser:serve
```

起動後、ブラウザで `http://localhost:7173` にアクセスします。

---

## バックエンド連携

### 必要なバックエンドサーバー

拡張辞書機能を使用するには、FastAPI バックエンドサーバーが必要です。

- **サーバーURL**: `http://localhost:8000`
- **リポジトリ**: [voicevox-intonation-dict](https://github.com/yourusername/voicevox-intonation-dict)（実際のリポジトリURLに置き換えてください）

### バックエンドのセットアップ手順

```bash
# 別のターミナルウィンドウで実行
cd /path/to/voicevox-intonation-dict

# 仮想環境の作成（初回のみ）
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存パッケージのインストール
pip install -r requirements.txt

# サーバー起動
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### API エンドポイント

バックエンドは以下のエンドポイントを提供する必要があります。

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/v1/dictionary/` | 辞書一覧を取得 |
| POST | `/api/v1/dictionary/` | 辞書エントリを登録（upsert） |
| DELETE | `/api/v1/dictionary/{word}` | 辞書エントリを削除 |
| POST | `/api/v1/synthesize/debug` | デバッグ用合成（AudioQuery取得） |
| POST | `/api/v1/synthesize/preview` | プレビュー合成（WAV返却） |

---

## 追加・変更したファイル一覧

### 新規追加ファイル

| ファイルパス | 説明 |
|------------|------|
| `/Users/teradakousuke/Developer/voicevox-editor/src/infrastructures/extendedDictApi.ts` | 拡張辞書APIクライアント。FastAPIサーバーとの通信を担当 |
| `/Users/teradakousuke/Developer/voicevox-editor/src/components/Dialog/ExtendedDictionaryDialog.vue` | 拡張辞書ダイアログのメインコンポーネント（単語一覧・編集UI・キャンバス） |

### 変更したファイル

| ファイルパス | 変更内容 |
|------------|---------|
| `/Users/teradakousuke/Developer/voicevox-editor/src/store/type.ts` | DialogStates に `isExtendedDictionaryDialogOpen: boolean` を追加 |
| `/Users/teradakousuke/Developer/voicevox-editor/src/store/ui.ts` | 初期値に `isExtendedDictionaryDialogOpen: false` を追加 |
| `/Users/teradakousuke/Developer/voicevox-editor/src/components/Dialog/AllDialog.vue` | ExtendedDictionaryDialog を import し、ダイアログコンポーネントに追加 |
| `/Users/teradakousuke/Developer/voicevox-editor/src/components/Menu/MenuBar/useCommonMenuBarData.ts` | 設定メニューに「イントネーション辞書（拡張）」メニュー項目を追加（360-369行目） |

---

## 使い方

### ダイアログを開く

1. VOICEVOX Editor を起動
2. メニューバーから「設定」→「イントネーション辞書（拡張）」を選択
3. 拡張辞書ダイアログが全画面で開きます

### 新しい単語を追加する

1. 左側のリストで「追加」ボタンをクリック
2. 右側の編集エリアが表示されます
3. 以下を入力:
   - **単語**: 例 `ずんだもん`
   - **発音**: 「発音取得」ボタンで自動取得、または手動入力（例: `ズンダモン`）
4. 「発音取得」をクリックすると、サーバーからモーラ情報が取得され、ピッチ曲線エディタとスライダーが表示されます

### ピッチ曲線を編集する

#### キャンバスで編集

1. ピッチ曲線エディタ上の制御点（青い円）をマウスでドラッグ
2. 縦方向にドラッグしてピッチを調整（0.0〜10.0）
3. リアルタイムでグラフが更新されます

#### スライダーで編集

1. 各モーラカードの「ピッチ」スライダーを操作
2. 値の範囲: 0.0〜10.0（0.1刻み）
3. 「長さ」スライダーで発音時間を調整: 0.05〜0.5秒（0.01秒刻み）

### プレビュー再生

1. 「プレビュー再生」ボタンをクリック
2. 編集した設定で音声合成が実行され、ブラウザで再生されます
3. 再生中はボタンがローディング状態になります

### 保存する

1. 編集が完了したら「保存」ボタンをクリック
2. サーバーにデータが送信され、辞書に登録されます
3. 左側のリストに単語が追加されます

### 既存の単語を編集する

1. 左側のリストから編集したい単語をクリック
2. 右側に単語情報が読み込まれます
3. ピッチ・長さを編集後、「保存」をクリック

### 単語を削除する

1. 左側のリストで削除したい単語の「ゴミ箱」アイコンをクリック
2. 確認ダイアログで「OK」をクリック
3. サーバーから削除され、リストから消えます

---

## アーキテクチャ

### データフロー

```
[ExtendedDictionaryDialog.vue]
         ↓ ↑
         API呼び出し
         ↓ ↑
[extendedDictApi.ts]
         ↓ ↑
         HTTP (fetch)
         ↓ ↑
[FastAPI Backend]
   localhost:8000
         ↓ ↑
      [Database]
      辞書データ永続化
```

### コンポーネント構成

```
ExtendedDictionaryDialog.vue
├── 左側パネル
│   ├── 単語一覧（QList）
│   ├── 追加ボタン
│   └── 削除ボタン（各アイテム）
└── 右側パネル
    ├── 単語入力フィールド
    ├── 発音入力フィールド + 発音取得ボタン
    ├── ピッチ曲線エディタ（Canvas）
    ├── モーラ別スライダー（グリッド表示）
    ├── プレビュー再生ボタン
    └── 保存・キャンセルボタン
```

### データモデル

#### ExtendedDictEntry

```typescript
{
  word: string;              // 単語（例: "ずんだもん"）
  pronunciation: string;     // 発音（例: "ズンダモン"）
  accent_type: number;       // アクセント型（0 = なし）
  mora_count: number;        // モーラ数（自動計算）
  pitch_values: number[];    // ピッチ配列 [5.2, 4.8, 6.0, ...]
  length_values: number[];   // 長さ配列 [0.15, 0.12, 0.18, ...]
  speaker_id?: number;       // 話者ID（デフォルト: 1）
}
```

#### MoraForDict

```typescript
{
  text: string;              // モーラテキスト（例: "ン"）
  consonant?: string;        // 子音（例: "n"）
  consonant_length?: number; // 子音長さ
  vowel: string;             // 母音（例: "a"）
  vowel_length: number;      // 母音長さ
  pitch: number;             // ピッチ
}
```

### ピッチ曲線エディタの仕組み

1. **Canvas要素**: 200px高さ、幅は `max(400, モーラ数 × 80)`
2. **グリッド描画**: Y軸 0〜10 の目盛り線
3. **制御点**: 各モーラのピッチを表す青い円（半径8px）
4. **曲線**: ベジェ曲線で滑らかに接続
5. **インタラクション**:
   - `mousedown`: ドラッグ開始（制御点の12px以内をクリック判定）
   - `mousemove`: ピッチ値を更新
   - `mouseup` / `mouseleave`: ドラッグ終了

---

## トラブルシューティング

### 問題: ダイアログが開かない

**原因**: メニュー登録が正しくない可能性があります。

**解決策**:
1. `src/components/Menu/MenuBar/useCommonMenuBarData.ts` の 360〜369行目を確認
2. ブラウザの開発者ツールでコンソールエラーを確認
3. `pnpm browser:serve` を再起動

### 問題: 「発音取得」で失敗する

**原因**: バックエンドサーバーが起動していない、またはポート8000が塞がれています。

**解決策**:
1. バックエンドサーバーが起動しているか確認:
   ```bash
   curl http://localhost:8000/api/v1/dictionary/
   ```
2. レスポンスが返ってくるか確認
3. サーバーが起動していない場合は起動:
   ```bash
   cd /path/to/voicevox-intonation-dict
   uvicorn main:app --reload --port 8000
   ```

### 問題: プレビュー再生ができない

**原因**:
- バックエンドが WAV データを返していない
- ブラウザの自動再生ポリシーに引っかかっている

**解決策**:
1. 開発者ツールのネットワークタブで `/api/v1/synthesize/preview` のレスポンスを確認
2. `Content-Type: audio/wav` が返ってきているか確認
3. ブラウザで音声再生を許可（初回クリック後に再生されることを確認）

### 問題: CORS エラーが発生する

**原因**: バックエンドサーバーが CORS を許可していません。

**解決策**:
バックエンドの FastAPI アプリケーションに CORS ミドルウェアを追加:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:7173"],  # フロントエンドのURL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 問題: 単語一覧が空

**原因**: 辞書データが存在しない、またはAPI呼び出しが失敗しています。

**解決策**:
1. ブラウザの開発者ツールでネットワークタブを確認
2. `/api/v1/dictionary/` のレスポンスを確認
3. サンプルデータを手動で追加してテスト

### 問題: モーラ分割がおかしい

**原因**: `splitIntoMoras` 関数の実装が簡易的なため、一部のカタカナ表記に対応していません。

**解決策**:
- 発音を正確なカタカナで入力（例: `ズンダモン` ではなく `ズンダモン`）
- 必要に応じて `splitIntoMoras` 関数を改良（行552-566）

---

## まとめ

拡張辞書機能により、VOICEVOX Editor でより細かい音声調整が可能になりました。この機能を活用することで、キャラクターの個性をより豊かに表現できます。

### 今後の拡張案

- アクセント型の自動推定
- バッチインポート機能（CSVから一括登録）
- 複数話者の同時管理
- ピッチパターンのプリセット保存
- エクスポート機能（辞書データのバックアップ）

---

## 関連ファイルパス一覧

### 新規作成

- `/Users/teradakousuke/Developer/voicevox-editor/src/infrastructures/extendedDictApi.ts`
- `/Users/teradakousuke/Developer/voicevox-editor/src/components/Dialog/ExtendedDictionaryDialog.vue`

### 変更

- `/Users/teradakousuke/Developer/voicevox-editor/src/store/type.ts`
- `/Users/teradakousuke/Developer/voicevox-editor/src/store/ui.ts`
- `/Users/teradakousuke/Developer/voicevox-editor/src/components/Dialog/AllDialog.vue`
- `/Users/teradakousuke/Developer/voicevox-editor/src/components/Menu/MenuBar/useCommonMenuBarData.ts`

---

**ドキュメントバージョン**: 1.0
**最終更新日**: 2026-01-17
