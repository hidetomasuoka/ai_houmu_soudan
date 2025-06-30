// プロンプトチューニング機能のJavaScript

const API_BASE_URL = '/api';
let currentPrompts = {};
let currentPromptId = null;
let unsavedChanges = false;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', async function() {
    await loadPrompts();
});

// プロンプト一覧の読み込み
async function loadPrompts() {
    try {
        const response = await fetch(`${API_BASE_URL}/prompts`);
        const data = await response.json();
        
        if (data.success) {
            currentPrompts = data.data;
            displayPromptList();
        } else {
            showError('プロンプトの読み込みに失敗しました: ' + data.error);
        }
    } catch (error) {
        console.error('プロンプト読み込みエラー:', error);
        showError('プロンプトの読み込み中にエラーが発生しました');
    }
}

// プロンプト一覧の表示
function displayPromptList() {
    const listContainer = document.getElementById('promptList');
    let html = '';
    
    Object.keys(currentPrompts).forEach(promptId => {
        const prompt = currentPrompts[promptId];
        const isModified = hasPromptBeenModified(prompt);
        
        html += `
            <div class="prompt-list-item ${currentPromptId === promptId ? 'active' : ''}" 
                 onclick="selectPrompt('${promptId}')">
                <div class="d-flex align-items-center">
                    <span class="status-indicator ${isModified ? 'status-modified' : 'status-default'}"></span>
                    <div class="flex-grow-1">
                        <div class="fw-bold">${prompt.name}</div>
                        <div class="small text-muted">${prompt.description}</div>
                        <span class="prompt-category category-${prompt.category}">
                            ${getCategoryLabel(prompt.category)}
                        </span>
                    </div>
                </div>
                <div class="small text-muted mt-1">
                    更新: ${new Date(prompt.lastModified).toLocaleDateString()}
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
}

// プロンプトの選択
async function selectPrompt(promptId) {
    if (unsavedChanges) {
        if (!confirm('未保存の変更があります。破棄して続行しますか？')) {
            return;
        }
    }
    
    currentPromptId = promptId;
    const prompt = currentPrompts[promptId];
    
    if (prompt) {
        displayPromptEditor(prompt);
        displayPromptList(); // アクティブ状態を更新
        unsavedChanges = false;
    }
}

// プロンプト編集画面の表示
function displayPromptEditor(prompt) {
    document.getElementById('noPromptSelected').style.display = 'none';
    document.getElementById('promptEditor').style.display = 'block';
    
    // 基本情報の表示
    document.getElementById('promptTitle').textContent = prompt.name;
    document.getElementById('promptDescription').textContent = prompt.description;
    
    // フォームの入力値設定
    document.getElementById('promptName').value = prompt.name;
    document.getElementById('promptDescriptionEdit').value = prompt.description;
    document.getElementById('promptCategory').value = prompt.category;
    document.getElementById('promptTemplate').value = prompt.template;
    
    // 利用可能変数の表示
    displayAvailableVariables(prompt.variables);
    
    // 変数一覧の表示
    displayVariablesList(prompt.variables);
    
    // 入力イベントリスナーの設定
    setupInputListeners();
}

// 利用可能変数の表示
function displayAvailableVariables(variables) {
    const container = document.getElementById('availableVariables');
    let html = '';
    
    if (variables && variables.length > 0) {
        variables.forEach(variable => {
            html += `<span class="variable-tag">{${variable.name}}</span>`;
        });
    } else {
        html = '<span class="text-muted">変数が定義されていません</span>';
    }
    
    container.innerHTML = html;
}

// 変数一覧の表示
function displayVariablesList(variables) {
    const container = document.getElementById('variablesList');
    let html = '';
    
    if (variables && variables.length > 0) {
        variables.forEach((variable, index) => {
            html += `
                <div class="variable-input border rounded p-3 mb-3">
                    <div class="row">
                        <div class="col-md-3">
                            <label class="form-label">変数名</label>
                            <input type="text" class="form-control" value="${variable.name}" 
                                   onchange="updateVariable(${index}, 'name', this.value)">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">説明</label>
                            <input type="text" class="form-control" value="${variable.description}" 
                                   onchange="updateVariable(${index}, 'description', this.value)">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">必須</label>
                            <select class="form-select" onchange="updateVariable(${index}, 'required', this.value === 'true')">
                                <option value="true" ${variable.required ? 'selected' : ''}>はい</option>
                                <option value="false" ${!variable.required ? 'selected' : ''}>いいえ</option>
                            </select>
                        </div>
                        <div class="col-md-1">
                            <label class="form-label">&nbsp;</label>
                            <button class="btn btn-outline-danger btn-sm d-block" onclick="removeVariable(${index})">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        html = '<p class="text-muted">変数が定義されていません。「変数を追加」ボタンで変数を追加できます。</p>';
    }
    
    container.innerHTML = html;
}

// 入力監視の設定
function setupInputListeners() {
    const inputs = ['promptName', 'promptDescriptionEdit', 'promptCategory', 'promptTemplate'];
    
    inputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        if (element) {
            element.addEventListener('input', () => {
                unsavedChanges = true;
                updateAvailableVariables();
            });
        }
    });
}

