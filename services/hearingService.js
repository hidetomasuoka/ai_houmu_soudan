const GeminiService = require('./geminiService');

class HearingService {
  constructor() {
    this.questionTemplates = {
      // 初期カテゴリ分類質問
      initial: [
        {
          id: 'category',
          question: '法務相談の分野を教えてください',
          options: [
            { value: 'labor', label: '労働・雇用に関する問題' },
            { value: 'corporate', label: '会社・企業法務に関する問題' },
            { value: 'contract', label: '契約に関する問題' },
            { value: 'privacy', label: '個人情報・プライバシーに関する問題' },
            { value: 'intellectual', label: '知的財産に関する問題' },
            { value: 'criminal', label: '刑事・犯罪に関する問題' },
            { value: 'civil', label: '民事・損害賠償に関する問題' },
            { value: 'other', label: 'その他' }
          ],
          type: 'single_select'
        }
      ],
      
      // カテゴリ別詳細質問
      labor: [
        {
          id: 'labor_type',
          question: '労働問題の種類を選んでください',
          options: [
            { value: 'dismissal', label: '解雇・退職に関する問題' },
            { value: 'wages', label: '賃金・残業代に関する問題' },
            { value: 'conditions', label: '労働条件に関する問題' },
            { value: 'harassment', label: 'ハラスメントに関する問題' },
            { value: 'union', label: '労働組合に関する問題' },
            { value: 'safety', label: '労働安全衛生に関する問題' }
          ],
          type: 'single_select'
        },
        {
          id: 'position',
          question: 'あなたの立場を教えてください',
          options: [
            { value: 'employee', label: '労働者・従業員' },
            { value: 'employer', label: '使用者・雇用主' },
            { value: 'hr', label: '人事担当者' },
            { value: 'consultant', label: 'コンサルタント・専門家' }
          ],
          type: 'single_select'
        },
        {
          id: 'urgency',
          question: '問題の緊急度はどの程度ですか？',
          options: [
            { value: 'urgent', label: '緊急（すぐに対応が必要）' },
            { value: 'soon', label: '近日中（1週間以内に対応が必要）' },
            { value: 'normal', label: '通常（1ヶ月以内に対応が必要）' },
            { value: 'planning', label: '予防・計画段階' }
          ],
          type: 'single_select'
        }
      ],
      
      corporate: [
        {
          id: 'corporate_type',
          question: '会社法務の種類を選んでください',
          options: [
            { value: 'governance', label: '企業統治・ガバナンス' },
            { value: 'compliance', label: 'コンプライアンス' },
            { value: 'merger', label: 'M&A・企業再編' },
            { value: 'securities', label: '証券・金融商品取引' },
            { value: 'incorporation', label: '会社設立・組織変更' },
            { value: 'shareholders', label: '株主・株主総会' }
          ],
          type: 'single_select'
        },
        {
          id: 'company_size',
          question: '会社の規模を教えてください',
          options: [
            { value: 'startup', label: 'スタートアップ（従業員10名未満）' },
            { value: 'sme', label: '中小企業（従業員300名未満）' },
            { value: 'large', label: '大企業（従業員300名以上）' },
            { value: 'public', label: '上場企業' }
          ],
          type: 'single_select'
        }
      ],
      
      contract: [
        {
          id: 'contract_type',
          question: '契約の種類を選んでください',
          options: [
            { value: 'business', label: '業務委託契約' },
            { value: 'sales', label: '売買契約' },
            { value: 'service', label: 'サービス提供契約' },
            { value: 'license', label: 'ライセンス契約' },
            { value: 'employment', label: '雇用契約' },
            { value: 'lease', label: 'リース・賃貸契約' }
          ],
          type: 'single_select'
        },
        {
          id: 'contract_stage',
          question: '契約のどの段階でしょうか？',
          options: [
            { value: 'draft', label: '契約書の作成・レビュー段階' },
            { value: 'negotiation', label: '契約交渉段階' },
            { value: 'execution', label: '契約履行中' },
            { value: 'dispute', label: '契約違反・紛争発生' }
          ],
          type: 'single_select'
        }
      ]
    };
  }

