const GeminiService = require('./geminiService');
const LawApiService = require('./lawApiService');

class KnowledgeGraphService {
  constructor() {
    this.relationshipTypes = {
      REFERENCES: '参照',
      AMENDS: '改正',
      SUPERSEDES: '廃止・代替',
      IMPLEMENTS: '施行',
      RELATED_TO: '関連',
      SUBORDINATE_TO: '下位法令',
      SUPERIOR_TO: '上位法令',
      CONFLICTS_WITH: '矛盾・齟齬',
      COMPLEMENTS: '補完'
    };
  }

  async buildKnowledgeGraph(laws, query) {
    // より多くの関連法令を取得してナレッジグラフを豊富にする
    const enrichedLaws = await this.enrichLawsForGraph(laws, query);
    
    // 法令レベルのノードとエッジを作成
    const lawNodes = this.createNodes(enrichedLaws);
    const lawEdges = await this.extractRelationships(enrichedLaws, query);
    
    // 条項レベルのノードとエッジを作成
    const articleNodes = await this.createArticleNodes(enrichedLaws);
    const articleEdges = await this.extractArticleRelationships(enrichedLaws, articleNodes, query);
    
    // 法令と条項間の関係も追加
    const lawArticleEdges = this.createLawArticleRelationships(lawNodes, articleNodes);
    
    const allNodes = [...lawNodes, ...articleNodes];
    const allEdges = [...lawEdges, ...articleEdges, ...lawArticleEdges];
    
    return {
      nodes: allNodes,
      edges: allEdges,
      metadata: {
        totalNodes: allNodes.length,
        totalEdges: allEdges.length,
        lawNodes: lawNodes.length,
        articleNodes: articleNodes.length,
        relationshipTypes: this.getUsedRelationshipTypes(allEdges),
        timestamp: new Date().toISOString()
      }
    };
  }

  // ナレッジグラフ用に法令を豊富にする
  async enrichLawsForGraph(initialLaws, query) {
    const enrichedLaws = [...initialLaws];
    const seenIds = new Set(initialLaws.map(law => law.LawId));
    
    // 基本法令を追加で検索して関係性を豊富にする
    const basicLegalTerms = ['民法', '刑法', '商法', '会社法', '労働基準法', '憲法'];
    
    for (const term of basicLegalTerms) {
      try {
        const relatedLaws = await LawApiService.searchLaws(term);
        if (relatedLaws && relatedLaws.length > 0) {
          // 最も関連性の高い1つを追加
          const topLaw = relatedLaws[0];
          if (topLaw.LawId && !seenIds.has(topLaw.LawId)) {
            seenIds.add(topLaw.LawId);
            enrichedLaws.push(topLaw);
            
            // ナレッジグラフの複雑性を管理するため、最大15法令に制限
            if (enrichedLaws.length >= 15) break;
          }
        }
      } catch (error) {
        console.log(`基本法令 "${term}" の検索でエラー:`, error.message);
      }
    }
    
    // クエリに関連する追加法令も検索
    if (query && enrichedLaws.length < 12) {
      try {
        const queryLaws = await LawApiService.searchLaws(query);
        if (queryLaws && queryLaws.length > 0) {
          for (const law of queryLaws.slice(0, 3)) {
            if (law.LawId && !seenIds.has(law.LawId) && enrichedLaws.length < 15) {
              seenIds.add(law.LawId);
              enrichedLaws.push(law);
            }
          }
        }
      } catch (error) {
        console.log('クエリベース法令検索でエラー:', error.message);
      }
    }
    
    console.log(`ナレッジグラフ用法令数: ${initialLaws.length} → ${enrichedLaws.length}`);
    return enrichedLaws;
  }

  createNodes(laws) {
    return laws.map((law, index) => ({
      id: law.LawId || `law_${index}`,
      label: law.LawName || law.LawTitle || '法令名不明',
      type: 'law',
      nodeType: 'law',
      data: {
        lawNo: law.LawNo,
        promulgationDate: law.PromulgationDate,
        enforcementDate: law.EnforcementDate,
        lawType: this.determineLawType(law),
        status: law.Status || 'active',
        eGovUrl: this.generateEGovUrl(law.LawId),
        eGovUrlFromLawNo: this.generateEGovUrlFromLawNo(law.LawNo, law.LawId)
      },
      group: this.determineLawCategory(law),
      size: this.calculateNodeImportance(law)
    }));
  }