// 利用可能変数の更新（テンプレートから変数を抽出）
function updateAvailableVariables() {
    const template = document.getElementById('promptTemplate').value;
    const variableMatches = template.match(/\{([^}]+)\}/g) || [];
    const variables = variableMatches.map(match => match.slice(1, -1));
    
    // 重複除去
    const uniqueVariables = [...new Set(variables)];
    
    let html = '';
    uniqueVariables.forEach(variable => {
        html += `<span class="variable-tag">{${variable}}</span>`;
    });
    
    document.getElementById('availableVariables').innerHTML = html || 
        '<span class="text-muted">変数が検出されませんでした</span>';
}

// 変数の追加
function addVariable() {
    const prompt = currentPrompts[currentPromptId];
    if (!prompt.variables) {
        prompt.variables = [];
    }
    
    prompt.variables.push({
        name: 'new_variable',
        description: '新しい変数',
        required: false
    });
    
    displayVariablesList(prompt.variables);
    unsavedChanges = true;
}

// 変数の更新
function updateVariable(index, field, value) {
    const prompt = currentPrompts[currentPromptId];
    if (prompt.variables && prompt.variables[index]) {
        prompt.variables[index][field] = value;
        unsavedChanges = true;
        
        if (field === 'name') {
            displayAvailableVariables(prompt.variables);
        }
    }
}

// 変数の削除
function removeVariable(index) {
    if (confirm('この変数を削除しますか？')) {
        const prompt = currentPrompts[currentPromptId];
        if (prompt.variables) {
            prompt.variables.splice(index, 1);
            displayVariablesList(prompt.variables);
            displayAvailableVariables(prompt.variables);
            unsavedChanges = true;
        }
    }
}

// プレビューの生成
async function generatePreview() {
    const template = document.getElementById('promptTemplate').value;
    
    if (!template.trim()) {
        showError('プロンプトテンプレートを入力してください');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/prompts/preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                template: template,
                sampleVariables: {} // デフォルトサンプルを使用
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('promptPreview').textContent = data.data.preview;
        } else {
            showError('プレビュー生成に失敗しました: ' + data.error);
        }
    } catch (error) {
        console.error('プレビュー生成エラー:', error);
        showError('プレビュー生成中にエラーが発生しました');
    }
}