  // ヒアリングセッションを開始
  startHearing() {
    return {
      sessionId: this.generateSessionId(),
      currentStep: 0,
      answers: {},
      questions: this.questionTemplates.initial,
      isComplete: false,
      context: {
        category: null,
        detailed_answers: [],
        prompt_elements: []
      }
    };
  }

  // 回答を処理して次の質問を生成
  async processAnswer(sessionId, questionId, answer, currentAnswers = {}) {
    const updatedAnswers = { ...currentAnswers, [questionId]: answer };
    
    // 詳細入力が完了した場合はヒアリング終了
    if (questionId === 'detailed_description' && answer) {
      const finalPrompt = await this.buildFinalPrompt(updatedAnswers);
      return {
        isComplete: true,
        answers: updatedAnswers,
        finalPrompt: finalPrompt,
        questions: []
      };
    }
    
    // 次の質問を決定
    const nextQuestions = this.getNextQuestions(questionId, answer, updatedAnswers);
    
    // 詳細な自由記述が必要かチェック
    const needsDetailedInput = this.shouldAskForDetails(updatedAnswers);
    
    if (nextQuestions.length === 0 && !needsDetailedInput) {
      // ヒアリング完了、最終プロンプトを生成
      const finalPrompt = await this.buildFinalPrompt(updatedAnswers);
      return {
        isComplete: true,
        answers: updatedAnswers,
        finalPrompt: finalPrompt,
        questions: []
      };
    }
    
    // 詳細入力が必要な場合
    if (needsDetailedInput && !updatedAnswers.detailed_description) {
      return {
        isComplete: false,
        answers: updatedAnswers,
        questions: [this.generateDetailedInputQuestion(updatedAnswers)],
        needsDetailedInput: true
      };
    }
    
    return {
      isComplete: false,
      answers: updatedAnswers,
      questions: nextQuestions
    };
  }

  // 次の質問を決定
  getNextQuestions(lastQuestionId, lastAnswer, allAnswers) {
    // カテゴリが選択された場合
    if (lastQuestionId === 'category' && lastAnswer !== 'other') {
      const categoryQuestions = this.questionTemplates[lastAnswer] || [];
      return categoryQuestions;
    }
    
    // その他が選択された場合は直接詳細入力へ
    if (lastQuestionId === 'category' && lastAnswer === 'other') {
      return [];
    }
    
    // カテゴリ別質問の処理
    const category = allAnswers.category;
    if (category && this.questionTemplates[category]) {
      const categoryQuestions = this.questionTemplates[category];
      const answeredQuestionIds = Object.keys(allAnswers);
      
      // まだ回答していない質問を探す
      const unansweredQuestions = categoryQuestions.filter(q => 
        !answeredQuestionIds.includes(q.id)
      );
      
      return unansweredQuestions.slice(0, 1); // 一つずつ表示
    }
    
    return [];
  }

  // 詳細入力が必要かチェック
  shouldAskForDetails(answers) {
    // 基本的な質問がすべて回答されているかチェック
    const category = answers.category;
    if (!category) return false;
    
    const categoryQuestions = this.questionTemplates[category] || [];
    const requiredQuestions = categoryQuestions.map(q => q.id);
    
    return requiredQuestions.every(qId => answers[qId] !== undefined);
  }

  // 詳細入力質問を生成
  generateDetailedInputQuestion(answers) {
    const category = answers.category;
    const categoryLabels = {
      labor: '労働・雇用',
      corporate: '会社・企業法務',
      contract: '契約',
      privacy: '個人情報・プライバシー',
      intellectual: '知的財産',
      criminal: '刑事・犯罪',
      civil: '民事・損害賠償'
    };
    
    const categoryLabel = categoryLabels[category] || '法務';
    
    return {
      id: 'detailed_description',
      question: `${categoryLabel}問題の詳細を教えてください`,
      placeholder: `具体的な状況、経緯、気になる点、期待する解決方法などを詳しく記載してください。\n\n例：\n- いつ、どこで、誰が関わった問題か\n- 現在どのような状況になっているか\n- どのような解決を希望しているか\n- 期限や制約があるか`,
      type: 'textarea',
      required: true
    };
  }

