// ヒアリング機能のメイン処理
class HearingManager {
  constructor() {
    this.currentSession = null;
    this.currentAnswers = {};
    this.questionHistory = [];
    this.totalQuestions = 0;
    this.answeredQuestions = 0;
  }

  // ヒアリングを開始
  async startHearing() {
    try {
      console.log('ヒアリング開始リクエスト送信...');
      const response = await fetch('/api/hearing/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('レスポンスステータス:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('レスポンスデータ:', data);
      
      if (data.success) {
        this.currentSession = data.data;
        this.currentAnswers = {};
        this.questionHistory = [];
        this.answeredQuestions = 0;
        this.totalQuestions = this.estimateQuestionCount();
        
        this.showProgress();
        this.displayCurrentQuestions();
      } else {
        console.error('ヒアリング開始エラー:', data.error);
        alert('ヒアリングの開始に失敗しました: ' + (data.error || '不明なエラー'));
      }
    } catch (error) {
      console.error('ヒアリング開始エラー詳細:', error);
      alert('ヒアリングの開始中にエラーが発生しました: ' + error.message);
    }
  }

  // 質問数を推定
  estimateQuestionCount() {
    // 初期質問 + カテゴリ質問 + 詳細質問 = 大体4-6問
    return 5;
  }

  // 進捗表示を開始
  showProgress() {
    document.getElementById('hearingContainer').style.display = 'none';
    document.getElementById('hearingProgress').style.display = 'block';
    this.updateProgress();
  }

  // 進捗バーを更新
  updateProgress() {
    const percentage = Math.min((this.answeredQuestions / this.totalQuestions) * 100, 100);
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = percentage + '%';
    progressBar.textContent = `${this.answeredQuestions}/${this.totalQuestions}`;
  }

  // 現在の質問を表示
  displayCurrentQuestions() {
    const questionsContainer = document.getElementById('hearingQuestions');
    const questions = this.currentSession.questions;

    if (questions.length === 0) {
      this.showSummary();
      return;
    }

    const question = questions[0]; // 一つずつ表示
    questionsContainer.innerHTML = this.generateQuestionHTML(question);
  }

  // 質問のHTMLを生成
  generateQuestionHTML(question) {
    let html = `
      <div class="question-card p-4 mb-4" style="border: 2px solid #e3f2fd; border-radius: 12px; background: linear-gradient(135deg, #f8fffe 0%, #e8f5f3 100%);">
        <h5 class="mb-3" style="color: #1565c0;">
          <i class="fas fa-question-circle me-2"></i>${question.question}
        </h5>
    `;

    if (question.type === 'single_select') {
      html += '<div class="options-container">';
      question.options.forEach(option => {
        html += `
          <div class="form-check mb-2">
            <input class="form-check-input" type="radio" name="question_${question.id}" 
                   value="${option.value}" id="option_${question.id}_${option.value}">
            <label class="form-check-label" for="option_${question.id}_${option.value}">
              ${option.label}
            </label>
          </div>
        `;
      });
      html += '</div>';
      
      html += `
        <button onclick="hearingManager.submitAnswer('${question.id}')" 
                class="btn btn-primary mt-3" disabled id="submitBtn_${question.id}">
          次へ進む
        </button>
      `;
    } else if (question.type === 'textarea') {
      html += `
        <textarea id="textarea_${question.id}" class="form-control mb-3" rows="6" 
                  placeholder="${question.placeholder || ''}" 
                  ${question.required ? 'required' : ''}></textarea>
        <button onclick="hearingManager.submitTextAnswer('${question.id}')" 
                class="btn btn-primary">
          相談内容を確定する
        </button>
      `;
    }

    html += '</div>';

    // ラジオボタンの変更イベントを後で設定
    setTimeout(() => {
      if (question.type === 'single_select') {
        const radios = document.querySelectorAll(`input[name="question_${question.id}"]`);
        const submitBtn = document.getElementById(`submitBtn_${question.id}`);
        
        radios.forEach(radio => {
          radio.addEventListener('change', () => {
            submitBtn.disabled = false;
          });
        });
      }
    }, 100);

    return html;
  }

  // ラジオボタンの回答を送信
  async submitAnswer(questionId) {
    const selectedOption = document.querySelector(`input[name="question_${questionId}"]:checked`);
    if (!selectedOption) {
      alert('選択肢を選んでください');
      return;
    }

    await this.processAnswer(questionId, selectedOption.value);
  }

  // テキストエリアの回答を送信
  async submitTextAnswer(questionId) {
    const textarea = document.getElementById(`textarea_${questionId}`);
    const answer = textarea.value.trim();
    
    if (!answer) {
      alert('詳細を入力してください');
      return;
    }

    await this.processAnswer(questionId, answer);
  }

  // 回答を処理
  async processAnswer(questionId, answer) {
    this.currentAnswers[questionId] = answer;
    this.answeredQuestions++;
    this.updateProgress();

    // 質問履歴に追加
    const question = this.currentSession.questions.find(q => q.id === questionId);
    this.questionHistory.push({
      question: question.question,
      answer: this.getAnswerLabel(question, answer)
    });

    try {
      const response = await fetch('/api/hearing/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.currentSession.sessionId,
          questionId: questionId,
          answer: answer,
          currentAnswers: this.currentAnswers
        })
      });

