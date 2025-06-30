const LawApiService = require('./lawApiService');
const GeminiService = require('./geminiService');
const KnowledgeGraphService = require('./knowledgeGraphService');

class ConsultationService {
  constructor() {
    this.commonLegalTerms = [
      '契約', '損害賠償', '責任', '権利', '義務', '法的効力',
      '民法', '商法', '会社法', '労働法', '刑法', '行政法'
    ];
  }

  // 基本的な法務相談処理
  async processConsultation(question) {
    try {
      // 1. Geminiでクエリを拡張
      let expandedQuery = question;
      let expandedKeywords = this.extractLegalKeywords(question);
      
      if (GeminiService.isEnabled()) {
        try {
          const expansion = await GeminiService.expandQuery(question);
          expandedQuery = expansion.expandedQuery;
          expandedKeywords = [...new Set([...expandedKeywords, ...expansion.keywords])];
          console.log('拡張されたクエリ:', expandedQuery);
          console.log('拡張されたキーワード:', expandedKeywords);
        } catch (error) {
          console.warn('クエリ拡張エラー、元のクエリを使用:', error.message);
        }
      }
      
      // 2. 拡張されたクエリで法令APIv2から関連法令を検索
      let relevantLaws = await this.findRelevantLawsV2(expandedKeywords, expandedQuery);
      
      // API検索が失敗した場合の対処
      if (relevantLaws.length === 0) {
        console.log('API v2検索結果なし、v1 APIで再試行...');
        // API v1での検索を試行
        relevantLaws = await this.findRelevantLawsV1(expandedKeywords, expandedQuery);
        
        // それでも見つからない場合のみサンプルデータを使用
        if (relevantLaws.length === 0) {
          relevantLaws = this.getSampleLaws(expandedKeywords, question);
          console.log('Using sample laws for demo:', relevantLaws.length);
        }
      }
      
      // 3. Geminiで回答をマージし、参照法令を明記
      let response;
      let aiGenerated = false;
      let referencedLaws = [];
      
      if (GeminiService.isEnabled()) {
        try {
          const geminiResponse = await GeminiService.generateLegalAdviceWithReferences(
            question,
            expandedQuery,
            relevantLaws,
            expandedKeywords
          );
          response = geminiResponse.advice;
          referencedLaws = geminiResponse.referencedLaws || [];
          aiGenerated = true;
        } catch (geminiError) {
          console.warn('Gemini API error, falling back to basic response:', geminiError.message);
          response = await this.generateBasicResponse(question, expandedKeywords, relevantLaws);
          referencedLaws = relevantLaws.map(law => ({
            lawId: law.LawId,
            lawName: law.LawName,
            lawNo: law.LawNo
          }));
        }
      } else {
        response = await this.generateBasicResponse(question, expandedKeywords, relevantLaws);
        referencedLaws = relevantLaws.map(law => ({
          lawId: law.LawId,
          lawName: law.LawName,
          lawNo: law.LawNo
        }));
      }
      
      // ナレッジグラフの生成
      let knowledgeGraph = null;
      try {
        knowledgeGraph = await KnowledgeGraphService.buildKnowledgeGraph(relevantLaws, expandedQuery);
      } catch (graphError) {
        console.warn('ナレッジグラフ生成エラー:', graphError.message);
      }
      
      return {
        question,
        expandedQuery,
        keywords: expandedKeywords,
        relevantLaws: relevantLaws.slice(0, 10), // 上位10件（ナレッジグラフ用に増加）
        referencedLaws, // 実際に回答で参照した法令
        response,
        aiGenerated,
        knowledgeGraph, // 法令関係性のナレッジグラフ
        disclaimer: "この回答は参考情報であり、具体的な法的アドバイスではありません。重要な案件については専門の弁護士にご相談ください。"
      };
    } catch (error) {
      throw new Error(`相談処理エラー: ${error.message}`);
    }
  }

