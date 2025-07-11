# 🤖 AI法務相談ツール

日本の法令データベースとGemini AIを活用した次世代法務支援システム

![Legal AI Consultation](https://img.shields.io/badge/Legal%20AI-Consultation-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Gemini AI](https://img.shields.io/badge/Gemini-AI-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

日本政府のe-Gov法令APIとGoogle Gemini AIを組み合わせて、実用的な法的アドバイスを提供する革新的なWebアプリケーションです。ヒアリング式の段階的質問システムと高度なナレッジグラフ可視化により、複雑な法的問題を分かりやすく解決します。

## ✨ 主要機能

### 🎯 **ヒアリング式法務相談**
- **段階的質問システム**: AIが適切な質問を生成し、段階的に問題を深掘り
- **カテゴリ別対応**: 労働、企業法務、契約、個人情報保護、知的財産、刑事、民事
- **AI質問生成**: Gemini AIによる文脈に応じた質問の自動生成
- **質問編集機能**: AIが生成した質問を編集・カスタマイズ可能
- **リアルタイム待機画面**: AI処理中の進行状況を可視化

### 💬 **直接入力法務相談**
- **自由形式入力**: 複雑な法的問題を直接記述
- **AI拡張クエリ**: 質問内容をAIが法的観点から拡張・精緻化
- **実時間検索**: e-Gov APIによるリアルタイム法令検索
- **参照法令明示**: 回答で実際に参照した法令を明確に表示

### 📊 **ナレッジグラフ可視化**
- **法令関係性の可視化**: D3.jsによる動的で美しいグラフ表示
- **最大15法令対応**: 日本の主要法令体系を網羅的に表示
- **インタラクティブ操作**: ズーム、ドラッグ、クリックでe-Gov法令サイトへ直接アクセス
- **関係性解析**: 法令間の参照、改正、補完関係を色分け表示
- **全法令データベース対応**: e-Gov APIの全法令を対象とした豊富なグラフ

### 🔧 **プロンプト管理システム**
- **カスタマイズ可能なプロンプト**: 法務相談、契約レビュー、法令解釈用プロンプトの編集
- **プレビュー機能**: 変更前にプロンプトの効果を確認
- **エクスポート/インポート**: プロンプト設定のバックアップと復元

### 🎨 **ユーザーエクスペリエンス**
- **1024px最適化レイアウト**: 美しく使いやすいインターフェース
- **レスポンシブデザイン**: デスクトップ、タブレット対応

## 🚀 技術スタック

### **バックエンド**
- **Node.js 18+**: 高性能なサーバーサイド実装
- **Express.js**: 軽量で高速なWebアプリケーションフレームワーク
- **Google Gemini AI API**: 最新の生成AI技術
- **e-Gov法令API**: 日本政府公式法令データベース（v2/v1対応）

### **フロントエンド**
- **Vanilla JavaScript**: 軽量で高速なクライアントサイド実装
- **D3.js**: データ駆動型ビジュアライゼーション
- **Bootstrap 5**: モダンなUIコンポーネント
- **Font Awesome**: 豊富なアイコンライブラリ

### **データ処理**
- **法令検索エンジン**: API v2/v1フォールバック機能
- **関係性抽出アルゴリズム**: 法令間の複雑な関係を自動解析
- **ナレッジグラフ構築**: 動的なグラフデータ構造生成

## 📋 対応法令

### **主要法令カテゴリ**
- **労働・雇用**: 労働基準法、労働組合法、労働安全衛生法
- **企業法務**: 会社法、商法、民法
- **契約・取引**: 民法（契約編）、消費者契約法
- **個人情報保護**: 個人情報保護法、憲法
- **刑事・犯罪**: 刑法、刑事訴訟法
- **行政・規制**: 各種業法、行政手続法

### **データソース**
- **e-Gov法令API**: 日本政府公式法令データベース
- **リアルタイム更新**: 最新の法改正に自動対応
- **全法令対応**: 憲法、法律、政令、省令を包括的にカバー

## 📋 システム要件

### **必須要件**
- Node.js 18.0以上
- npm 8.0以上
- Google Gemini API キー

### **推奨環境**
- メモリ: 4GB以上
- ストレージ: 1GB以上の空き容量
- ネットワーク: インターネット接続（e-Gov API、Gemini API用）

## 🛠️ インストール手順

### 1. リポジトリのクローン
```bash
git clone https://github.com/your-repo/ai-houmu-soudan.git
cd ai-houmu-soudan
```

### 2. 依存関係のインストール
```bash
npm install
```

### 3. 環境変数の設定
`.env.example`をコピーして`.env`を作成：
```bash
cp .env.example .env
```

`.env`ファイルを編集：
```env
# Gemini AI API設定（必須）
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# サーバー設定
PORT=3000
NODE_ENV=development

# オプション設定
ENABLE_DEBUG_LOGS=true
```

### 4. Gemini APIキーの取得
1. [Google AI Studio](https://makersuite.google.com/app/apikey)にアクセス
2. Googleアカウントでログイン
3. "Create API Key"をクリック
4. 生成されたAPIキーを`.env`ファイルに設定

### 5. アプリケーションの起動
```bash
npm start
```

### 6. アクセス
- **メインアプリケーション**: http://localhost:3000
- **プロンプトチューニング**: http://localhost:3000/prompt-tuning.html

## 🎮 使用方法

### **基本的な使い方**

1. **ブラウザでアクセス**: `http://localhost:3000`
2. **相談方法を選択**:
   - **ヒアリング形式**: AIが段階的に質問（推奨）
   - **直接入力**: 自由形式で質問を記述

### **ヒアリング形式の使用方法**

1. **「ヒアリングを開始する」**をクリック
2. **カテゴリ選択**: 相談内容の分野を選択
3. **段階的回答**: AIからの質問に順次回答
4. **詳細入力**: 最終的に具体的な状況を詳しく記述
5. **AI相談実行**: 生成された質問文を確認・編集して実行

### **直接入力の使用方法**

1. **「直接入力」タブ**をクリック
2. **質問入力**: 法的問題を具体的に記述
3. **「相談する」**をクリック
4. **結果確認**: AI回答とナレッジグラフを確認

### **ナレッジグラフの操作**

- **ズーム**: マウスホイールでズームイン/アウト
- **ドラッグ**: ノードをドラッグして配置調整
- **クリック**: 法令ノードをクリックしてe-Gov法令サイトへアクセス
- **ホバー**: ノードにカーソルを合わせて詳細情報を表示

## 🔧 高度な設定

### **プロンプトカスタマイズ**
1. `http://localhost:3000/prompt-tuning.html`にアクセス
2. 用途別プロンプトを編集
3. プレビューで効果を確認
4. 設定を保存

## 🐛 トラブルシューティング

### **よくある問題**

#### 1. Gemini APIエラー
```
Error: Gemini API key not configured
```
**解決方法**: `.env`ファイルに正しいAPIキーを設定

#### 2. e-Gov API接続エラー
```
API v2 検索エラー: Request failed with status code 404
```
**解決方法**: 自動的にAPI v1にフォールバック（正常動作）

#### 3. ナレッジグラフが表示されない
**解決方法**: 
- ブラウザのコンソールでJavaScriptエラーを確認
- D3.jsライブラリの読み込み状況を確認

#### 4. ポート競合エラー
```
Error: listen EADDRINUSE: address already in use :::3000
```
**解決方法**: 
```bash
# 他のプロセスを終了
npx kill-port 3000

# または別のポートを使用
PORT=3001 npm start
```

## 🚨 重要な注意事項

### **法的責任の制限**
- このツールは**参考情報の提供のみ**を目的としています
- **正式な法的判断には専門弁護士への相談が必要**です
- 生成される回答は一般的な情報であり、個別案件への法的アドバイスではありません

### **セキュリティ**
- APIキーは外部に漏洩しないよう適切に管理してください
- 機密性の高い情報の入力は避けてください
- 本番環境では追加のセキュリティ対策を実装してください

### **データプライバシー**
- 入力された相談内容はGemini APIに送信されます
- 個人情報や機密情報の入力は控えてください

