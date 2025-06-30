const { GoogleGenerativeAI } = require('@google/generative-ai');
const PromptManagementService = require('./promptManagementService');

class GeminiService {
  constructor() {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.warn('Warning: GEMINI_API_KEY is not set or using default value. Please set your actual API key.');
      this.enabled = false;
      return;
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || 'gemini-pro' 
    });
    this.enabled = true;
  }

  // Geminiが利用可能かチェック
  isEnabled() {
    return this.enabled;
  }

  // 法務相談用のプロンプトを生成（カスタムプロンプト対応）
  async createLegalConsultationPrompt(question, relevantLaws = [], keywords = []) {
    try {
      // カスタムプロンプトを取得
      const promptConfig = await PromptManagementService.getPrompt('legalConsultation');
      
      if (promptConfig && promptConfig.template) {
        // 変数の準備
        const variables = {
          question: question
        };
        
        // キーワードセクションの生成
        if (keywords && keywords.length > 0) {
          variables.keywords_section = `【検出された法的キーワード】\n${keywords.join(', ')}\n`;
        } else {
          variables.keywords_section = '';
        }
        
        // 関連法令セクションの生成
        if (relevantLaws && relevantLaws.length > 0) {
          let lawsSection = `【関連する可能性のある法令】\n`;
          relevantLaws.forEach((law, index) => {
            lawsSection += `${index + 1}. ${law.LawName || '法令名不明'}`;
            if (law.LawNo) {
              lawsSection += ` (${law.LawNo})`;
            }
            lawsSection += '\n';
          });
          variables.relevant_laws_section = lawsSection + '\n';
        } else {
          variables.relevant_laws_section = '';
        }
        
        // プロンプトテンプレートに変数を埋め込み
        return PromptManagementService.formatPrompt(promptConfig.template, variables);
      }
    } catch (error) {
      console.warn('カスタムプロンプトの取得に失敗、デフォルトプロンプトを使用:', error.message);
    }
    
    // フォールバック: デフォルトプロンプト
    return this.createDefaultLegalConsultationPrompt(question, relevantLaws, keywords);
  }

  // デフォルトの法務相談プロンプト（フォールバック用）
  createDefaultLegalConsultationPrompt(question, relevantLaws = [], keywords = []) {
    let prompt = `あなたは日本の法律に詳しい法務アドバイザーです。以下の質問に対して、正確で実用的な法的アドバイスを提供してください。

【重要な注意事項】
- 具体的な法的判断が必要な場合は専門弁護士への相談を推奨すること
- 一般的な法律知識と原則に基づいて回答すること
- 断定的な表現は避け、「一般的に」「原則として」などの表現を使用すること

【質問】
${question}

`;

    // 抽出されたキーワードがある場合
    if (keywords && keywords.length > 0) {
      prompt += `【検出された法的キーワード】
${keywords.join(', ')}

`;
    }

    // 関連法令がある場合
    if (relevantLaws && relevantLaws.length > 0) {
      prompt += `【関連する可能性のある法令】
`;
      relevantLaws.forEach((law, index) => {
        prompt += `${index + 1}. ${law.LawName || '法令名不明'}`;
        if (law.LawNo) {
          prompt += ` (${law.LawNo})`;
        }
        prompt += '\n';
      });
      prompt += '\n';
    }

    prompt += `【回答形式】
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

回答は日本語で、わかりやすく丁寧に説明してください。法律用語を使用する場合は、可能な限り一般的な言葉での解説も併記してください。`;

    return prompt;
  }

  // Geminiに法務相談を送信
  async generateLegalAdvice(question, relevantLaws = [], keywords = []) {
    if (!this.enabled) {
      throw new Error('Gemini API is not properly configured. Please set GEMINI_API_KEY in your environment variables.');
    }

    try {
      const prompt = await this.createLegalConsultationPrompt(question, relevantLaws, keywords);
      
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      return {
        advice: text,
        model: process.env.GEMINI_MODEL || 'gemini-pro',
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      
      // API制限やネットワークエラーの場合
      if (error.message.includes('quota') || error.message.includes('limit')) {
        throw new Error('AI APIの利用制限に達しました。しばらく時間をおいてからお試しください。');
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        throw new Error('ネットワークエラーが発生しました。インターネット接続を確認してください。');
      } else {
        throw new Error(`AI相談の生成中にエラーが発生しました: ${error.message}`);
      }
    }
  }

  // 法令解釈の支援（カスタムプロンプト対応）
  async interpretLaw(lawContent, specificQuestion) {
    if (!this.enabled) {
      throw new Error('Gemini API is not properly configured.');
    }

    let prompt;
    try {
      // カスタムプロンプトを取得
      const promptConfig = await PromptManagementService.getPrompt('lawInterpretation');
      
      if (promptConfig && promptConfig.template) {
        const variables = {
          law_content: lawContent,
          specific_question: specificQuestion
        };
        prompt = PromptManagementService.formatPrompt(promptConfig.template, variables);
      } else {
        throw new Error('カスタムプロンプトが見つかりません');
      }
    } catch (error) {
      console.warn('カスタムプロンプトの取得に失敗、デフォルトプロンプトを使用:', error.message);
      
      // フォールバック: デフォルトプロンプト
      prompt = `あなたは日本の法律解釈の専門家です。以下の法令内容について、具体的な質問に答えてください。

【法令内容】
${lawContent}

【質問】
${specificQuestion}

【回答要求】
- 該当条文の意味を分かりやすく説明
- 実際の適用場面での解釈
- 注意すべきポイント
- 類似のケースでの一般的な考え方

専門用語には一般的な説明を併記し、実践的で理解しやすい回答をしてください。`;
    }

    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      throw new Error(`法令解釈エラー: ${error.message}`);
    }
  }

  // 契約書レビュー支援（カスタムプロンプト対応）
  async reviewContract(contractText, reviewPoints = []) {
    if (!this.enabled) {
      throw new Error('Gemini API is not properly configured.');
    }

    let prompt;
    try {
      // カスタムプロンプトを取得
      const promptConfig = await PromptManagementService.getPrompt('contractReview');
      
      if (promptConfig && promptConfig.template) {
        const variables = {
          contract_text: contractText
        };
        
        // レビューポイントセクションの生成
        if (reviewPoints.length > 0) {
          variables.review_points_section = `【特に注意して確認したいポイント】\n${reviewPoints.join('\n')}\n`;
        } else {
          variables.review_points_section = '';
        }
        
        prompt = PromptManagementService.formatPrompt(promptConfig.template, variables);
      } else {
        throw new Error('カスタムプロンプトが見つかりません');
      }
    } catch (error) {
      console.warn('カスタムプロンプトの取得に失敗、デフォルトプロンプトを使用:', error.message);
      
      // フォールバック: デフォルトプロンプト
      prompt = `あなたは契約書レビューの専門家です。以下の契約書について、法的リスクや改善点を指摘してください。

【契約書内容】
${contractText}

`;

      if (reviewPoints.length > 0) {
        prompt += `【特に注意して確認したいポイント】
${reviewPoints.join('\n')}

`;
      }

      prompt += `【レビュー観点】
- 法的リスクの指摘
- 曖昧な表現の特定
- 不利な条項の警告
- 追加すべき条項の提案
- 全体的な評価とアドバイス

※このレビューは一般的な観点からの参考情報です。正式な契約前には必ず専門弁護士の確認を受けてください。`;
    }

    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      throw new Error(`契約書レビューエラー: ${error.message}`);
    }
  }

  // クエリ拡張機能
  async expandQuery(originalQuery) {
    if (!this.enabled) {
      throw new Error('Gemini API is not properly configured.');
    }

    const prompt = `あなたは法的検索の専門家です。以下の質問を分析し、関連する法令を検索するために拡張されたクエリとキーワードを生成してください。

【元の質問】
${originalQuery}

【タスク】
1. 質問に含まれる法的概念を特定
2. 関連する法分野を推定
3. 検索に有効なキーワードを抽出
4. より包括的な検索クエリを生成

【出力形式】
拡張クエリ: [検索用の拡張されたクエリ文]
キーワード: [キーワード1, キーワード2, キーワード3, ...]

重要: 出力は上記の形式に厳密に従ってください。`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      
      // 結果をパース
      const expandedQueryMatch = text.match(/拡張クエリ:\s*(.+)/);
      const keywordsMatch = text.match(/キーワード:\s*\[(.+)\]/);
      
      const expandedQuery = expandedQueryMatch ? expandedQueryMatch[1].trim() : originalQuery;
      const keywords = keywordsMatch 
        ? keywordsMatch[1].split(',').map(k => k.trim().replace(/[\[\]"']/g, ''))
        : [];
      
      return {
        originalQuery,
        expandedQuery,
        keywords
      };
    } catch (error) {
      console.error('クエリ拡張エラー:', error);
      return {
        originalQuery,
        expandedQuery: originalQuery,
        keywords: []
      };
    }
  }

  // 参照法令を明記した法務相談回答生成
  async generateLegalAdviceWithReferences(originalQuestion, expandedQuery, relevantLaws, keywords) {
    if (!this.enabled) {
      throw new Error('Gemini API is not properly configured.');
    }

    let prompt = `あなたは日本の法律に詳しい法務アドバイザーです。以下の質問に対して、提供された法令情報を参照しながら正確で実用的な法的アドバイスを提供してください。

【重要な指示】
- 回答で参照した法令は必ず「【参照法令】法令名（法令番号）」の形式で明記すること
- 具体的な条文を引用する場合は条文番号も含めること
- 参照した法令は回答の最後に一覧としてまとめること

【元の質問】
${originalQuestion}

【検索用拡張クエリ】
${expandedQuery}

【検出されたキーワード】
${keywords.join(', ')}

【検索された関連法令】
`;

    relevantLaws.forEach((law, index) => {
      prompt += `\n${index + 1}. ${law.LawName || '法令名不明'}`;
      if (law.LawNo) {
        prompt += ` (${law.LawNo})`;
      }
      if (law.LawId) {
        prompt += ` [ID: ${law.LawId}]`;
      }
    });

    prompt += `

【回答形式】
以下の構造で回答してください：

■ 法的な論点
（質問に含まれる主要な法的問題点を整理）

■ 適用される法律・原則
（関連する法律や法的原則の説明）
【参照法令】を明記すること

■ 一般的な考え方・判断基準
（通常どのような基準で判断されるかの説明）

■ 推奨される対応
（具体的にどのような行動を取るべきかのアドバイス）

■ 注意事項
（リスクや留意点）

■ 参照した法令一覧
- 法令名（法令番号）[法令ID]
- （実際に回答で参照した法令のみを列挙）

■ 専門家相談の必要性
（弁護士相談が必要な場合の判断基準）

回答は日本語で、わかりやすく丁寧に説明してください。`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      
      // 参照された法令を抽出
      const referencedLaws = [];
      const lawReferencePattern = /【参照法令】([^（]+)（([^）]+)）/g;
      let match;
      
      while ((match = lawReferencePattern.exec(responseText)) !== null) {
        const lawName = match[1].trim();
        const lawNo = match[2].trim();
        
        // relevantLawsから対応する法令情報を探す
        const lawInfo = relevantLaws.find(law => 
          (law.LawName && law.LawName.includes(lawName)) || 
          (law.LawNo && law.LawNo === lawNo)
        );
        
        if (lawInfo) {
          referencedLaws.push({
            lawId: lawInfo.LawId,
            lawName: lawInfo.LawName,
            lawNo: lawInfo.LawNo
          });
        }
      }
      
      return {
        advice: responseText,
        referencedLaws,
        model: process.env.GEMINI_MODEL || 'gemini-pro',
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error(`AI相談の生成中にエラーが発生しました: ${error.message}`);
    }
  }

  // ヒアリング結果から質問文を生成
  async generateQuestionFromHearing(hearingAnswers, category) {
    if (!this.enabled) {
      throw new Error('Gemini API is not enabled');
    }

    // カテゴリラベルのマッピング
    const categoryLabels = {
      labor: '労働・雇用',
      corporate: '会社・企業法務',
      contract: '契約',
      privacy: '個人情報・プライバシー',
      intellectual: '知的財産',
      criminal: '刑事・犯罪',
      civil: '民事・損害賠償'
    };

    // 回答内容を構造化
    let hearingContext = `【相談分野】${categoryLabels[category] || category}\n\n`;
    
    // 各回答を整理
    Object.entries(hearingAnswers).forEach(([key, value]) => {
      if (key === 'category' || key === 'detailed_description') return;
      
      // キーに基づいてラベルを生成
      const labelMap = {
        labor_type: '問題の種類',
        position: '立場',
        urgency: '緊急度',
        corporate_type: '法務の種類',
        company_size: '会社規模',
        contract_type: '契約の種類',
        contract_stage: '契約段階'
      };
      
      const label = labelMap[key] || key;
      hearingContext += `【${label}】${value}\n`;
    });

    // 詳細説明があれば追加
    if (hearingAnswers.detailed_description) {
      hearingContext += `\n【詳細な状況】\n${hearingAnswers.detailed_description}\n`;
    }

    const prompt = `
あなたは法務相談の専門家です。以下のヒアリング結果から、法的アドバイスを求めるための明確で具体的な質問文を生成してください。

${hearingContext}

【要求事項】
1. ヒアリング内容を総合的に分析し、相談者が本当に解決したい法的課題を特定する
2. 具体的で回答しやすい質問文を作成する
3. 必要に応じて、複数の観点からの質問を含める
4. 法的リスクや注意点についても触れる
5. 実務的な解決策を求める形式にする

【出力形式】
生成された質問文のみを出力してください。説明や前置きは不要です。
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      throw new Error(`質問文生成エラー: ${error.message}`);
    }
  }
}

module.exports = new GeminiService();