  // 最終プロンプトを構築
  async buildFinalPrompt(answers) {
    const category = answers.category;
    const detailedDescription = answers.detailed_description || '';
    
    let promptElements = [];
    
    // カテゴリ別のコンテキスト構築
    promptElements.push(`## 相談分野: ${this.getCategoryLabel(category)}`);
    
    // 回答内容を構造化
    Object.entries(answers).forEach(([questionId, answer]) => {
      if (questionId === 'category' || questionId === 'detailed_description') return;
      
      const questionInfo = this.findQuestionInfo(questionId, category);
      if (questionInfo) {
        const optionLabel = this.getOptionLabel(questionInfo, answer);
        promptElements.push(`- ${questionInfo.question}: ${optionLabel}`);
      }
    });
    
    // 詳細説明を追加
    if (detailedDescription) {
      promptElements.push(`\n## 詳細な状況\n${detailedDescription}`);
    }
    
    // 専門的なプロンプトを構築（非同期になったため await を追加）
    const structuredPromptResult = await this.buildStructuredPrompt(category, answers, detailedDescription);
    
    return {
      userReadable: promptElements.join('\n'),
      structured: structuredPromptResult.prompt,
      generatedQuestion: structuredPromptResult.generatedQuestion,
      category: category,
      answers: answers
    };
  }

  // 構造化されたプロンプトを構築
  async buildStructuredPrompt(category, answers, detailedDescription) {
    let generatedQuestion = null;
    
    // Geminiが利用可能な場合は、ヒアリング結果から質問文を生成
    if (GeminiService.isEnabled()) {
      try {
        generatedQuestion = await GeminiService.generateQuestionFromHearing(answers, category);
        console.log('Geminiにより生成された質問文:', generatedQuestion);
        
        // 生成された質問文を使用してプロンプトを構築
        const basePrompt = `あなたは日本の法務に精通した専門家です。以下の相談に対して、関連する法令を特定し、具体的で実践的なアドバイスを提供してください。`;
        
        const contextSection = `\n\n## 相談内容\n${generatedQuestion}`;
        
        const originalContextSection = detailedDescription ? `\n\n## 相談者の元の説明\n${detailedDescription}` : '';
        
        const instructionPrompt = `\n\n## 回答形式\n以下の形式で回答してください：\n1. 関連する法令の特定\n2. 法的な論点の整理\n3. 具体的な対応策の提案\n4. 注意事項とリスク\n5. 次のステップの提案`;
        
        return {
          prompt: basePrompt + contextSection + originalContextSection + instructionPrompt,
          generatedQuestion: generatedQuestion
        };
      } catch (error) {
        console.warn('Geminiによる質問文生成に失敗、標準的なプロンプトを使用:', error.message);
      }
    }
    
    // Geminiが使用できない場合は従来の方法でプロンプトを構築
    const basePrompt = `あなたは日本の法務に精通した専門家です。以下の相談に対して、関連する法令を特定し、具体的で実践的なアドバイスを提供してください。`;
    
    let specificContext = '';
    
    switch (category) {
      case 'labor':
        specificContext = this.buildLaborContext(answers);
        break;
      case 'corporate':
        specificContext = this.buildCorporateContext(answers);
        break;
      case 'contract':
        specificContext = this.buildContractContext(answers);
        break;
      default:
        specificContext = `相談分野: ${this.getCategoryLabel(category)}`;
    }
    
    const detailSection = detailedDescription ? `\n\n## 具体的な状況\n${detailedDescription}` : '';
    
    const instructionPrompt = `\n\n## 回答形式\n以下の形式で回答してください：\n1. 関連する法令の特定\n2. 法的な論点の整理\n3. 具体的な対応策の提案\n4. 注意事項とリスク\n5. 次のステップの提案`;
    
    return {
      prompt: basePrompt + '\n\n' + specificContext + detailSection + instructionPrompt,
      generatedQuestion: null
    };
  }