      const data = await response.json();
      if (data.success) {
        this.currentSession = { ...this.currentSession, ...data.data };
        
        if (data.data.isComplete) {
          this.showFinalPrompt(data.data.finalPrompt);
        } else {
          this.displayCurrentQuestions();
        }
      } else {
        console.error('回答処理エラー:', data.error);
        alert('回答の処理に失敗しました');
      }
    } catch (error) {
      console.error('回答処理エラー:', error);
      alert('回答の処理中にエラーが発生しました');
    }
  }

  // 回答のラベルを取得
  getAnswerLabel(question, value) {
    if (question.type === 'single_select' && question.options) {
      const option = question.options.find(opt => opt.value === value);
      return option ? option.label : value;
    }
    return value;
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

  // サマリーを表示
  showSummary() {
    const summaryContainer = document.getElementById('hearingSummary');
    
    let html = `
      <div class="summary-card p-4" style="background: #f0f8ff; border-radius: 12px; border: 2px solid #1565c0;">
        <h5 style="color: #1565c0;">📋 ヒアリング内容の確認</h5>
        <div class="history-list mt-3">
    `;

    this.questionHistory.forEach((item, index) => {
      html += `
        <div class="history-item mb-3 p-3" style="background: white; border-radius: 8px; border-left: 4px solid #1565c0;">
          <strong>${item.question}</strong><br>
          <span style="color: #666;">${item.answer}</span>
        </div>
      `;
    });

    html += `
        </div>
        <button onclick="hearingManager.generateFinalConsultation()" class="btn btn-success btn-lg mt-3">
          🎯 最終相談を実行する
        </button>
      </div>
    `;

    summaryContainer.innerHTML = html;
    summaryContainer.style.display = 'block';
    
    // 質問エリアを非表示
    document.getElementById('hearingQuestions').style.display = 'none';
  }

  // 最終相談を生成（showSummaryから呼ばれる）
  async generateFinalConsultation() {
    try {
      console.log('generateFinalConsultation called');
      console.log('currentAnswers:', this.currentAnswers);
      console.log('currentSession:', this.currentSession);
      
      // 最終的な詳細入力質問を追加
      const detailQuestion = this.generateDetailedInputQuestion(this.currentAnswers);
      console.log('detailQuestion:', detailQuestion);
      
      // サマリーを非表示にして質問エリアを表示
      document.getElementById('hearingSummary').style.display = 'none';
      document.getElementById('hearingQuestions').style.display = 'block';
      
      this.currentSession.questions = [detailQuestion];
      this.displayCurrentQuestions();
    } catch (error) {
      console.error('最終相談生成エラー詳細:', error);
      console.error('Stack trace:', error.stack);
      alert('最終相談の生成中にエラーが発生しました: ' + error.message);
    }
  }

  // 最終プロンプトを表示
  showFinalPrompt(finalPrompt) {
    const summaryContainer = document.getElementById('hearingSummary');
    
    let html = `
      <div class="final-prompt-card p-4" style="background: #f0f8ff; border-radius: 12px; border: 2px solid #1565c0;">
        <h5 style="color: #1565c0;">📋 ヒアリング内容の確認</h5>
        
        <div class="prompt-preview mt-3 p-3" style="background: white; border-radius: 8px; max-height: 300px; overflow-y: auto;">
          <h6>ヒアリング結果:</h6>
          <pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${finalPrompt.userReadable}</pre>
        </div>
        
        <div class="generated-question mt-3 p-3" style="background: #e8f5e8; border-radius: 8px; display: ${finalPrompt.generatedQuestion ? 'block' : 'none'};">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h6><i class="fas fa-magic me-2"></i>AIにより生成された質問文:</h6>
            <button class="edit-button" onclick="hearingManager.editGeneratedQuestion()">
              <i class="fas fa-edit me-1"></i>編集
            </button>
          </div>
          <div id="generatedQuestionDisplay" style="margin: 0; font-weight: 500; white-space: pre-wrap;">${finalPrompt.generatedQuestion || ''}</div>
        </div>
        
        <button onclick="hearingManager.executeFinalConsultation()" class="btn btn-success btn-lg mt-3">
          🎯 AI法務相談を実行する
        </button>
      </div>
    `;

    summaryContainer.innerHTML = html;
    summaryContainer.style.display = 'block';
    
    // 質問エリアを非表示
    document.getElementById('hearingQuestions').style.display = 'none';
    
    // 最終プロンプトを保存
    this.finalPrompt = finalPrompt;
  }

  // AI生成質問の編集
  editGeneratedQuestion() {
    if (!this.finalPrompt || !this.finalPrompt.generatedQuestion) {
      alert('編集する質問文がありません');
      return;
    }

    // モーダルを作成
    const modal = document.createElement('div');
    modal.className = 'question-edit-modal';
    modal.innerHTML = `
      <div class="question-edit-content">
        <h5 style="color: #1565c0; margin-bottom: 1rem;">
          <i class="fas fa-edit me-2"></i>AI生成質問文の編集
        </h5>
        <textarea 
          id="questionEditTextarea" 
          class="question-edit-textarea"
          placeholder="質問文を編集してください..."
        >${this.finalPrompt.generatedQuestion}</textarea>
        <div class="mt-3 d-flex justify-content-end gap-2">
          <button class="btn btn-secondary" onclick="hearingManager.closeEditModal()">
            キャンセル
          </button>
          <button class="btn btn-primary" onclick="hearingManager.saveEditedQuestion()">
            <i class="fas fa-save me-1"></i>保存
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.editModal = modal;
    
    // テキストエリアにフォーカス
    setTimeout(() => {
      document.getElementById('questionEditTextarea').focus();
    }, 100);
  }

  // 編集モーダルを閉じる
  closeEditModal() {
    if (this.editModal) {
      document.body.removeChild(this.editModal);
      this.editModal = null;
    }
  }

  // 編集した質問文を保存
  saveEditedQuestion() {
    const textarea = document.getElementById('questionEditTextarea');
    const editedQuestion = textarea.value.trim();
    
    if (!editedQuestion) {
      alert('質問文を入力してください');
      return;
    }

    // 最終プロンプトを更新
    this.finalPrompt.generatedQuestion = editedQuestion;
    
    // 表示を更新
    const displayElement = document.getElementById('generatedQuestionDisplay');
    if (displayElement) {
      displayElement.textContent = editedQuestion;
    }

    // モーダルを閉じる
    this.closeEditModal();
    
    console.log('質問文が更新されました:', editedQuestion);
  }

  // 待機画面を表示
  showLoadingScreen() {
    const overlay = document.createElement('div');
    overlay.className = 'ai-loading-overlay';
    overlay.id = 'aiLoadingOverlay';
    
    overlay.innerHTML = `
      <div class="ai-loading-content">
        <div class="ai-loading-spinner"></div>
        <h4>🤖 AI法務相談を実行中...</h4>
        <p>少々お待ちください</p>
        
        <ul class="ai-loading-steps">
          <li id="step1" class="active">
            <i class="fas fa-search"></i>関連法令を検索中...
          </li>
          <li id="step2">
            <i class="fas fa-brain"></i>AI分析を実行中...
          </li>
          <li id="step3">
            <i class="fas fa-file-alt"></i>法的アドバイスを生成中...
          </li>
          <li id="step4">
            <i class="fas fa-project-diagram"></i>ナレッジグラフを構築中...
          </li>
        </ul>
        
        <div class="ai-loading-dots">
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    this.loadingOverlay = overlay;
    
    // ステップのアニメーション
    this.startLoadingSteps();
  }

  // 待機画面のステップアニメーション
  startLoadingSteps() {
    let currentStep = 1;
    
    this.stepInterval = setInterval(() => {
      if (currentStep > 1) {
        const prevStep = document.getElementById(`step${currentStep - 1}`);
        if (prevStep) {
          prevStep.classList.remove('active');
          prevStep.classList.add('completed');
        }
      }
      
      if (currentStep <= 4) {
        const nextStep = document.getElementById(`step${currentStep}`);
        if (nextStep) {
          nextStep.classList.add('active');
        }
        currentStep++;
      } else {
        clearInterval(this.stepInterval);
      }
    }, 1500);
  }

  // 待機画面を非表示
  hideLoadingScreen() {
    if (this.loadingOverlay) {
      document.body.removeChild(this.loadingOverlay);
      this.loadingOverlay = null;
    }
    
    if (this.stepInterval) {
      clearInterval(this.stepInterval);
      this.stepInterval = null;
    }
  }

  // 最終相談を実行
  async executeFinalConsultation() {
    if (!this.finalPrompt) {
      alert('プロンプトが生成されていません');
      return;
    }

    // 待機画面を表示
    this.showLoadingScreen();

    try {
      const response = await fetch('/api/hearing/consult', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          finalPrompt: this.finalPrompt,
          category: this.currentSession.context?.category,
          answers: this.currentAnswers
        })
      });

      const data = await response.json();
      
      // 待機画面を非表示
      this.hideLoadingScreen();
      
      if (data.success) {
        this.displayFinalResult(data.data);
      } else {
        console.error('最終相談エラー:', data.error);
        alert('最終相談の実行に失敗しました');
      }
    } catch (error) {
      // 待機画面を非表示
      this.hideLoadingScreen();
      
      console.error('最終相談エラー:', error);
      alert('最終相談の実行中にエラーが発生しました');
    }
  }

  // 最終結果を表示
  displayFinalResult(result) {
    const resultContainer = document.getElementById('hearingResult');
    
    // ヒアリングコンテキストを表示
    let html = `
      <div class="hearing-context mb-4 p-3" style="background: #e8f5e8; border-radius: 8px; border-left: 4px solid #4caf50;">
        <h6><i class="fas fa-clipboard-check me-2"></i>ヒアリング結果に基づく相談</h6>
        <small class="text-muted">段階的なヒアリングにより、以下の内容で最適化された法務相談を実行しました</small>
      </div>
    `;
    
    // 通常の相談結果を表示（displayConsultationResult関数を再利用）
    resultContainer.innerHTML = html;
    
    // 既存の表示関数を呼び出し
    const tempDiv = document.createElement('div');
    tempDiv.id = 'tempConsultationResult';
    resultContainer.appendChild(tempDiv);
    
    // 既存の関数を一時的に置き換えて呼び出し
    const originalResultDiv = document.getElementById('consultationResult');
    const tempResultDiv = document.getElementById('tempConsultationResult');
    
    // 一時的にIDを変更
    tempResultDiv.id = 'consultationResult';
    if (originalResultDiv) originalResultDiv.id = 'consultationResult_temp';
    
    // 結果を表示
    displayConsultationResult(result);
    
    // IDを元に戻す
    tempResultDiv.id = 'tempConsultationResult';
    if (originalResultDiv) originalResultDiv.id = 'consultationResult';
    
    // 進捗エリアを非表示
    document.getElementById('hearingProgress').style.display = 'none';
  }

  // ヒアリングをリセット
  resetHearing() {
    this.currentSession = null;
    this.currentAnswers = {};
    this.questionHistory = [];
    this.answeredQuestions = 0;
    
    document.getElementById('hearingContainer').style.display = 'block';
    document.getElementById('hearingProgress').style.display = 'none';
    document.getElementById('hearingResult').innerHTML = '';
    document.getElementById('hearingSummary').style.display = 'none';
  }
}

// グローバルインスタンス
const hearingManager = new HearingManager();

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
  // ヒアリング開始ボタンのイベントリスナー
  const startHearingButton = document.getElementById('startHearingButton');
  if (startHearingButton) {
    startHearingButton.addEventListener('click', function(e) {
      e.preventDefault();
      hearingManager.startHearing();
    });
  }
});