// API呼び出し用のベースURL
const API_BASE_URL = '/api';

// AIステータスの確認と表示
async function checkAIStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/ai-status`);
        const data = await response.json();
        
        if (data.success) {
            displayAIStatus(data.data);
        }
    } catch (error) {
        console.error('AI status check failed:', error);
    }
}

// AIステータスの表示
function displayAIStatus(status) {
    const statusDiv = document.getElementById('aiStatus');
    
    if (status.geminiEnabled) {
        statusDiv.innerHTML = `
            <strong>🤖 AI機能:</strong> Gemini AI 利用可能
            <span class="gemini-status gemini-enabled">法務相談・規程チェック対応</span>
        `;
        statusDiv.className = 'alert alert-success';
    } else {
        statusDiv.innerHTML = `
            <div class="ai-warning">
                <strong>⚠️ 注意:</strong> Gemini APIキーが設定されていません。AI機能が利用できません。<br>
                <small>法務相談と規程チェック機能を使用するには、.envファイルでGEMINI_API_KEYを設定してください。</small>
            </div>
        `;
        statusDiv.className = 'alert alert-warning';
    }
    
    statusDiv.style.display = 'block';
}

// ページ読み込み時にAIステータスをチェック
document.addEventListener('DOMContentLoaded', function() {
    checkAIStatus();
    
    // 法務相談ボタンのイベントリスナー設定
    const consultationButton = document.getElementById('consultationButton');
    if (consultationButton) {
        consultationButton.addEventListener('click', function(e) {
            e.preventDefault();
            submitConsultation();
        });
    }
});

// 削除: 法令検索機能は不要
// async function searchLaws() {
//     const query = document.getElementById('searchQuery').value.trim();
//     const resultsDiv = document.getElementById('searchResults');
//     
//     if (!query) {
//         resultsDiv.innerHTML = '<div class="error">検索キーワードを入力してください</div>';
//         return;
//     }
//     
//     resultsDiv.innerHTML = '<div class="loading">検索中...</div>';
//     
//     try {
//         const response = await fetch(`${API_BASE_URL}/search-laws?query=${encodeURIComponent(query)}`);
//         const data = await response.json();
//         
//         if (data.success && data.data.length > 0) {
//             displaySearchResults(data.data);
//         } else {
//             resultsDiv.innerHTML = '<div class="error">該当する法令が見つかりませんでした</div>';
//         }
//     } catch (error) {
//         console.error('検索エラー:', error);
//         resultsDiv.innerHTML = '<div class="error">検索中にエラーが発生しました</div>';
//     }
// }

// 削除: 検索結果表示機能は不要

// 削除: 法令詳細表示機能は不要

// 法令詳細モーダルを閉じる関数
function closeLawDetailModal(button) {
    button.closest('.law-detail-modal').remove();
    
    // ナレッジグラフのハイライトをリセット
    if (window.currentKnowledgeGraph) {
        window.currentKnowledgeGraph.resetHighlight();
    }
}

// 法令詳細を表示する関数
async function viewLawDetail(lawId) {
    if (!lawId) return;
    
    // ナレッジグラフがある場合はハイライト
    if (window.currentKnowledgeGraph) {
        window.currentKnowledgeGraph.highlight([lawId]);
    }
    
    // モーダルまたは新しいセクションで法令詳細を表示
    const modal = document.createElement('div');
    modal.className = 'law-detail-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background-color: #1e293b;
        color: #ffffff;
        padding: 30px;
        border-radius: 10px;
        max-width: 80%;
        max-height: 80%;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    `;
    
    modalContent.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h4>法令詳細情報</h4>
            <button onclick="closeLawDetailModal(this)" class="btn btn-sm btn-outline-light">✕ 閉じる</button>
        </div>
        <div class="loading">法令データを取得中...</div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    try {
        const response = await fetch(`${API_BASE_URL}/law-detail/${lawId}`);
        const data = await response.json();
        
        if (data.success && data.data) {
            displayLawDetailInModal(modalContent, data.data);
        } else {
            modalContent.querySelector('.loading').innerHTML = '<div class="error">法令データの取得に失敗しました</div>';
        }
    } catch (error) {
        console.error('法令詳細取得エラー:', error);
        modalContent.querySelector('.loading').innerHTML = '<div class="error">法令データの取得中にエラーが発生しました</div>';
    }
}