  // 法的キーワードの抽出
  extractLegalKeywords(question) {
    const keywords = [];
    
    // 一般的な法律用語をチェック
    this.commonLegalTerms.forEach(term => {
      if (question.includes(term)) {
        keywords.push(term);
      }
    });

    // 法令名のパターンをチェック
    const lawPatterns = [
      /([^\s]+法)/g,
      /([^\s]+条例)/g,
      /([^\s]+規則)/g,
      /([^\s]+法律)/g
    ];

    lawPatterns.forEach(pattern => {
      const matches = question.match(pattern);
      if (matches) {
        keywords.push(...matches);
      }
    });

    return [...new Set(keywords)]; // 重複除去
  }

  // 関連法令の検索
  async findRelevantLaws(keywords) {
    const relevantLaws = [];
    
    for (const keyword of keywords) {
      try {
        const searchResult = await LawApiService.searchLaws(keyword);
        if (searchResult && searchResult.length > 0) {
          relevantLaws.push(...searchResult.slice(0, 2)); // 各キーワードから上位2件
        }
      } catch (error) {
        console.log(`キーワード "${keyword}" の検索でエラー:`, error.message);
      }
    }

    // 重複除去（法令IDベース）
    const uniqueLaws = [];
    const seenIds = new Set();
    
    for (const law of relevantLaws) {
      if (law.LawId && !seenIds.has(law.LawId)) {
        seenIds.add(law.LawId);
        uniqueLaws.push(law);
      }
    }

    return uniqueLaws;
  }

  // 法令API v2を使用した詳細検索
  async findRelevantLawsV2(keywords, fullQuery) {
    const relevantLaws = [];
    const seenIds = new Set();
    
    try {
      // 拡張クエリ全体で検索
      const fullQueryResult = await LawApiService.searchLawsV2(fullQuery);
      if (fullQueryResult && fullQueryResult.length > 0) {
        fullQueryResult.forEach(law => {
          if (law.LawId && !seenIds.has(law.LawId)) {
            seenIds.add(law.LawId);
            relevantLaws.push(law);
          }
        });
      }
    } catch (error) {
      console.log('拡張クエリでの検索エラー:', error.message);
    }
    
    // キーワードベースの検索で補完
    for (const keyword of keywords.slice(0, 5)) { // 上位5キーワードのみ
      try {
        const keywordResult = await LawApiService.searchLawsV2(keyword);
        if (keywordResult && keywordResult.length > 0) {
          keywordResult.slice(0, 3).forEach(law => {
            if (law.LawId && !seenIds.has(law.LawId)) {
              seenIds.add(law.LawId);
              relevantLaws.push(law);
            }
          });
        }
      } catch (error) {
        console.log(`キーワード "${keyword}" の検索でエラー:`, error.message);
      }
    }

    // 関連度でソート（検索結果の順序を維持）
    return relevantLaws.slice(0, 10); // 最大10件
  }

  // API v1での法令検索（v2が使用できない場合のフォールバック）
  async findRelevantLawsV1(keywords, query) {
    const relevantLaws = [];
    const seenIds = new Set();

    // 拡張クエリでの検索
    try {
      const expandedResult = await LawApiService.searchLaws(query);
      if (expandedResult && expandedResult.length > 0) {
        expandedResult.slice(0, 5).forEach(law => {
          if (law.LawId && !seenIds.has(law.LawId)) {
            seenIds.add(law.LawId);
            relevantLaws.push(law);
          }
        });
      }
    } catch (error) {
      console.log('拡張クエリでのv1検索エラー:', error.message);
    }
    
    // キーワードベースの検索で補完
    for (const keyword of keywords.slice(0, 5)) {
      try {
        const keywordResult = await LawApiService.searchLaws(keyword);
        if (keywordResult && keywordResult.length > 0) {
          keywordResult.slice(0, 3).forEach(law => {
            if (law.LawId && !seenIds.has(law.LawId)) {
              seenIds.add(law.LawId);
              relevantLaws.push(law);
            }
          });
        }
      } catch (error) {
        console.log(`キーワード "${keyword}" のv1検索でエラー:`, error.message);
      }
    }

    return relevantLaws.slice(0, 10); // 最大10件
  }