  async createArticleNodes(laws) {
    const articleNodes = [];
    
    for (const law of laws.slice(0, 3)) { // 最初の3つの法令のみで性能を考慮
      try {
        const articles = await this.extractArticlesFromLaw(law);
        
        articles.forEach((article, index) => {
          articleNodes.push({
            id: `${law.LawId}_article_${article.number}`,
            label: `${this.truncateText(law.LawName, 15)} 第${article.number}条`,
            type: 'article',
            nodeType: 'article',
            data: {
              lawId: law.LawId,
              lawName: law.LawName,
              lawNo: law.LawNo,
              articleNumber: article.number,
              articleTitle: article.title,
              articleContent: article.content,
              keywords: this.extractKeywordsFromArticle(article.content),
              eGovUrl: this.generateEGovUrl(law.LawId, article.number),
              eGovUrlFromLawNo: this.generateEGovUrlFromLawNo(law.LawNo, law.LawId)
            },
            group: this.determineLawCategory(law),
            size: 0.7 // 条項は法令より小さく表示
          });
        });
      } catch (error) {
        console.warn(`条項抽出エラー (${law.LawName}):`, error.message);
      }
    }
    
    return articleNodes;
  }

  async extractArticlesFromLaw(law) {
    // 実際の実装では法令APIから詳細データを取得
    // ここではサンプルデータを返す
    const sampleArticles = this.getSampleArticles(law);
    return sampleArticles;
  }

  getSampleArticles(law) {
    const lawName = law.LawName || '';
    
    if (lawName.includes('労働基準法')) {
      return [
        {
          number: '1',
          title: '労働条件の原則',
          content: '労働条件は、労働者が人たるに値する生活を営むための必要を充たすべきものでなければならない。'
        },
        {
          number: '15',
          title: '労働条件の明示',
          content: '使用者は、労働契約の締結に際し、労働者に対して賃金、労働時間その他の労働条件を明示しなければならない。'
        },
        {
          number: '16',
          title: '賠償予定の禁止',
          content: '使用者は、労働契約の不履行について違約金を定め、又は損害賠償額を予定する契約をしてはならない。'
        },
        {
          number: '20',
          title: '解雇',
          content: '使用者は、労働者を解雇しようとする場合においては、少くとも三十日前にその予告をし、又は三十日分以上の平均賃金を支払わなければならない。'
        }
      ];
    } else if (lawName.includes('民法')) {
      return [
        {
          number: '415',
          title: '債務不履行による損害賠償',
          content: '債務者がその債務の本旨に従った履行をしないときは、債権者は、これによって生じた損害の賠償を請求することができる。'
        },
        {
          number: '623',
          title: '雇用',
          content: '雇用は、当事者の一方が相手方に対して労働に従事することを約し、相手方がこれに対してその報酬を与えることを約することによって、その効力を生ずる。'
        },
        {
          number: '627',
          title: '期間の定めのない雇用の解約の申入れ',
          content: '当事者が雇用の期間を定めなかったときは、各当事者は、いつでも解約の申入れをすることができる。'
        }
      ];
    } else if (lawName.includes('労働組合法')) {
      return [
        {
          number: '1',
          title: '目的',
          content: 'この法律は、労働者が使用者との交渉において対等の立場に立つことを促進することにより労働者の地位の向上を図り、もつて経済の発達と労働者の福祉の増進とに寄与することを目的とする。'
        },
        {
          number: '7',
          title: '不当労働行為',
          content: '使用者は、次の各号に掲げる行為をしてはならない。'
        }
      ];
    }
    
    return [];
  }