// モーダル内に法令詳細を表示
function displayLawDetailInModal(modalContent, lawData) {
    let html = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h4>法令詳細情報</h4>
            <button onclick="closeLawDetailModal(this)" class="btn btn-sm btn-outline-light">✕ 閉じる</button>
        </div>
    `;
    
    if (lawData.DataRoot && lawData.DataRoot.ApplData) {
        const applData = lawData.DataRoot.ApplData;
        
        html += `
            <div class="law-content">
                <h5>${applData.LawFullText?.Law?.LawName || '法令名不明'}</h5>
                <div class="mb-3">
                    <span class="badge bg-primary me-2">法令ID: ${applData.LawId || 'N/A'}</span>
                    <span class="badge bg-secondary me-2">法令番号: ${applData.LawNum || 'N/A'}</span>
                </div>
                <div class="row mb-3">
                    <div class="col-md-6">
                        <strong>公布日:</strong> ${applData.PromulgationDate || 'N/A'}
                    </div>
                    <div class="col-md-6">
                        <strong>施行日:</strong> ${applData.EnforcementDate || 'N/A'}
                    </div>
                </div>
        `;
        
        // 法令の本文があれば表示
        if (applData.LawFullText && applData.LawFullText.Law && applData.LawFullText.Law.LawBody) {
            html += '<h6 class="mt-4">法令内容:</h6>';
            html += '<div class="article-content p-3" style="background-color: rgba(255,255,255,0.05); border-radius: 5px; max-height: 400px; overflow-y: auto;">';
            html += formatLawContent(applData.LawFullText.Law.LawBody);
            html += '</div>';
        }
        
        html += '</div>';
    } else {
        html += '<div class="error">法令データの構造が予期されるものと異なります</div>';
    }
    
    modalContent.innerHTML = html;
}

// 法令内容のフォーマット（簡易版）
function formatLawContent(lawBody) {
    // 実際の実装では、XMLの構造に応じてより詳細な解析が必要
    if (typeof lawBody === 'string') {
        return lawBody.replace(/\n/g, '<br>');
    } else if (typeof lawBody === 'object') {
        // オブジェクトの場合は整形して表示
        return '<pre>' + JSON.stringify(lawBody, null, 2) + '</pre>';
    }
    return '内容の表示ができませんでした';
}

// 法務相談機能
async function submitConsultation() {
    const question = document.getElementById('consultationQuery').value.trim();
    const resultDiv = document.getElementById('consultationResult');
    
    if (!question) {
        resultDiv.innerHTML = '<div class="error">質問を入力してください</div>';
        return;
    }
    
    // 待機画面を表示
    showDirectLoadingScreen();
    
    try {
        const response = await fetch(`${API_BASE_URL}/consult`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question })
        });
        
        const data = await response.json();
        
        // 待機画面を非表示
        hideDirectLoadingScreen();
        
        if (data.success) {
            displayConsultationResult(data.data);
        } else {
            resultDiv.innerHTML = '<div class="error">相談処理に失敗しました</div>';
        }
    } catch (error) {
        // 待機画面を非表示
        hideDirectLoadingScreen();
        
        console.error('相談エラー:', error);
        resultDiv.innerHTML = '<div class="error">相談中にエラーが発生しました</div>';
    }
}

// 直接入力用の待機画面
function showDirectLoadingScreen() {
    const overlay = document.createElement('div');
    overlay.className = 'ai-loading-overlay';
    overlay.id = 'directLoadingOverlay';
    
    overlay.innerHTML = `
      <div class="ai-loading-content">
        <div class="ai-loading-spinner"></div>
        <h4>🤖 AI法務相談を実行中...</h4>
        <p>少々お待ちください</p>
        
        <ul class="ai-loading-steps">
          <li id="direct-step1" class="active">
            <i class="fas fa-search"></i>関連法令を検索中...
          </li>
          <li id="direct-step2">
            <i class="fas fa-brain"></i>AI分析を実行中...
          </li>
          <li id="direct-step3">
            <i class="fas fa-file-alt"></i>法的アドバイスを生成中...
          </li>
          <li id="direct-step4">
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
    
    // ステップのアニメーション
    startDirectLoadingSteps();
}

