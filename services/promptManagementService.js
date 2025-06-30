const fs = require('fs').promises;
const path = require('path');

class PromptManagementService {
  constructor() {
    this.promptsFilePath = path.join(__dirname, '../data/prompts.json');
    this.defaultPrompts = {
      legalConsultation: {
        id: 'legalConsultation',
        name: '法務相談',
        description: 'Gemini-Proによる法務相談用のプロンプト',
        template: `あなたは日本の法律に詳しい法務アドバイザーです。以下の質問に対して、正確で実用的な法的アドバイスを提供してください。

【重要な注意事項】
- 具体的な法的判断が必要な場合は専門弁護士への相談を推奨すること
- 一般的な法律知識と原則に基づいて回答すること
- 断定的な表現は避け、「一般的に」「原則として」などの表現を使用すること

【質問】
{question}

{keywords_section}

{relevant_laws_section}

【回答形式】
以下の構造で回答してください：

■ 法的な論点
（質問に含まれる主要な法的問題点を整理）

■ 適用される法律・原則
（関連する法律や法的原則の説明）

■ 一般的な考え方・判断基準
（通常どのような基準で判断されるかの説明）

■ 推奨される対応
（具体的にどのような行動を取るべきかのアドバイス）

■ 注意事項
（リスクや留意点）

■ 専門家相談の必要性
（弁護士相談が必要な場合の判断基準）

回答は日本語で、わかりやすく丁寧に説明してください。法律用語を使用する場合は、可能な限り一般的な言葉での解説も併記してください。`,
        variables: [
          { name: 'question', description: '相談者の質問', required: true },
          { name: 'keywords_section', description: '抽出されたキーワード（自動生成）', required: false },
          { name: 'relevant_laws_section', description: '関連法令（自動生成）', required: false }
        ],
        category: 'consultation',
        lastModified: new Date().toISOString()
      },

      contractReview: {
        id: 'contractReview',
        name: '契約書レビュー',
        description: '契約書の法的リスクと改善点を分析するプロンプト',
        template: `あなたは契約書レビューの専門家です。以下の契約書について、法的リスクや改善点を指摘してください。

【契約書内容】
{contract_text}

{review_points_section}

【レビュー観点】
- 法的リスクの指摘
- 曖昧な表現の特定
- 不利な条項の警告
- 追加すべき条項の提案
- 全体的な評価とアドバイス

【回答形式】
## 🔍 契約書レビュー結果

### ⚠️ 検出された法的リスク
（具体的なリスク項目を列挙）

### 📝 曖昧な表現・改善が必要な条項
（問題のある条項と改善案）

### ✅ 追加推奨条項
（契約に追加すべき条項の提案）

### 📊 総合評価
（契約書全体の評価とリスクレベル）

### 💡 具体的な改善提案
（実践的な修正アドバイス）

※このレビューは一般的な観点からの参考情報です。正式な契約前には必ず専門弁護士の確認を受けてください。`,
        variables: [
          { name: 'contract_text', description: '契約書の内容', required: true },
          { name: 'review_points_section', description: '特に注意すべきポイント（任意）', required: false }
        ],
        category: 'contract',
        lastModified: new Date().toISOString()
      },

      lawInterpretation: {
        id: 'lawInterpretation',
        name: '法令解釈',
        description: '複雑な法令条文を分かりやすく解釈するプロンプト',
        template: `あなたは日本の法律解釈の専門家です。以下の法令内容について、具体的な質問に答えてください。

【法令内容】
{law_content}

【質問】
{specific_question}

【回答要求】
以下の構造で分かりやすく説明してください：

## 📖 条文の基本的な意味
（法令条文の基本的な内容を平易な言葉で説明）

## 🎯 実際の適用場面
（この法令がどのような場面で適用されるか）

## ⚠️ 注意すべきポイント
（解釈や適用時に注意が必要な点）

## 📚 類似ケース・判例
（参考となる一般的な考え方や類似事例）

## 💼 実務での活用方法
（実際にどのように活用すべきか）

専門用語には一般的な説明を併記し、実践的で理解しやすい回答をしてください。`,
        variables: [
          { name: 'law_content', description: '解釈対象の法令条文', required: true },
          { name: 'specific_question', description: '具体的な質問内容', required: true }
        ],
        category: 'interpretation',
        lastModified: new Date().toISOString()
      }
    };
    
    this.ensureDataDirectory();
  }