  extractKeywordsFromArticle(content) {
    // 条項内容からキーワードを抽出
    const keywords = [];
    const patterns = [
      /労働者/g, /使用者/g, /賃金/g, /契約/g, /解雇/g, /損害賠償/g,
      /債務/g, /債権/g, /雇用/g, /労働組合/g, /交渉/g
    ];
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        keywords.push(...matches);
      }
    });
    
    return [...new Set(keywords)];
  }

  async extractArticleRelationships(laws, articleNodes, query) {
    const edges = [];
    
    // 条項間の関係性を検出
    for (let i = 0; i < articleNodes.length; i++) {
      for (let j = i + 1; j < articleNodes.length; j++) {
        const relationship = this.findArticleRelationship(articleNodes[i], articleNodes[j]);
        if (relationship) {
          edges.push(relationship);
        }
      }
    }
    
    // 条項の相互参照を検出
    const crossReferences = this.detectArticleCrossReferences(articleNodes);
    edges.push(...crossReferences);
    
    return edges;
  }

  detectArticleCrossReferences(articleNodes) {
    const edges = [];
    
    articleNodes.forEach(article => {
      const content = article.data.articleContent || '';
      
      // 他の条項への参照を検出
      const references = this.findArticleReferences(content, articleNodes, article);
      references.forEach(ref => {
        edges.push({
          source: article.id,
          target: ref.targetArticle.id,
          type: this.relationshipTypes.REFERENCES,
          weight: 0.9,
          metadata: {
            relationshipReason: `条項${ref.referencedNumber}への参照`,
            referenceText: ref.referenceText
          }
        });
      });
    });
    
    return edges;
  }

  findArticleReferences(content, allArticles, currentArticle) {
    const references = [];
    
    // 条項番号のパターンをマッチング（例：第15条、第20条など）
    const articlePattern = /第(\d+)条/g;
    let match;
    
    while ((match = articlePattern.exec(content)) !== null) {
      const referencedNumber = match[1];
      
      // 参照された条項を探す
      const targetArticle = allArticles.find(article => 
        article.data.articleNumber === referencedNumber && 
        article.id !== currentArticle.id
      );
      
      if (targetArticle) {
        references.push({
          targetArticle: targetArticle,
          referencedNumber: referencedNumber,
          referenceText: match[0]
        });
      }
    }
    
    return references;
  }

  findArticleRelationship(article1, article2) {
    const keywords1 = article1.data.keywords || [];
    const keywords2 = article2.data.keywords || [];
    
    // 共通キーワードの数で関係性の強さを判定
    const commonKeywords = keywords1.filter(keyword => keywords2.includes(keyword));
    
    if (commonKeywords.length >= 2) {
      return {
        source: article1.id,
        target: article2.id,
        type: this.relationshipTypes.RELATED_TO,
        weight: commonKeywords.length * 0.3,
        metadata: {
          commonKeywords: commonKeywords,
          relationshipReason: `共通概念: ${commonKeywords.join(', ')}`
        }
      };
    }
    
    // 特定の条項間の関係性をチェック
    if (this.isContractRelated(article1, article2)) {
      return {
        source: article1.id,
        target: article2.id,
        type: this.relationshipTypes.COMPLEMENTS,
        weight: 0.8,
        metadata: {
          relationshipReason: '契約関連条項'
        }
      };
    }
    
    return null;
  }

  isContractRelated(article1, article2) {
    const content1 = article1.data.articleContent || '';
    const content2 = article2.data.articleContent || '';
    
    const contractTerms = ['契約', '雇用', '労働条件', '解雇', '債務'];
    
    const hasContractTerms1 = contractTerms.some(term => content1.includes(term));
    const hasContractTerms2 = contractTerms.some(term => content2.includes(term));
    
    return hasContractTerms1 && hasContractTerms2;
  }

  createLawArticleRelationships(lawNodes, articleNodes) {
    const edges = [];
    
    lawNodes.forEach(lawNode => {
      const relatedArticles = articleNodes.filter(article => 
        article.data.lawId === lawNode.id
      );
      
      relatedArticles.forEach(article => {
        edges.push({
          source: lawNode.id,
          target: article.id,
          type: 'CONTAINS',
          weight: 1.0,
          metadata: {
            relationshipReason: '法令に含まれる条項'
          }
        });
      });
    });
    
    return edges;
  }

  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  // e-Gov法令サイトのURLを生成
  generateEGovUrl(lawId, articleNumber = null) {
    if (!lawId) return null;
    
    // 基本的なe-Gov URLフォーマット
    let url = `https://laws.e-gov.go.jp/law/${lawId}`;
    
    // 条項が指定されている場合は条項URLを生成
    if (articleNumber) {
      url += `_${articleNumber}`;
    }
    
    return url;
  }

  // 法令IDから正確なe-Gov URLを生成（法令番号ベース）
  generateEGovUrlFromLawNo(lawNo, lawId = null) {
    if (!lawNo) return this.generateEGovUrl(lawId);
    
    try {
      // 法令番号のパターンを解析
      // 例: "昭和二十二年法律第四十九号" -> "322AC0000000049" 形式を生成
      const eraPattern = /(明治|大正|昭和|平成|令和)([一二三四五六七八九十百]+)年(.+)第([一二三四五六七八九十百]+)号/;
      const match = lawNo.match(eraPattern);
      
      if (match) {
        const era = match[1];
        const year = this.convertKanjiToNumber(match[2]);
        const type = match[3];
        const number = this.convertKanjiToNumber(match[4]);
        
        // e-Gov形式のIDを生成（推定）
        const eraCode = this.getEraCode(era);
        const yearPart = year.toString().padStart(2, '0');
        const typeCode = this.getLawTypeCode(type);
        const numberPart = number.toString().padStart(7, '0');
        
        const estimatedId = `${yearPart}${eraCode}${typeCode}${numberPart}`;
        return `https://laws.e-gov.go.jp/law/${estimatedId}`;
      }
      
      // パターンマッチに失敗した場合は検索URLを返す
      return `https://laws.e-gov.go.jp/search/elawsSearch/elaws_search/lsg0100/?lawName=${encodeURIComponent(lawNo)}`;
      
    } catch (error) {
      // エラーの場合は汎用検索URLを返す
      return `https://laws.e-gov.go.jp/search/elawsSearch/elaws_search/lsg0100/?lawName=${encodeURIComponent(lawNo)}`;
    }
  }

  // 漢数字を数値に変換
  convertKanjiToNumber(kanjiStr) {
    const kanjiMap = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
      '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
      '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
      '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
      '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25,
      '二十六': 26, '二十七': 27, '二十八': 28, '二十九': 29, '三十': 30,
      '四十': 40, '四十九': 49, '五十': 50, '六十': 60, '七十': 70,
      '八十': 80, '八十九': 89, '九十': 90, '百': 100
    };
    
    return kanjiMap[kanjiStr] || parseInt(kanjiStr) || 0;
  }

  // 元号コードを取得
  getEraCode(era) {
    const eraCodes = {
      '明治': 'M',
      '大正': 'T', 
      '昭和': 'S',
      '平成': 'H',
      '令和': 'R'
    };
    return eraCodes[era] || 'S';
  }

  // 法律種別コードを取得
  getLawTypeCode(type) {
    if (type.includes('法律')) return 'AC';
    if (type.includes('政令')) return 'CO';
    if (type.includes('省令')) return 'M';
    if (type.includes('憲法')) return 'CONSTITUTION';
    return 'AC'; // デフォルトは法律
  }

  async extractRelationships(laws, query) {
    const edges = [];
    const lawMap = new Map(laws.map(law => [law.LawId, law]));

    // 基本的な関係性の抽出
    for (let i = 0; i < laws.length; i++) {
      for (let j = i + 1; j < laws.length; j++) {
        const relationships = await this.findRelationships(laws[i], laws[j], query);
        edges.push(...relationships);
      }
    }

    // AIを使用した高度な関係性抽出
    if (GeminiService.isEnabled() && laws.length > 0) {
      try {
        const aiRelationships = await this.extractAIRelationships(laws, query);
        edges.push(...aiRelationships);
      } catch (error) {
        console.warn('AI関係性抽出エラー:', error.message);
      }
    }

    // 重複除去
    return this.deduplicateEdges(edges);
  }

  async findRelationships(law1, law2, query) {
    const relationships = [];

    // 法令名での参照チェック
    if (law1.LawName && law2.LawName) {
      if (law1.LawName.includes(law2.LawName) || law2.LawName.includes(law1.LawName)) {
        relationships.push({
          source: law1.LawId,
          target: law2.LawId,
          type: this.relationshipTypes.REFERENCES,
          weight: 0.7
        });
      }
    }

    // 同じカテゴリの法令は関連性が高い
    if (this.determineLawCategory(law1) === this.determineLawCategory(law2)) {
      relationships.push({
        source: law1.LawId,
        target: law2.LawId,
        type: this.relationshipTypes.RELATED_TO,
        weight: 0.5
      });
    }

    // 施行日が近い法令は関連している可能性
    if (law1.EnforcementDate && law2.EnforcementDate) {
      const date1 = new Date(law1.EnforcementDate);
      const date2 = new Date(law2.EnforcementDate);
      const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 90) { // 90日以内
        relationships.push({
          source: law1.LawId,
          target: law2.LawId,
          type: this.relationshipTypes.RELATED_TO,
          weight: 0.3
        });
      }
    }

    return relationships;
  }

  async extractAIRelationships(laws, query) {
    if (!GeminiService.isEnabled() || laws.length < 2) {
      return [];
    }

    try {
      const prompt = `
以下の法令間の関係性を分析してください。
クエリ: "${query}"

法令リスト:
${laws.map((law, idx) => `${idx + 1}. ${law.LawName} (${law.LawNo || 'No.不明'})`).join('\n')}

以下の形式で関係性を出力してください:
- 法令1番号,法令2番号,関係タイプ,重要度(0-1)

関係タイプ:
- REFERENCES: 参照関係
- AMENDS: 改正関係
- SUPERSEDES: 廃止・代替関係
- IMPLEMENTS: 施行関係
- RELATED_TO: 関連
- SUBORDINATE_TO: 下位法令
- SUPERIOR_TO: 上位法令
- CONFLICTS_WITH: 矛盾・齟齬
- COMPLEMENTS: 補完関係
`;

      const response = await GeminiService.generateLegalAnalysis(prompt);
      return this.parseAIRelationships(response, laws);
    } catch (error) {
      console.error('AI関係性抽出エラー:', error);
      return [];
    }
  }

  parseAIRelationships(aiResponse, laws) {
    const relationships = [];
    const lines = aiResponse.split('\n');

    for (const line of lines) {
      const match = line.match(/(\d+),(\d+),(\w+),([0-9.]+)/);
      if (match) {
        const [_, idx1, idx2, relType, weight] = match;
        const law1Idx = parseInt(idx1) - 1;
        const law2Idx = parseInt(idx2) - 1;

        if (law1Idx >= 0 && law1Idx < laws.length && 
            law2Idx >= 0 && law2Idx < laws.length &&
            this.relationshipTypes[relType]) {
          relationships.push({
            source: laws[law1Idx].LawId,
            target: laws[law2Idx].LawId,
            type: this.relationshipTypes[relType],
            weight: parseFloat(weight),
            aiGenerated: true
          });
        }
      }
    }

    return relationships;
  }

  determineLawType(law) {
    const lawName = law.LawName || law.LawTitle || '';
    
    if (lawName.includes('憲法')) return 'constitution';
    if (lawName.includes('法律') || lawName.endsWith('法')) return 'law';
    if (lawName.includes('政令')) return 'cabinet_order';
    if (lawName.includes('省令')) return 'ministerial_ordinance';
    if (lawName.includes('条例')) return 'ordinance';
    if (lawName.includes('規則')) return 'rule';
    if (lawName.includes('告示')) return 'notification';
    
    return 'other';
  }

  determineLawCategory(law) {
    const lawName = law.LawName || law.LawTitle || '';
    
    if (lawName.includes('民法') || lawName.includes('契約')) return 'civil';
    if (lawName.includes('刑法') || lawName.includes('犯罪')) return 'criminal';
    if (lawName.includes('労働') || lawName.includes('雇用')) return 'labor';
    if (lawName.includes('会社') || lawName.includes('商法')) return 'corporate';
    if (lawName.includes('税') || lawName.includes('租税')) return 'tax';
    if (lawName.includes('行政')) return 'administrative';
    if (lawName.includes('環境')) return 'environmental';
    if (lawName.includes('知的財産') || lawName.includes('特許')) return 'intellectual_property';
    
    return 'general';
  }

  calculateNodeImportance(law) {
    let importance = 1;
    
    // 法令タイプによる重要度
    const typeWeights = {
      'constitution': 3,
      'law': 2,
      'cabinet_order': 1.5,
      'ministerial_ordinance': 1.2,
      'ordinance': 1,
      'rule': 0.8,
      'other': 0.5
    };
    
    const lawType = this.determineLawType(law);
    importance *= typeWeights[lawType] || 1;
    
    // 新しい法令ほど重要
    if (law.PromulgationDate) {
      const age = (new Date() - new Date(law.PromulgationDate)) / (1000 * 60 * 60 * 24 * 365);
      if (age < 1) importance *= 1.5;
      else if (age < 5) importance *= 1.2;
    }
    
    return importance;
  }

  deduplicateEdges(edges) {
    const seen = new Set();
    return edges.filter(edge => {
      const key = `${edge.source}-${edge.target}-${edge.type}`;
      const reverseKey = `${edge.target}-${edge.source}-${edge.type}`;
      
      if (seen.has(key) || seen.has(reverseKey)) {
        return false;
      }
      
      seen.add(key);
      return true;
    });
  }

  getUsedRelationshipTypes(edges) {
    const types = new Set(edges.map(edge => edge.type));
    return Array.from(types);
  }

  async analyzeConflicts(laws) {
    const conflicts = [];
    
    for (let i = 0; i < laws.length; i++) {
      for (let j = i + 1; j < laws.length; j++) {
        const conflict = await this.detectConflict(laws[i], laws[j]);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }
    
    return conflicts;
  }

  async detectConflict(law1, law2) {
    // 基本的な競合検出ロジック
    if (this.determineLawCategory(law1) === this.determineLawCategory(law2)) {
      // 同じカテゴリで施行日が異なる場合、潜在的な競合
      if (law1.EnforcementDate && law2.EnforcementDate) {
        return {
          laws: [law1.LawId, law2.LawId],
          type: 'potential_conflict',
          severity: 'low',
          description: '同じカテゴリの法令で施行日が異なります'
        };
      }
    }
    
    return null;
  }

  generateGraphSummary(graph) {
    const { nodes, edges, metadata } = graph;
    
    const summary = {
      overview: `${nodes.length}個の法令と${edges.length}個の関係性を発見しました。`,
      mainCategories: this.summarizeCategories(nodes),
      strongestRelationships: this.findStrongestRelationships(edges, nodes),
      centralNodes: this.findCentralNodes(nodes, edges),
      insights: []
    };
    
    // インサイトの生成
    if (edges.some(e => e.type === this.relationshipTypes.CONFLICTS_WITH)) {
      summary.insights.push('潜在的な法令間の競合が検出されました。');
    }
    
    if (nodes.length > 5 && edges.length > nodes.length * 1.5) {
      summary.insights.push('法令間に密接な関係性が存在します。');
    }
    
    return summary;
  }

  summarizeCategories(nodes) {
    const categories = {};
    nodes.forEach(node => {
      const category = node.group;
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({
        category: this.getCategoryName(category),
        count
      }));
  }

  getCategoryName(category) {
    const names = {
      'civil': '民事法',
      'criminal': '刑事法',
      'labor': '労働法',
      'corporate': '会社法・商法',
      'tax': '税法',
      'administrative': '行政法',
      'environmental': '環境法',
      'intellectual_property': '知的財産法',
      'general': 'その他'
    };
    
    return names[category] || category;
  }

  findStrongestRelationships(edges, nodes) {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    return edges
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(edge => ({
        source: nodeMap.get(edge.source)?.label || edge.source,
        target: nodeMap.get(edge.target)?.label || edge.target,
        type: edge.type,
        weight: edge.weight
      }));
  }

  findCentralNodes(nodes, edges) {
    const connectionCount = {};
    
    edges.forEach(edge => {
      connectionCount[edge.source] = (connectionCount[edge.source] || 0) + 1;
      connectionCount[edge.target] = (connectionCount[edge.target] || 0) + 1;
    });
    
    return Object.entries(connectionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nodeId, count]) => {
        const node = nodes.find(n => n.id === nodeId);
        return {
          id: nodeId,
          label: node?.label || nodeId,
          connections: count
        };
      });
  }
}

module.exports = new KnowledgeGraphService();