function startDirectLoadingSteps() {
    let currentStep = 1;
    
    const stepInterval = setInterval(() => {
        if (currentStep > 1) {
            const prevStep = document.getElementById(`direct-step${currentStep - 1}`);
            if (prevStep) {
                prevStep.classList.remove('active');
                prevStep.classList.add('completed');
            }
        }
        
        if (currentStep <= 4) {
            const nextStep = document.getElementById(`direct-step${currentStep}`);
            if (nextStep) {
                nextStep.classList.add('active');
            }
            currentStep++;
        } else {
            clearInterval(stepInterval);
        }
    }, 1500);
}

function hideDirectLoadingScreen() {
    const overlay = document.getElementById('directLoadingOverlay');
    if (overlay) {
        document.body.removeChild(overlay);
    }
}

// 相談結果の表示
function displayConsultationResult(result) {
    const resultDiv = document.getElementById('consultationResult');
    
    // 既存のナレッジグラフをクリア
    if (window.currentKnowledgeGraph) {
        console.log('Clearing existing knowledge graph');
        window.currentKnowledgeGraph.destroy();
        window.currentKnowledgeGraph = null;
    }
    
    // AI生成回答かどうかで表示スタイルを変更
    const responseClass = result.aiGenerated ? 'ai-response' : 'basic-response';
    const titlePrefix = result.aiGenerated ? '🤖 Gemini AI法務相談回答:' : '基本的な法務相談回答:';
    
    let html = `
        <div class="${responseClass}">
            <h5>${titlePrefix}</h5>
    `;
    
    // 拡張されたクエリを表示（AIの場合）
    if (result.aiGenerated && result.expandedQuery && result.expandedQuery !== result.question) {
        html += `
            <div class="mb-3 p-2" style="background-color: rgba(255,255,255,0.1); border-radius: 0.375rem;">
                <small><strong>AI拡張検索クエリ:</strong> ${result.expandedQuery}</small>
            </div>
        `;
    }
    
    html += `
            <div class="response-content">
                ${result.response.replace(/\n/g, '<br>')}
            </div>
    `;
    
    // 参照された法令の表示（新機能）
    if (result.referencedLaws && result.referencedLaws.length > 0) {
        html += `
            <div class="mt-4 p-3" style="background-color: rgba(14, 165, 233, 0.15); border-radius: 0.5rem; border: 1px solid rgba(14, 165, 233, 0.3);">
                <h6 style="color: #0ea5e9; margin-bottom: 10px;">📚 回答で参照した法令:</h6>
                <ul class="referenced-laws-list" style="margin-bottom: 0;">
        `;
        result.referencedLaws.forEach(law => {
            html += `
                <li style="color: #ffffff; margin-bottom: 5px;">
                    <strong>${law.lawName}</strong>
                    ${law.lawNo ? `<span style="color: #94a3b8;"> (${law.lawNo})</span>` : ''}
                    ${law.lawId ? `<a href="#" onclick="viewLawDetail('${law.lawId}')" style="color: #0ea5e9; margin-left: 10px; font-size: 0.9em;">[詳細を見る]</a>` : ''}
                </li>
            `;
        });
        html += `
                </ul>
            </div>
        `;
    }
    
    // 検索された関連法令一覧
    if (result.relevantLaws && result.relevantLaws.length > 0) {
        html += `
            <div class="mt-3">
                <h6>検索された関連法令一覧:</h6>
                <div style="max-height: 200px; overflow-y: auto;">
                    <ul style="font-size: 0.9em;">
        `;
        result.relevantLaws.forEach(law => {
            const isReferenced = result.referencedLaws && result.referencedLaws.some(ref => ref.lawId === law.LawId);
            const linkStyle = isReferenced 
                ? `color: #0ea5e9; font-weight: bold;` 
                : `color: ${result.aiGenerated ? '#94a3b8' : '#007bff'};`;
            html += `
                <li>
                    <a href="#" onclick="viewLawDetail('${law.LawId}')" style="${linkStyle}">
                        ${law.LawName}
                        ${isReferenced ? ' ✓' : ''}
                    </a>
                </li>
            `;
        });
        html += `
                    </ul>
                </div>
            </div>
        `;
    }
    
    // ナレッジグラフの表示
    console.log('Checking knowledge graph:', result.knowledgeGraph);
    const graphId = `knowledgeGraphVisualization_${Date.now()}`;
    if (result.knowledgeGraph && result.knowledgeGraph.nodes && result.knowledgeGraph.nodes.length > 0) {
        html += `
            <div class="mt-4">
                <h6>📊 法令関係性のナレッジグラフ:</h6>
                <div class="knowledge-graph-container" style="background-color: rgba(255,255,255,0.05); border-radius: 0.5rem; padding: 10px; margin-top: 10px;">
                    <div id="${graphId}" style="width: 100%; height: 600px; background-color: white; border-radius: 0.5rem;"></div>
                </div>
                <div class="mt-2" style="font-size: 0.9em; color: #94a3b8;">
                    <p>グラフの見方：</p>
                    <ul style="font-size: 0.9em;">
                        <li><strong>大きな円：</strong>法令全体を表します。大きさは法令の重要度を示します。</li>
                        <li><strong>小さな円：</strong>個別の条項を表します。薄い色で表示されます。</li>
                        <li><strong>線の種類：</strong>
                            <ul style="margin-top: 5px;">
                                <li>黄色：法令と条項の包含関係</li>
                                <li>紫色：条項間の関連性</li>
                                <li>緑色：条項間の補完関係</li>
                                <li>その他：法令間の関係性</li>
                            </ul>
                        </li>
                        <li><strong>操作：</strong>
                            <ul style="margin-top: 3px;">
                                <li>ドラッグ：ノードの配置を調整</li>
                                <li>マウスホイール：ズームイン・アウト</li>
                                <li>ホバー：詳細情報を表示</li>
                                <li><strong>クリック：e-Gov法令サイトを新しいタブで開く</strong></li>
                            </ul>
                        </li>
                    </ul>
                </div>
            </div>
        `;
    }
    
    // 免責事項
    if (result.disclaimer) {
        const disclaimerClass = result.aiGenerated ? 'mt-3 p-2' : 'alert alert-warning mt-3';
        const disclaimerStyle = result.aiGenerated ? 'background-color: rgba(255,255,255,0.2); border-radius: 0.375rem; font-size: 0.9em; color: #ffffff;' : 'font-size: 0.9em;';
        html += `
            <div class="${disclaimerClass}" style="${disclaimerStyle}">
                <strong>免責事項:</strong> ${result.disclaimer}
            </div>
        `;
    }
    
    html += `</div>`;
    
    resultDiv.innerHTML = html;
    
    // ナレッジグラフを描画
    if (result.knowledgeGraph && result.knowledgeGraph.nodes && result.knowledgeGraph.nodes.length > 0) {
        console.log('Knowledge graph data received:', result.knowledgeGraph);
        setTimeout(() => {
            console.log('Creating knowledge graph visualization with ID:', graphId);
            try {
                const graphViz = new KnowledgeGraphVisualization(graphId);
                graphViz.init();
                graphViz.render(result.knowledgeGraph);
                
                // グローバルに保存（法令詳細表示用）
                window.currentKnowledgeGraph = graphViz;
                console.log('Knowledge graph rendered successfully');
            } catch (error) {
                console.error('Error rendering knowledge graph:', error);
            }
        }, 100);
    } else {
        console.log('No knowledge graph data to render');
    }
}