  // データディレクトリの確保
  async ensureDataDirectory() {
    const dataDir = path.dirname(this.promptsFilePath);
    try {
      await fs.access(dataDir);
    } catch (error) {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  // プロンプト設定の読み込み
  async loadPrompts() {
    try {
      const data = await fs.readFile(this.promptsFilePath, 'utf-8');
      const prompts = JSON.parse(data);
      
      // デフォルトプロンプトとマージ（新しいデフォルトプロンプトを追加するため）
      const mergedPrompts = { ...this.defaultPrompts };
      Object.keys(prompts).forEach(key => {
        if (prompts[key]) {
          mergedPrompts[key] = prompts[key];
        }
      });
      
      return mergedPrompts;
    } catch (error) {
      // ファイルが存在しない場合はデフォルトプロンプトを返す
      console.log('プロンプト設定ファイルが見つかりません。デフォルト設定を使用します。');
      return this.defaultPrompts;
    }
  }

  // プロンプト設定の保存
  async savePrompts(prompts) {
    try {
      await this.ensureDataDirectory();
      await fs.writeFile(this.promptsFilePath, JSON.stringify(prompts, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('プロンプト設定の保存に失敗:', error);
      throw new Error(`プロンプト設定の保存に失敗しました: ${error.message}`);
    }
  }

  // 特定のプロンプトを取得
  async getPrompt(promptId) {
    const prompts = await this.loadPrompts();
    return prompts[promptId] || null;
  }

  // プロンプトを更新
  async updatePrompt(promptId, updatedPrompt) {
    const prompts = await this.loadPrompts();
    
    if (!prompts[promptId]) {
      throw new Error(`プロンプト '${promptId}' が見つかりません`);
    }
    
    prompts[promptId] = {
      ...prompts[promptId],
      ...updatedPrompt,
      lastModified: new Date().toISOString()
    };
    
    await this.savePrompts(prompts);
    return prompts[promptId];
  }

  // 全プロンプトの一覧を取得
  async getAllPrompts() {
    return await this.loadPrompts();
  }

  // プロンプトをデフォルトにリセット
  async resetPrompt(promptId) {
    if (!this.defaultPrompts[promptId]) {
      throw new Error(`デフォルトプロンプト '${promptId}' が見つかりません`);
    }
    
    const prompts = await this.loadPrompts();
    prompts[promptId] = { ...this.defaultPrompts[promptId] };
    
    await this.savePrompts(prompts);
    return prompts[promptId];
  }

  // プロンプトテンプレートに変数を埋め込み
  formatPrompt(template, variables) {
    let formattedPrompt = template;
    
    Object.keys(variables).forEach(key => {
      const placeholder = `{${key}}`;
      const value = variables[key] || '';
      formattedPrompt = formattedPrompt.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return formattedPrompt;
  }

  // プロンプトの検証
  validatePrompt(prompt) {
    const errors = [];
    
    if (!prompt.name || prompt.name.trim() === '') {
      errors.push('プロンプト名は必須です');
    }
    
    if (!prompt.template || prompt.template.trim() === '') {
      errors.push('プロンプトテンプレートは必須です');
    }
    
    if (!prompt.category) {
      errors.push('カテゴリは必須です');
    }
    
    // 変数の検証
    if (prompt.variables) {
      prompt.variables.forEach((variable, index) => {
        if (!variable.name) {
          errors.push(`変数 ${index + 1}: 変数名は必須です`);
        }
        if (!variable.description) {
          errors.push(`変数 ${index + 1}: 説明は必須です`);
        }
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // プロンプト設定のエクスポート
  async exportPrompts() {
    const prompts = await this.loadPrompts();
    return {
      exportDate: new Date().toISOString(),
      version: '1.0.0',
      prompts
    };
  }

  // プロンプト設定のインポート
  async importPrompts(importData) {
    if (!importData.prompts) {
      throw new Error('無効なインポートデータです');
    }
    
    // 各プロンプトを検証
    const validationErrors = [];
    Object.keys(importData.prompts).forEach(key => {
      const validation = this.validatePrompt(importData.prompts[key]);
      if (!validation.isValid) {
        validationErrors.push(`プロンプト '${key}': ${validation.errors.join(', ')}`);
      }
    });
    
    if (validationErrors.length > 0) {
      throw new Error(`インポートデータに問題があります:\n${validationErrors.join('\n')}`);
    }
    
    await this.savePrompts(importData.prompts);
    return true;
  }

  // プロンプトのプレビュー生成
  generatePreview(template, sampleVariables) {
    const defaultSamples = {
      question: '契約違反について相談したい',
      contract_text: '第1条 本契約の目的...',
      law_content: '第1条 この法律は...',
      specific_question: 'この条文の適用範囲について教えてください',
      regulation_filename: 'サンプル規程.txt',
      detected_keywords: '労働, 契約, 責任',
      regulation_content: '第1章 総則\n第1条 目的...',
      relevant_laws: '労働基準法, 民法'
    };
    
    const variables = { ...defaultSamples, ...sampleVariables };
    return this.formatPrompt(template, variables);
  }
}

module.exports = new PromptManagementService();