// プロンプトの保存
async function savePrompt() {
    if (!currentPromptId) {
        showError('保存するプロンプトが選択されていません');
        return;
    }
    
    // フォームデータの収集
    const updatedPrompt = {
        name: document.getElementById('promptName').value.trim(),
        description: document.getElementById('promptDescriptionEdit').value.trim(),
        category: document.getElementById('promptCategory').value,
        template: document.getElementById('promptTemplate').value.trim(),
        variables: currentPrompts[currentPromptId].variables || []
    };
    
    // 基本検証
    if (!updatedPrompt.name) {
        showError('プロンプト名を入力してください');
        return;
    }
    
    if (!updatedPrompt.template) {
        showError('プロンプトテンプレートを入力してください');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/prompts/${currentPromptId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedPrompt)
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentPrompts[currentPromptId] = data.data;
            unsavedChanges = false;
            displayPromptList();
            showSuccess('プロンプトを保存しました');
        } else {
            showError('保存に失敗しました: ' + data.error);
            if (data.details) {
                showError('詳細: ' + data.details.join(', '));
            }
        }
    } catch (error) {
        console.error('保存エラー:', error);
        showError('保存中にエラーが発生しました');
    }
}

// プロンプトのリセット
async function resetPrompt() {
    if (!currentPromptId) {
        return;
    }
    
    if (!confirm('このプロンプトをデフォルト設定にリセットしますか？未保存の変更は失われます。')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/prompts/${currentPromptId}/reset`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentPrompts[currentPromptId] = data.data;
            displayPromptEditor(data.data);
            displayPromptList();
            unsavedChanges = false;
            showSuccess('プロンプトをリセットしました');
        } else {
            showError('リセットに失敗しました: ' + data.error);
        }
    } catch (error) {
        console.error('リセットエラー:', error);
        showError('リセット中にエラーが発生しました');
    }
}

// プロンプト設定のエクスポート
async function exportPrompts() {
    try {
        const response = await fetch(`${API_BASE_URL}/prompts/export`);
        const data = await response.json();
        
        if (data.success || data.exportDate) { // エクスポートデータの場合
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `prompts-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showSuccess('プロンプト設定をエクスポートしました');
        } else {
            showError('エクスポートに失敗しました');
        }
    } catch (error) {
        console.error('エクスポートエラー:', error);
        showError('エクスポート中にエラーが発生しました');
    }
}

// インポートモーダルの表示
function showImportModal() {
    const modal = new bootstrap.Modal(document.getElementById('importModal'));
    modal.show();
}

// プロンプト設定のインポート実行
async function executeImport() {
    const fileInput = document.getElementById('importFile');
    const jsonInput = document.getElementById('importJson');
    
    let importData = null;
    
    // ファイルからのインポート
    if (fileInput.files.length > 0) {
        try {
            const file = fileInput.files[0];
            const text = await file.text();
            importData = JSON.parse(text);
        } catch (error) {
            showError('ファイルの読み込みに失敗しました: ' + error.message);
            return;
        }
    }
    // テキストからのインポート
    else if (jsonInput.value.trim()) {
        try {
            importData = JSON.parse(jsonInput.value);
        } catch (error) {
            showError('JSON形式が正しくありません: ' + error.message);
            return;
        }
    } else {
        showError('インポートするデータを指定してください');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/prompts/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(importData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadPrompts(); // プロンプト一覧を再読み込み
            
            // モーダルを閉じる
            const modal = bootstrap.Modal.getInstance(document.getElementById('importModal'));
            modal.hide();
            
            // フォームをクリア
            fileInput.value = '';
            jsonInput.value = '';
            
            showSuccess('プロンプト設定をインポートしました');
        } else {
            showError('インポートに失敗しました: ' + data.error);
        }
    } catch (error) {
        console.error('インポートエラー:', error);
        showError('インポート中にエラーが発生しました');
    }
}

// ユーティリティ関数

function getCategoryLabel(category) {
    const labels = {
        consultation: '法務相談',
        contract: '契約書',
        interpretation: '法令解釈',
        compliance: 'コンプライアンス'
    };
    return labels[category] || category;
}

function hasPromptBeenModified(prompt) {
    // 実装では、デフォルトプロンプトとの比較などで判定
    // 簡易実装として、常にfalseを返す
    return false;
}

function showSuccess(message) {
    // 簡易的な成功メッセージ表示
    alert('✅ ' + message);
}

function showError(message) {
    // 簡易的なエラーメッセージ表示
    alert('❌ ' + message);
}

// ページ離脱時の確認
window.addEventListener('beforeunload', function(e) {
    if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});