// 削除: 法令検索は不要
// document.getElementById('searchQuery').addEventListener('keypress', function(e) {
//     if (e.key === 'Enter') {
//         searchLaws();
//     }
// });

document.getElementById('consultationQuery').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && e.ctrlKey) {
        submitConsultation();
    }
});

// 削除: 契約書レビュー機能は不要
// async function reviewContract() {
//     const contractText = document.getElementById('contractText').value.trim();
//     const reviewPoints = document.getElementById('reviewPoints').value.trim();
//     const resultDiv = document.getElementById('contractReviewResult');
//     
//     if (!contractText) {
//         resultDiv.innerHTML = '<div class="error">契約書の内容を入力してください</div>';
//         return;
//     }
//     
//     resultDiv.innerHTML = '<div class="loading">🤖 Gemini-Proで契約書をレビュー中...</div>';
//     
//     try {
//         const requestBody = { contractText };
//         if (reviewPoints) {
//             requestBody.reviewPoints = reviewPoints.split(',').map(p => p.trim()).filter(p => p);
//         }
//         
//         const response = await fetch(`${API_BASE_URL}/review-contract`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify(requestBody)
//         });
//         
//         const data = await response.json();
//         
//         if (data.success) {
//             displayContractReview(data.data.review);
//         } else {
//             resultDiv.innerHTML = `<div class="error">${data.error}</div>`;
//         }
//     } catch (error) {
//         console.error('契約書レビューエラー:', error);
//         resultDiv.innerHTML = '<div class="error">契約書レビュー中にエラーが発生しました</div>';
//     }
// }