  // 基本的な回答生成（Gemini使用不可時のフォールバック）
  async generateBasicResponse(question, keywords, relevantLaws) {
    let response = "ご質問について、以下の観点から回答いたします。\n\n";

    // キーワードベースの基本的な回答
    if (keywords.length > 0) {
      response += `■ 関連する法的概念:\n`;
      response += `お聞かせいただいた内容から、「${keywords.join('」「')}」に関連する法的な問題と考えられます。\n\n`;
    }

    // 関連法令の提示
    if (relevantLaws.length > 0) {
      response += `■ 関連する可能性のある法令:\n`;
      relevantLaws.forEach((law, index) => {
        response += `${index + 1}. ${law.LawName || '法令名不明'}\n`;
        if (law.LawNo) {
          response += `   (法令番号: ${law.LawNo})\n`;
        }
      });
      response += "\n";
    }

    // 一般的なアドバイス
    response += `■ 一般的な考慮事項:\n`;
    response += this.getGeneralAdvice(question, keywords);

    response += `\n■ 次のステップ:\n`;
    response += `具体的な状況に応じた詳細な法的判断が必要な場合は、専門の弁護士への相談をお勧めします。`;

    return response;
  }

  // 一般的なアドバイスの生成
  getGeneralAdvice(question, keywords) {
    let advice = "";

    // キーワードに基づく基本的なアドバイス
    if (keywords.includes('契約')) {
      advice += "• 契約に関する問題では、契約書の内容、成立要件、履行義務などを確認することが重要です。\n";
    }

    if (keywords.includes('損害賠償')) {
      advice += "• 損害賠償については、法的根拠、損害の発生、因果関係、過失の有無などを検討する必要があります。\n";
    }

    if (keywords.includes('労働法') || question.includes('労働') || question.includes('雇用')) {
      advice += "• 労働関係の問題では、労働基準法や労働契約法などの適用を検討する必要があります。\n";
    }

    if (keywords.includes('会社法') || question.includes('会社') || question.includes('株式')) {
      advice += "• 会社に関する問題では、会社法の規定や定款の内容を確認することが重要です。\n";
    }

    if (advice === "") {
      advice = "• 法的な問題の解決には、事実関係の正確な把握と適用される法令の特定が重要です。\n";
      advice += "• 証拠の保全や時効などの期間制限にも注意が必要です。\n";
    }

    return advice;
  }

  // よくある質問への定型回答
  getFrequentlyAskedQuestions() {
    return {
      "契約違反": "契約違反が疑われる場合は、まず契約書の内容を確認し、相手方の行為が契約に違反するかを検討します。",
      "不当解雇": "解雇が不当である可能性がある場合は、解雇理由の妥当性や手続きの適法性を労働基準法等に照らして検討します。",
      "交通事故": "交通事故の損害賠償については、過失割合の認定や損害の算定が重要なポイントとなります。"
    };
  }