  buildLaborContext(answers) {
    let context = '## 労働法務相談\n';
    
    if (answers.labor_type) {
      const typeLabels = {
        dismissal: '解雇・退職問題',
        wages: '賃金・残業代問題',
        conditions: '労働条件問題',
        harassment: 'ハラスメント問題',
        union: '労働組合問題',
        safety: '労働安全衛生問題'
      };
      context += `問題の種類: ${typeLabels[answers.labor_type]}\n`;
    }
    
    if (answers.position) {
      const positionLabels = {
        employee: '労働者・従業員の立場',
        employer: '使用者・雇用主の立場',
        hr: '人事担当者の立場',
        consultant: 'コンサルタント・専門家の立場'
      };
      context += `相談者の立場: ${positionLabels[answers.position]}\n`;
    }
    
    if (answers.urgency) {
      const urgencyLabels = {
        urgent: '緊急対応が必要',
        soon: '近日中の対応が必要',
        normal: '通常の対応時期',
        planning: '予防・計画段階'
      };
      context += `緊急度: ${urgencyLabels[answers.urgency]}\n`;
    }
    
    return context;
  }

  buildCorporateContext(answers) {
    let context = '## 会社法務相談\n';
    
    if (answers.corporate_type) {
      const typeLabels = {
        governance: '企業統治・ガバナンス',
        compliance: 'コンプライアンス',
        merger: 'M&A・企業再編',
        securities: '証券・金融商品取引',
        incorporation: '会社設立・組織変更',
        shareholders: '株主・株主総会'
      };
      context += `問題の種類: ${typeLabels[answers.corporate_type]}\n`;
    }
    
    if (answers.company_size) {
      const sizeLabels = {
        startup: 'スタートアップ（従業員10名未満）',
        sme: '中小企業（従業員300名未満）',
        large: '大企業（従業員300名以上）',
        public: '上場企業'
      };
      context += `会社規模: ${sizeLabels[answers.company_size]}\n`;
    }
    
    return context;
  }

  buildContractContext(answers) {
    let context = '## 契約法務相談\n';
    
    if (answers.contract_type) {
      const typeLabels = {
        business: '業務委託契約',
        sales: '売買契約',
        service: 'サービス提供契約',
        license: 'ライセンス契約',
        employment: '雇用契約',
        lease: 'リース・賃貸契約'
      };
      context += `契約の種類: ${typeLabels[answers.contract_type]}\n`;
    }
    
    if (answers.contract_stage) {
      const stageLabels = {
        draft: '契約書の作成・レビュー段階',
        negotiation: '契約交渉段階',
        execution: '契約履行中',
        dispute: '契約違反・紛争発生'
      };
      context += `契約段階: ${stageLabels[answers.contract_stage]}\n`;
    }
    
    return context;
  }

  // ユーティリティメソッド
  generateSessionId() {
    return 'hearing_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getCategoryLabel(category) {
    const labels = {
      labor: '労働・雇用問題',
      corporate: '会社・企業法務',
      contract: '契約問題',
      privacy: '個人情報・プライバシー',
      intellectual: '知的財産',
      criminal: '刑事・犯罪',
      civil: '民事・損害賠償',
      other: 'その他'
    };
    return labels[category] || category;
  }

  findQuestionInfo(questionId, category) {
    const questions = this.questionTemplates[category] || [];
    return questions.find(q => q.id === questionId);
  }

  getOptionLabel(questionInfo, value) {
    if (!questionInfo.options) return value;
    const option = questionInfo.options.find(opt => opt.value === value);
    return option ? option.label : value;
  }
}

module.exports = new HearingService();