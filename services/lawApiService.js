const axios = require('axios');
const xml2js = require('xml2js');

class LawApiService {
  constructor() {
    this.baseUrl = 'https://laws.e-gov.go.jp/api/1';
    this.baseUrlV2 = 'https://laws.e-gov.go.jp/api/2'; // API v2
    this.parser = new xml2js.Parser({ explicitArray: false });
  }

  // XMLをJSONに変換
  async parseXml(xmlData) {
    try {
      return await this.parser.parseStringPromise(xmlData);
    } catch (error) {
      throw new Error(`XML解析エラー: ${error.message}`);
    }
  }

  // 法令一覧を取得
  async getLawLists(category = 'all') {
    try {
      const categoryMap = {
        'all': '1',
        'constitution': '2',
        'cabinet': '3',
        'ministerial': '4'
      };
      
      const categoryId = categoryMap[category] || '1';
      const response = await axios.get(`${this.baseUrl}/lawlists/${categoryId}`);
      const result = await this.parseXml(response.data);
      
      return result;
    } catch (error) {
      throw new Error(`法令一覧取得エラー: ${error.message}`);
    }
  }

  // 法令データを取得
  async getLawData(lawIdOrNumber) {
    try {
      const response = await axios.get(`${this.baseUrl}/lawdata/${lawIdOrNumber}`);
      const result = await this.parseXml(response.data);
      
      return result;
    } catch (error) {
      throw new Error(`法令データ取得エラー: ${error.message}`);
    }
  }

  // 条文を取得
  async getArticle(lawId, articleNumber) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/articles;lawId=${lawId};article=${articleNumber}`
      );
      const result = await this.parseXml(response.data);
      
      return result;
    } catch (error) {
      throw new Error(`条文取得エラー: ${error.message}`);
    }
  }

  // 更新法令一覧を取得
  async getUpdatedLaws(date) {
    try {
      // 日付フォーマット: yyyyMMdd
      const response = await axios.get(`${this.baseUrl}/updatelawlists/${date}`);
      const result = await this.parseXml(response.data);
      
      return result;
    } catch (error) {
      throw new Error(`更新法令取得エラー: ${error.message}`);
    }
  }

  // 法令検索（簡易実装）
  async searchLaws(query) {
    try {
      // 全法令を取得して検索（実際の実装では効率化が必要）
      const lawLists = await this.getLawLists('all');
      
      if (!lawLists.DataRoot || !lawLists.DataRoot.ApplData || !lawLists.DataRoot.ApplData.LawNameListInfo) {
        return [];
      }

      const laws = Array.isArray(lawLists.DataRoot.ApplData.LawNameListInfo) 
        ? lawLists.DataRoot.ApplData.LawNameListInfo
        : [lawLists.DataRoot.ApplData.LawNameListInfo];

      // クエリでフィルタリング
      const filteredLaws = laws.filter(law => {
        if (law.LawName && law.LawName.includes(query)) {
          return true;
        }
        return false;
      });

      return filteredLaws.slice(0, 20); // 最大20件に制限
    } catch (error) {
      throw new Error(`法令検索エラー: ${error.message}`);
    }
  }

  // 法令の詳細情報を整理して返す
  async getLawSummary(lawId) {
    try {
      const lawData = await this.getLawData(lawId);
      
      if (!lawData.DataRoot || !lawData.DataRoot.ApplData) {
        throw new Error('法令データが見つかりません');
      }

      const applData = lawData.DataRoot.ApplData;
      
      return {
        lawId: applData.LawId,
        lawNumber: applData.LawNum,
        lawName: applData.LawFullText?.Law?.LawName || '不明',
        lawType: applData.LawType,
        promulgationDate: applData.PromulgationDate,
        enforcementDate: applData.EnforcementDate,
        content: applData.LawFullText
      };
    } catch (error) {
      throw new Error(`法令サマリー取得エラー: ${error.message}`);
    }
  }

  // 法令検索 API v2 - より高度な検索機能
  async searchLawsV2(query) {
    try {
      // API v2のキーワード検索エンドポイントを使用
      const params = new URLSearchParams({
        keyword: query,
        limit: 50  // 最大50件
      });
      
      const response = await axios.get(`${this.baseUrlV2}/keyword?${params}`, {
        headers: {
          'Accept': 'application/xml'
        }
      });
      
      const result = await this.parseXml(response.data);
      
      // 検索結果の整形
      if (!result.DataRoot || !result.DataRoot.ApplData || !result.DataRoot.ApplData.LawInfo) {
        return [];
      }
      
      const lawInfos = Array.isArray(result.DataRoot.ApplData.LawInfo)
        ? result.DataRoot.ApplData.LawInfo
        : [result.DataRoot.ApplData.LawInfo];
      
      // 必要な情報を抽出
      return lawInfos.map(law => ({
        LawId: law.LawId || law.$.LawId,
        LawName: law.LawName || law.$.LawName,
        LawNo: law.LawNo || law.$.LawNo,
        PromulgationDate: law.PromulgationDate || law.$.PromulgationDate,
        LawType: law.LawType || law.$.LawType,
        Score: law.Score || law.$.Score // 関連度スコア（API v2の機能）
      })).sort((a, b) => {
        // スコアでソート（高い順）
        const scoreA = parseFloat(a.Score) || 0;
        const scoreB = parseFloat(b.Score) || 0;
        return scoreB - scoreA;
      });
    } catch (error) {
      console.error('API v2 検索エラー:', error.message);
      // フォールバック: v1 APIを使用
      console.log('API v1にフォールバック');
      return await this.searchLaws(query);
    }
  }
}

module.exports = new LawApiService();