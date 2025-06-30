class KnowledgeGraphVisualization {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = null;
    this.svg = null;
    this.simulation = null;
    this.tooltip = null;
    this.width = 800;
    this.height = 600;
    this.colorScale = d3.scaleOrdinal(d3.schemeCategory10);
  }

  init() {
    console.log('Initializing knowledge graph visualization for container:', this.containerId);
    this.container = d3.select(`#${this.containerId}`);
    
    if (!this.container.node()) {
      console.error('Container not found:', this.containerId);
      return;
    }
    
    // コンテナのサイズを取得
    const rect = this.container.node().getBoundingClientRect();
    this.width = rect.width || 800;
    this.height = rect.height || 600;
    console.log('Container size:', this.width, 'x', this.height);
    
    // SVGを作成
    this.svg = this.container.append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');
    
    // ズーム機能を追加
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        this.svg.select('.graph-container').attr('transform', event.transform);
      });
    
    this.svg.call(zoom);
    
    // グラフコンテナ
    this.svg.append('g').attr('class', 'graph-container');
    
    // ツールチップ
    this.tooltip = d3.select('body').append('div')
      .attr('class', 'knowledge-graph-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '10px')
      .style('border-radius', '5px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('max-width', '300px');
    
    // 矢印マーカーの定義
    this.defineArrowMarkers();
  }

  defineArrowMarkers() {
    const defs = this.svg.append('defs');
    
    // 関係性タイプごとの矢印を定義
    const markerTypes = [
      { id: 'arrow-default', color: '#666' },
      { id: 'arrow-references', color: '#4CAF50' },
      { id: 'arrow-amends', color: '#2196F3' },
      { id: 'arrow-conflicts', color: '#F44336' },
      { id: 'arrow-related', color: '#9C27B0' }
    ];
    
    markerTypes.forEach(marker => {
      defs.append('marker')
        .attr('id', marker.id)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 25)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', marker.color);
    });
  }

  render(graphData) {
    console.log('Rendering knowledge graph with data:', graphData);
    
    if (!graphData || !graphData.nodes || !graphData.edges) {
      console.error('Invalid graph data');
      return;
    }
    
    if (graphData.nodes.length === 0) {
      console.warn('No nodes to render');
      return;
    }
    
    // 既存のグラフをクリア
    this.svg.select('.graph-container').selectAll('*').remove();
    
    const container = this.svg.select('.graph-container');
    
    // Force simulationを作成（ノード数に応じて調整）
    const nodeCount = graphData.nodes.length;
    const linkDistance = Math.max(80, 150 - nodeCount * 5); // ノードが多いほど短く
    const chargeStrength = Math.min(-200, -50 - nodeCount * 10); // ノードが多いほど弱く
    
    this.simulation = d3.forceSimulation(graphData.nodes)
      .force('link', d3.forceLink(graphData.edges)
        .id(d => d.id)
        .distance(linkDistance)
        .strength(0.1))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius(d => this.getNodeRadius(d) + 5))
      .force('x', d3.forceX(this.width / 2).strength(0.1))
      .force('y', d3.forceY(this.height / 2).strength(0.1));
    
    // エッジを描画
    const links = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(graphData.edges)
      .enter().append('line')
      .attr('class', 'link')
      .attr('stroke', d => this.getEdgeColor(d.type))
      .attr('stroke-width', d => Math.sqrt(d.weight) * 2)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', d => `url(#${this.getArrowMarker(d.type)})`);
    
    // ノードグループを作成
    const nodeGroups = container.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(graphData.nodes)
      .enter().append('g')
      .attr('class', 'node-group')
      .call(this.drag());
    
    // ノード（円）を追加
    nodeGroups.append('circle')
      .attr('class', 'node')
      .attr('r', d => this.getNodeRadius(d))
      .attr('fill', d => this.getNodeColor(d))
      .attr('stroke', d => this.getNodeStroke(d))
      .attr('stroke-width', d => this.getNodeStrokeWidth(d))
      .on('mouseover', (event, d) => this.showTooltip(event, d))
      .on('mouseout', () => this.hideTooltip())
      .on('click', (event, d) => this.onNodeClick(event, d));
    
    // ノードラベルを追加
    nodeGroups.append('text')
      .attr('class', 'node-label')
      .attr('dx', 0)
      .attr('dy', d => -this.getNodeRadius(d) - 3)
      .attr('text-anchor', 'middle')
      .style('font-size', d => d.nodeType === 'article' ? '10px' : '11px')
      .style('font-weight', d => d.nodeType === 'article' ? 'normal' : 'bold')
      .style('fill', '#333')
      .text(d => this.truncateLabel(d.label, d.nodeType === 'article' ? 15 : 18));
    
    // シミュレーションを更新
    this.simulation.on('tick', () => {
      links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // 凡例を追加
    this.addLegend(graphData);
  }

  getNodeRadius(node) {
    if (node.nodeType === 'article') {
      return 6; // 条項ノードは小さく
    } else {
      // 法令ノードのサイズをより適切に調整
      const baseSize = Math.min(node.size * 8, 20); // 最大20に制限
      return Math.max(baseSize, 10); // 最小10に制限
    }
  }

  getNodeColor(node) {
    if (node.nodeType === 'article') {
      // 条項ノードは薄い色で表示
      const baseColor = this.colorScale(node.group);
      return this.lightenColor(baseColor, 0.3);
    } else {
      // 法令ノードは通常の色
      return this.colorScale(node.group);
    }
  }

  getNodeStroke(node) {
    if (node.nodeType === 'article') {
      return this.colorScale(node.group); // 条項は境界線を濃く
    } else {
      return '#fff'; // 法令は白い境界線
    }
  }

  getNodeStrokeWidth(node) {
    if (node.nodeType === 'article') {
      return 1.5;
    } else {
      return 3;
    }
  }

  lightenColor(color, factor) {
    // 色を明るくする関数
    const rgb = d3.rgb(color);
    return d3.rgb(
      Math.min(255, rgb.r + (255 - rgb.r) * factor),
      Math.min(255, rgb.g + (255 - rgb.g) * factor),
      Math.min(255, rgb.b + (255 - rgb.b) * factor)
    ).toString();
  }

  getEdgeColor(type) {
    const colors = {
      '参照': '#4CAF50',
      '改正': '#2196F3',
      '廃止・代替': '#FF9800',
      '施行': '#00BCD4',
      '関連': '#9C27B0',
      '下位法令': '#607D8B',
      '上位法令': '#795548',
      '矛盾・齟齬': '#F44336',
      '補完': '#8BC34A',
      'CONTAINS': '#FFC107'
    };
    
    return colors[type] || '#666';
  }

  getArrowMarker(type) {
    const markerMap = {
      '参照': 'arrow-references',
      '改正': 'arrow-amends',
      '矛盾・齟齬': 'arrow-conflicts',
      '関連': 'arrow-related'
    };
    
    return markerMap[type] || 'arrow-default';
  }

  drag() {
    function dragstarted(event, d) {
      if (!event.active) this.simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) this.simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    
    return d3.drag()
      .on('start', dragstarted.bind(this))
      .on('drag', dragged)
      .on('end', dragended.bind(this));
  }

  showTooltip(event, d) {
    let content;
    
    if (d.nodeType === 'article') {
      content = `
        <strong>${d.label}</strong><br/>
        <strong>条項タイトル:</strong> ${d.data.articleTitle}<br/>
        <strong>条項番号:</strong> 第${d.data.articleNumber}条<br/>
        <strong>所属法令:</strong> ${d.data.lawName}<br/>
        <strong>内容:</strong><br/>
        <div style="max-width: 250px; font-size: 11px; margin-top: 5px;">
          ${d.data.articleContent}
        </div>
        ${d.data.keywords && d.data.keywords.length > 0 ? 
          `<br/><strong>キーワード:</strong> ${d.data.keywords.join(', ')}` : ''}
        <br/><br/><small style="color: #88c999;">🔗 クリックでe-Gov法令サイトを開く</small>
      `;
    } else {
      content = `
        <strong>${d.label}</strong><br/>
        タイプ: ${this.getLawTypeLabel(d.data.lawType || d.type)}<br/>
        カテゴリ: ${this.getCategoryLabel(d.group)}<br/>
        ${d.data.lawNo ? `法令番号: ${d.data.lawNo}<br/>` : ''}
        ${d.data.promulgationDate ? `公布日: ${d.data.promulgationDate}<br/>` : ''}
        ${d.data.enforcementDate ? `施行日: ${d.data.enforcementDate}<br/>` : ''}
        <br/><small style="color: #88c999;">🔗 クリックでe-Gov法令サイトを開く</small>
      `;
    }
    
    this.tooltip.transition()
      .duration(200)
      .style('opacity', .9);
    
    this.tooltip.html(content)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 28) + 'px');
  }

  hideTooltip() {
    this.tooltip.transition()
      .duration(500)
      .style('opacity', 0);
  }

  onNodeClick(event, d) {
    // ノードクリック時のイベント
    console.log('Node clicked:', d);
    
    // e-Gov URLを開く
    const eGovUrl = this.getEGovUrl(d);
    if (eGovUrl) {
      console.log('Opening e-Gov URL:', eGovUrl);
      window.open(eGovUrl, '_blank', 'noopener,noreferrer');
    } else {
      console.warn('No e-Gov URL available for node:', d.id);
      // フォールバック: 法令名で検索
      if (d.data && (d.data.lawName || d.label)) {
        const searchTerm = d.data.lawName || d.label;
        const searchUrl = `https://laws.e-gov.go.jp/search/elawsSearch/elaws_search/lsg0100/?lawName=${encodeURIComponent(searchTerm)}`;
        window.open(searchUrl, '_blank', 'noopener,noreferrer');
      }
    }
  }

  getEGovUrl(node) {
    if (!node.data) return null;
    
    // 明示的に設定されたe-Gov URLを優先
    if (node.data.eGovUrl) {
      return node.data.eGovUrl;
    }
    
    // 法令番号ベースのURLを次に試す
    if (node.data.eGovUrlFromLawNo) {
      return node.data.eGovUrlFromLawNo;
    }
    
    // 条項ノードの場合は法令URLにアンカーを追加
    if (node.nodeType === 'article' && node.data.lawId && node.data.articleNumber) {
      return `https://laws.e-gov.go.jp/law/${node.data.lawId}#${node.data.articleNumber}`;
    }
    
    // 法令ノードの場合は法令IDベースのURL
    if (node.nodeType === 'law' && node.data.lawId) {
      return `https://laws.e-gov.go.jp/law/${node.data.lawId}`;
    }
    
    return null;
  }

  truncateLabel(label, maxLength) {
    if (label.length > maxLength) {
      return label.substring(0, maxLength) + '...';
    }
    return label;
  }

  getLawTypeLabel(type) {
    const labels = {
      'constitution': '憲法',
      'law': '法律',
      'cabinet_order': '政令',
      'ministerial_ordinance': '省令',
      'ordinance': '条例',
      'rule': '規則',
      'notification': '告示',
      'other': 'その他'
    };
    
    return labels[type] || type;
  }

  getCategoryLabel(category) {
    const labels = {
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
    
    return labels[category] || category;
  }

  addLegend(graphData) {
    const legendContainer = this.svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${this.width - 150}, 20)`);
    
    // 背景を追加
    legendContainer.append('rect')
      .attr('x', -10)
      .attr('y', -10)
      .attr('width', 140)
      .attr('height', 200)
      .attr('fill', 'white')
      .attr('stroke', '#ccc')
      .attr('rx', 5);
    
    // タイトル
    legendContainer.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('関係性の凡例');
    
    // 使用されている関係性タイプを取得
    const usedTypes = [...new Set(graphData.edges.map(e => e.type))];
    
    usedTypes.forEach((type, i) => {
      const y = 25 + i * 20;
      
      // 線
      legendContainer.append('line')
        .attr('x1', 0)
        .attr('y1', y)
        .attr('x2', 30)
        .attr('y2', y)
        .attr('stroke', this.getEdgeColor(type))
        .attr('stroke-width', 2);
      
      // ラベル
      legendContainer.append('text')
        .attr('x', 35)
        .attr('y', y + 4)
        .style('font-size', '12px')
        .text(type);
    });
  }

  updateSize() {
    const rect = this.container.node().getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    
    this.svg
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', `0 0 ${this.width} ${this.height}`);
    
    if (this.simulation) {
      this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
      this.simulation.alpha(0.3).restart();
    }
  }

  highlight(nodeIds) {
    // 特定のノードをハイライト
    this.svg.selectAll('.node')
      .style('opacity', d => nodeIds.includes(d.id) ? 1 : 0.3);
    
    this.svg.selectAll('.link')
      .style('opacity', d => 
        nodeIds.includes(d.source.id) || nodeIds.includes(d.target.id) ? 1 : 0.1
      );
  }

  resetHighlight() {
    this.svg.selectAll('.node').style('opacity', 1);
    this.svg.selectAll('.link').style('opacity', 0.6);
  }

  clear() {
    // グラフ内容をクリアするが、SVGコンテナは保持
    if (this.svg) {
      this.svg.select('.graph-container').selectAll('*').remove();
      this.svg.select('.legend').remove();
    }
    
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
  }

  destroy() {
    // 完全にグラフを破棄
    this.clear();
    
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
    
    if (this.svg) {
      this.svg.remove();
      this.svg = null;
    }
    
    this.container = null;
  }
}

// グローバルに公開
window.KnowledgeGraphVisualization = KnowledgeGraphVisualization;