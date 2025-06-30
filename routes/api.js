const express = require('express');
const router = express.Router();
const LawApiService = require('../services/lawApiService');
const ConsultationService = require('../services/consultationService');
const GeminiService = require('../services/geminiService');
const PromptManagementService = require('../services/promptManagementService');
const HearingService = require('../services/hearingService');


// 法令検索エンドポイント
router.get('/search-laws', async (req, res) => {
  try {
    const { query } = req.query;
    const laws = await LawApiService.searchLaws(query);
    res.json({ success: true, data: laws });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 法令詳細取得エンドポイント
router.get('/law/:lawId', async (req, res) => {
  try {
    const { lawId } = req.params;
    const lawData = await LawApiService.getLawData(lawId);
    res.json({ success: true, data: lawData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 法令詳細取得エンドポイント（フロントエンド互換）
router.get('/law-detail/:lawId', async (req, res) => {
  try {
    const { lawId } = req.params;
    const lawData = await LawApiService.getLawData(lawId);
    res.json({ success: true, data: lawData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 条文取得エンドポイント
router.get('/article/:lawId/:articleNum', async (req, res) => {
  try {
    const { lawId, articleNum } = req.params;
    const article = await LawApiService.getArticle(lawId, articleNum);
    res.json({ success: true, data: article });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 法務相談エンドポイント
router.post('/consult', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || question.trim() === '') {
      return res.status(400).json({ success: false, error: '質問を入力してください' });
    }
    
    const consultationResult = await ConsultationService.processConsultation(question);
    res.json({ success: true, data: consultationResult });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 法令解釈支援エンドポイント
router.post('/interpret-law', async (req, res) => {
  try {
    const { lawContent, question } = req.body;
    if (!lawContent || !question) {
      return res.status(400).json({ success: false, error: '法令内容と質問の両方を入力してください' });
    }
    
    if (!GeminiService.isEnabled()) {
      return res.status(503).json({ success: false, error: 'AI解釈機能は現在利用できません' });
    }
    
    const interpretation = await GeminiService.interpretLaw(lawContent, question);
    res.json({ success: true, data: { interpretation } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 契約書レビューエンドポイント
router.post('/review-contract', async (req, res) => {
  try {
    const { contractText, reviewPoints } = req.body;
    if (!contractText) {
      return res.status(400).json({ success: false, error: '契約書内容を入力してください' });
    }
    
    if (!GeminiService.isEnabled()) {
      return res.status(503).json({ success: false, error: 'AI契約書レビュー機能は現在利用できません' });
    }
    
    const review = await GeminiService.reviewContract(contractText, reviewPoints || []);
    res.json({ success: true, data: { review } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// プロンプト管理エンドポイント

// 全プロンプト一覧取得
router.get('/prompts', async (req, res) => {
  try {
    const prompts = await PromptManagementService.getAllPrompts();
    res.json({ success: true, data: prompts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 特定プロンプト取得
router.get('/prompts/:promptId', async (req, res) => {
  try {
    const { promptId } = req.params;
    const prompt = await PromptManagementService.getPrompt(promptId);
    
    if (!prompt) {
      return res.status(404).json({ success: false, error: 'プロンプトが見つかりません' });
    }
    
    res.json({ success: true, data: prompt });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// プロンプト更新
router.put('/prompts/:promptId', async (req, res) => {
  try {
    const { promptId } = req.params;
    const updatedPrompt = req.body;
    
    // プロンプトの検証
    const validation = PromptManagementService.validatePrompt(updatedPrompt);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false, 
        error: '入力データに問題があります',
        details: validation.errors 
      });
    }
    
    const result = await PromptManagementService.updatePrompt(promptId, updatedPrompt);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// プロンプトリセット
router.post('/prompts/:promptId/reset', async (req, res) => {
  try {
    const { promptId } = req.params;
    const result = await PromptManagementService.resetPrompt(promptId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// プロンプトプレビュー生成
router.post('/prompts/preview', async (req, res) => {
  try {
    const { template, sampleVariables } = req.body;
    
    if (!template) {
      return res.status(400).json({ success: false, error: 'テンプレートが必要です' });
    }
    
    const preview = PromptManagementService.generatePreview(template, sampleVariables || {});
    res.json({ success: true, data: { preview } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// プロンプト設定エクスポート
router.get('/prompts/export', async (req, res) => {
  try {
    const exportData = await PromptManagementService.exportPrompts();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=prompts-export.json');
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// プロンプト設定インポート
router.post('/prompts/import', async (req, res) => {
  try {
    const importData = req.body;
    
    await PromptManagementService.importPrompts(importData);
    res.json({ success: true, message: 'プロンプト設定をインポートしました' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ヒアリング開始エンドポイント
router.post('/hearing/start', (req, res) => {
  try {
    const session = HearingService.startHearing();
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ヒアリング回答処理エンドポイント
router.post('/hearing/answer', async (req, res) => {
  try {
    const { sessionId, questionId, answer, currentAnswers } = req.body;
    
    if (!questionId || answer === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: '質問IDと回答が必要です' 
      });
    }
    
    const result = await HearingService.processAnswer(
      sessionId, 
      questionId, 
      answer, 
      currentAnswers
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ヒアリング完了後の相談実行エンドポイント
router.post('/hearing/consult', async (req, res) => {
  try {
    const { finalPrompt, category, answers } = req.body;
    
    if (!finalPrompt || !finalPrompt.structured) {
      return res.status(400).json({ 
        success: false, 
        error: '最終プロンプトが必要です' 
      });
    }
    
    // 構造化されたプロンプトで相談を実行
    const consultationResult = await ConsultationService.processConsultation(
      finalPrompt.structured
    );
    
    // ヒアリング情報を相談結果に追加
    consultationResult.hearingContext = {
      category: category,
      answers: answers,
      userReadablePrompt: finalPrompt.userReadable
    };
    
    res.json({ success: true, data: consultationResult });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// AIステータス確認エンドポイント
router.get('/ai-status', (req, res) => {
  res.json({
    success: true,
    data: {
      geminiEnabled: GeminiService.isEnabled(),
      model: process.env.GEMINI_MODEL || 'gemini-pro',
      features: {
        consultation: true,
        lawInterpretation: GeminiService.isEnabled(),
        contractReview: GeminiService.isEnabled(),
        promptManagement: true,
        hearing: true
      }
    }
  });
});

module.exports = router;