// 削除: 契約書レビュー結果表示は不要
// function displayContractReview(review) {
//     const resultDiv = document.getElementById('contractReviewResult');
//     
//     const html = `
//         <div class="ai-response">
//             <h5>🤖 Gemini-Pro 契約書レビュー結果:</h5>
//             <div class="response-content">
//                 ${review.replace(/\n/g, '<br>')}
//             </div>
//             <div class="mt-3 p-2" style="background-color: rgba(255,255,255,0.2); border-radius: 0.375rem; font-size: 0.9em;">
//                 <strong>重要:</strong> このレビューは参考情報です。正式な契約前には必ず専門弁護士の確認を受けてください。
//             </div>
//         </div>
//     `;
//     
//     resultDiv.innerHTML = html;
// }

// 削除: 法令解釈支援機能は不要
// async function interpretLaw() {
//     const lawContent = document.getElementById('lawContentForInterpretation').value.trim();
//     const question = document.getElementById('interpretationQuestion').value.trim();
//     const resultDiv = document.getElementById('interpretationResult');
//     
//     if (!lawContent || !question) {
//         resultDiv.innerHTML = '<div class="error">法令内容と質問の両方を入力してください</div>';
//         return;
//     }
//     
//     resultDiv.innerHTML = '<div class="loading">🤖 Gemini-Proで法令を解釈中...</div>';
//     
//     try {
//         const response = await fetch(`${API_BASE_URL}/interpret-law`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify({
//                 lawContent,
//                 question
//             })
//         });
//         
//         const data = await response.json();
//         
//         if (data.success) {
//             displayLawInterpretation(data.data.interpretation);
//         } else {
//             resultDiv.innerHTML = `<div class="error">${data.error}</div>`;
//         }
//     } catch (error) {
//         console.error('法令解釈エラー:', error);
//         resultDiv.innerHTML = '<div class="error">法令解釈中にエラーが発生しました</div>';
//     }
// }

// 削除: 法令解釈結果表示は不要
// function displayLawInterpretation(interpretation) {
//     const resultDiv = document.getElementById('interpretationResult');
//     
//     const html = `
//         <div class="ai-response">
//             <h5>🤖 Gemini-Pro 法令解釈:</h5>
//             <div class="response-content">
//                 ${interpretation.replace(/\n/g, '<br>')}
//             </div>
//             <div class="mt-3 p-2" style="background-color: rgba(255,255,255,0.2); border-radius: 0.375rem; font-size: 0.9em;">
//                 <strong>注意:</strong> この解釈は一般的な参考情報です。具体的な適用については専門家にご相談ください。
//             </div>
//         </div>
//     `;
//     
//     resultDiv.innerHTML = html;
// }