  // デモ用サンプル法令データの生成
  getSampleLaws(keywords, question = '') {
    const allSampleLaws = {
      // 労働関連法令
      labor: [
        {
          LawId: '322AC0000000049',
          LawName: '労働基準法',
          LawNo: '昭和二十二年法律第四十九号',
          PromulgationDate: '19470407',
          EnforcementDate: '19470915',
          LawType: 'law'
        },
        {
          LawId: '424AC0000000174',
          LawName: '労働組合法',
          LawNo: '昭和二十四年法律第百七十四号',
          PromulgationDate: '19490601',
          EnforcementDate: '19490601',
          LawType: 'law'
        },
        {
          LawId: '447AC0000000057',
          LawName: '労働安全衛生法',
          LawNo: '昭和四十七年法律第五十七号',
          PromulgationDate: '19720608',
          EnforcementDate: '19721001',
          LawType: 'law'
        }
      ],
      // 会社関連法令
      corporate: [
        {
          LawId: '417AC0000000086',
          LawName: '会社法',
          LawNo: '平成十七年法律第八十六号',
          PromulgationDate: '20050726',
          EnforcementDate: '20060501',
          LawType: 'law'
        },
        {
          LawId: '325AC0000000025',
          LawName: '商法',
          LawNo: '明治三十二年法律第四十八号',
          PromulgationDate: '18990309',
          EnforcementDate: '18990716',
          LawType: 'law'
        },
        {
          LawId: '319AC0000000089',
          LawName: '民法',
          LawNo: '明治二十九年法律第八十九号',
          PromulgationDate: '18960427',
          EnforcementDate: '18980716',
          LawType: 'law'
        }
      ],
      // 個人情報保護・プライバシー関連法令
      privacy: [
        {
          LawId: '515AC0000000057',
          LawName: '個人情報の保護に関する法律',
          LawNo: '平成十五年法律第五十七号',
          PromulgationDate: '20030530',
          EnforcementDate: '20050401',
          LawType: 'law'
        },
        {
          LawId: '319AC0000000089',
          LawName: '民法',
          LawNo: '明治二十九年法律第八十九号',
          PromulgationDate: '18960427',
          EnforcementDate: '18980716',
          LawType: 'law'
        },
        {
          LawId: '321CONSTITUTION',
          LawName: '日本国憲法',
          LawNo: '昭和二十一年憲法',
          PromulgationDate: '19461103',
          EnforcementDate: '19470503',
          LawType: 'constitution'
        }
      ],
      // 刑事・犯罪関連法令
      criminal: [
        {
          LawId: '340AC0000000045',
          LawName: '刑法',
          LawNo: '明治四十年法律第四十五号',
          PromulgationDate: '19070424',
          EnforcementDate: '19081001',
          LawType: 'law'
        },
        {
          LawId: '323AC0000000131',
          LawName: '刑事訴訟法',
          LawNo: '昭和二十三年法律第百三十一号',
          PromulgationDate: '19480710',
          EnforcementDate: '19490101',
          LawType: 'law'
        },
        {
          LawId: '319AC0000000089',
          LawName: '民法',
          LawNo: '明治二十九年法律第八十九号',
          PromulgationDate: '18960427',
          EnforcementDate: '18980716',
          LawType: 'law'
        }
      ]
    };

    // 質問文とキーワードの両方から適切な法令グループを選択
    const questionLower = question.toLowerCase();
    
    // 個人情報保護関連
    if (questionLower.includes('個人情報') || questionLower.includes('プライバシー') || questionLower.includes('情報保護') ||
        keywords.includes('個人情報') || keywords.includes('プライバシー') || keywords.includes('情報保護')) {
      return allSampleLaws.privacy;
    }
    
    // 会社・企業関連
    if (questionLower.includes('会社法') || questionLower.includes('企業') || questionLower.includes('商法') || questionLower.includes('株式') ||
        keywords.includes('会社') || keywords.includes('企業') || keywords.includes('商法') || keywords.includes('株式')) {
      return allSampleLaws.corporate;
    }
    
    // 刑事・犯罪関連
    if (questionLower.includes('犯罪') || questionLower.includes('刑法') || questionLower.includes('刑事') ||
        keywords.includes('犯罪') || keywords.includes('刑法') || keywords.includes('刑事')) {
      return allSampleLaws.criminal;
    }
    
    // 労働関連
    if (questionLower.includes('労働') || questionLower.includes('雇用') || questionLower.includes('賃金') || questionLower.includes('解雇') ||
        keywords.includes('労働') || keywords.includes('雇用') || keywords.includes('賃金') || keywords.includes('解雇')) {
      return allSampleLaws.labor;
    }
    
    // デフォルトは民法中心
    return [allSampleLaws.corporate[2], allSampleLaws.labor[0], allSampleLaws.privacy[1]];
  }
}

module.exports = new ConsultationService();