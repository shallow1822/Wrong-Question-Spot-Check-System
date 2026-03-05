/**
 * 核心交互逻辑：支持会话持久化、分栏复习与 UI 动态交互
 */

const views = {
    dashboard: document.getElementById('main-view'),
};

const navButtons = {
    dashboard: document.getElementById('btn-dashboard'),
    review: document.getElementById('btn-review'),
    instant: document.getElementById('btn-instant'),
    add: document.getElementById('btn-add'),
    library: document.getElementById('btn-library'),
    pdfManage: document.getElementById('btn-pdf-manage'),
};

const SUBJ_MAP = {
    '数据结构': { emoji: '💻', color: 'var(--subj-cs)' },
    '计算机组成原理': { emoji: '🔌', color: 'var(--subj-comp)' },
    '操作系统': { emoji: '🖥️', color: 'var(--subj-os)' },
    '计算机网络': { emoji: '🌐', color: 'var(--subj-net)' },
    '高等数学': { emoji: '🔢', color: 'var(--subj-math)' },
    '线性代数': { emoji: '📐', color: 'var(--subj-linear)' },
    '英语': { emoji: '🔤', color: 'var(--subj-eng)' },
    '政治': { emoji: '🇨🇳', color: 'var(--subj-pol)' },
    '其他': { emoji: '📝', color: 'var(--subj-other)' }
};

// --- 视图与状态管理 ---
let currentView = '';

async function navigate(viewName, renderFn, ...args) {
    const isRefresh = (viewName === 'library' || viewName === 'dashboard' || viewName === 'pdfManage');
    if (currentView === viewName && !isRefresh) return;

    currentView = viewName;
    setActiveNav(viewName);
    await renderFn(...args);
}

// --- 初始化与核心挂载 ---
function init() {
    // 主题初始化
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        updateThemeUI('light');
    }

    // 主题切换逻辑
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-theme');
            const theme = isLight ? 'light' : 'dark';
            localStorage.setItem('theme', theme);
            updateThemeUI(theme);
        });
    }

    // 侧边栏折叠逻辑
    const sidebar = document.querySelector('.sidebar');
    const logo = document.querySelector('.logo');
    if (logo && sidebar) {
        logo.title = '切换侧边栏展开/收起';
        logo.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // 导航点击挂载
    navButtons.dashboard.addEventListener('click', () => navigate('dashboard', renderDashboard));
    navButtons.review.addEventListener('click', () => navigate('review', renderReviewConfig, 'planned'));
    navButtons.instant.addEventListener('click', () => navigate('instant', renderReviewConfig, 'instant'));
    navButtons.add.addEventListener('click', () => navigate('add', renderAddQuestionForm));
    navButtons.library.addEventListener('click', () => navigate('library', renderLibrary));
    navButtons.pdfManage.addEventListener('click', () => navigate('pdfManage', renderPdfManage));

    navigate('dashboard', renderDashboard);
}

function updateThemeUI(theme) {
    const themeBtn = document.getElementById('theme-toggle');
    if (theme === 'light') {
        if (themeBtn) themeBtn.innerText = '🌞';
    } else {
        if (themeBtn) themeBtn.innerText = '🌙';
    }
}

function setActiveNav(id) {
    const btns = {
        dashboard: document.getElementById('btn-dashboard'),
        review: document.getElementById('btn-review'),
        instant: document.getElementById('btn-instant'),
        add: document.getElementById('btn-add'),
        library: document.getElementById('btn-library'),
        pdfManage: document.getElementById('btn-pdf-manage')
    };

    Object.values(btns).forEach(btn => btn?.classList.remove('active'));
    const activeBtn = btns[id];
    if (activeBtn) activeBtn.classList.add('active');

    // 我们保持顶部的 "Ebbinghaus Review" 不变
    // 如果需要显示当前页面名称，可以在 main-view 内部渲染
}

/**
 * 仪表盘渲染
 */
async function renderDashboard() {
    const container = document.getElementById('main-view');
    const stats = await window.electronAPI.getStats();
    const history = await window.electronAPI.getHistory();
    const activeSession = await window.electronAPI.getActiveSession();

    const totalPending = stats.reduce((acc, s) => acc + s.pending, 0);
    const totalQuestions = stats.reduce((acc, s) => acc + s.total, 0);
    const subjects = ['数据结构', '计算机组成原理', '操作系统', '计算机网络', '高等数学', '线性代数', '英语', '政治'];

    const renderSubjectChart = (subjectName) => {
        const subInfo = SUBJ_MAP[subjectName] || SUBJ_MAP['其他'];
        const days = 7;
        const width = 400; const height = 150; const padding = 30;
        const data = Array.from({ length: days }).map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (days - 1 - i));
            const dateStr = date.toISOString().split('T')[0];
            const record = history.find(h => h.date === dateStr && h.subject === subjectName);
            return record ? record.count : 0;
        });
        const maxVal = Math.max(...data, 5);
        const points = data.map((val, i) => ({
            x: padding + (i * (width - 2 * padding) / (days - 1)),
            y: height - padding - (val / maxVal * (height - 2 * padding))
        }));
        const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
        const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

        return `
            <div class="subject-card animate-in">
                <div class="subject-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <div class="subject-pill" style="background: color-mix(in srgb, ${subInfo.color}, transparent 85%); color: ${subInfo.color}; border: 1px solid color-mix(in srgb, ${subInfo.color}, transparent 70%)">
                        <span>${subInfo.emoji} ${subjectName}</span>
                    </div>
                    <span class="text-muted" style="font-size:0.8rem;">今日: ${data[days - 1]}</span>
                </div>
                <div class="mini-chart">
                    <svg viewBox="0 0 ${width} ${height}">
                        <path d="${areaPath}" fill="color-mix(in srgb, ${subInfo.color}, transparent 90%)" />
                        <path d="${linePath}" fill="none" stroke="${subInfo.color}" stroke-width="3" />
                        ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--text)" stroke="${subInfo.color}" stroke-width="2" />`).join('')}
                    </svg>
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="dashboard-full-grid animate-in">
            ${activeSession ? `
            <div class="glass-card session-resume-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-color:var(--primary);">
                <div style="display:flex; align-items:center; gap:20px;">
                    <span style="font-size:2rem;">🕒</span>
                    <div>
                        <h3 style="color:var(--primary); margin:0;">检测到未完成的测试</h3>
                        <p class="text-muted" style="margin:5px 0 0 0; font-size:14px;">${activeSession.mode === 'instant' ? '立即抽查' : '计划复习'} · ${activeSession.subject === 'all' ? '全学科' : activeSession.subject}</p>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:30px;">
                    <div style="text-align:right;">
                        <div style="font-weight:700; margin-bottom:5px;">${activeSession.current_index}/${activeSession.total_count}</div>
                        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${(activeSession.current_index / activeSession.total_count) * 100}%"></div></div>
                    </div>
                    <button class="primary-btn" id="btn-resume-session">继续测试</button>
                </div>
            </div>
            ` : ''}

            <div class="stats-overview">
                <div class="glass-card stat-card">
                    <div class="text-muted" style="font-size:14px; margin-bottom:10px;">🔥 待复习总量</div>
                    <div class="stat-value highlight" style="color:var(--primary);">${totalPending}</div>
                </div>
                <div class="glass-card stat-card">
                    <div class="text-muted" style="font-size:14px; margin-bottom:10px;">📚 错题库规模</div>
                    <div class="stat-value">${totalQuestions}</div>
                </div>
            </div>

            <div class="subject-stats glass-card" style="background:transparent;">
                <h2 style="margin-bottom:30px;">📈 学科复习趋势</h2>
                <div class="charts-grid">
                    ${subjects.map(s => renderSubjectChart(s)).join('')}
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-resume-session')?.addEventListener('click', () => {
        renderSplitSession(activeSession);
    });
}

/**
 * 复习配置页渲染
 */
function renderReviewConfig(mode) {
    const container = document.getElementById('main-view');
    const isInstant = mode === 'instant';

    container.innerHTML = `
        <div class="glass-card animate-in" style="max-width: 600px; margin: 40px auto;">
            <h2 style="margin-bottom:20px;">${isInstant ? '立即抽查' : '按计划复习'}</h2>
            <p class="text-muted" style="margin-bottom: 40px;">
                ${isInstant ? '从全库中随机抽取错题，不受复习时间限制。' : '遵循艾宾浩斯复习曲线，只显示今天到期的题目。'}
            </p>
            <div class="form-group">
                <label>选择学科范围</label>
                <div class="select-wrapper">
                    <select id="select-subject">
                        ${['数据结构', '计算机组成原理', '操作系统', '计算机网络', '高等数学', '线性代数', '英语', '政治'].map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group" style="margin-top: 30px;">
                <label>抽取题目数量</label>
                <input type="number" id="review-count" value="10" min="1" max="100">
            </div>
            <button class="primary-btn" id="btn-start-review" style="margin-top: 50px; width: 100%;">开始测试</button>
        </div>
    `;

    document.getElementById('btn-start-review').addEventListener('click', () => executeReview(mode));
}

async function executeReview(mode) {
    const subject = document.getElementById('select-subject').value;
    const limit = parseInt(document.getElementById('review-count').value);
    let questions = [];
    try {
        if (mode === 'instant') {
            questions = await window.electronAPI.getRandomQuestions({ subject, limit });
        } else {
            questions = await window.electronAPI.getReviewQuestions({ subject, limit });
        }
    } catch (err) { alert('加载失败'); return; }

    if (!questions || questions.length === 0) { alert('没有符合条件的题目'); return; }

    const sessionId = await window.electronAPI.startSession({ mode, subject, questions });
    renderSplitSession({ id: sessionId, mode, subject, questions, current_index: 0 });
}

/**
 * 分栏复习系统 - 支持预览模式
 */
function renderSplitSession(session, isPreview = false) {
    const container = document.getElementById('main-view');
    let currentIndex = session.current_index || 0;
    const questions = session.questions;

    const showQuestion = (index) => {
        const q = questions[index];
        const subInfo = SUBJ_MAP[q.subject] || SUBJ_MAP['其他'];
        const isCompleted = isPreview ? false : q.is_done === 1;

        container.innerHTML = `
            <div class="review-split-view animate-in">
                <div class="review-content-panel">
                    <div class="review-top-bar">
                        <button class="back-btn" id="btn-session-back">← ${isPreview ? '退出预览' : '返回主页'}</button>
                        <span style="opacity:0.6; font-size:14px;">${isPreview ? '预览模式' : `进度: ${index + 1}/${questions.length}`}</span>
                    </div>

                    <div class="glass-card" style="flex:1; display:flex; flex-direction:column; padding:30px;">
                        <span class="q-tag" style="background:${subInfo.color}20; color:${subInfo.color}; align-self:flex-start; margin-bottom:20px;">${subInfo.emoji} ${q.subject}</span>
                        <div style="font-size:1.2rem; line-height:1.6; margin-bottom:30px;">${q.content}</div>
                        ${q.image_path ? `<img src="${q.image_path}" style="max-width:100%; border-radius:12px; margin-bottom:20px;">` : ''}
                        
                        <div style="margin-top:auto; padding-top:20px; border-top:1px solid rgba(255,255,255,0.05);">
                            <div class="btn-group-wide">
                                <button class="primary-btn fail" id="btn-act-fail" ${isCompleted ? 'disabled style="opacity:0.4"' : ''}>记不清</button>
                                <button class="primary-btn success" id="btn-act-success" ${isCompleted ? 'disabled style="opacity:0.4"' : ''}>已掌握</button>
                            </div>
                            ${isCompleted ? `<div style="text-align:center; color:#10b981; margin-top:10px;">✓ 已完成</div>` : ''}
                            ${isPreview ? `<div style="text-align:center; color:var(--primary); margin-top:10px; font-size:12px; opacity:0.8;">预览期间操作不会记录到数据库</div>` : ''}
                        </div>
                    </div>

                    <div style="margin-top:20px; display:flex; justify-content:space-between;">
                        <button class="secondary-btn" id="btn-prev-q" ${index === 0 ? 'disabled' : ''}>上一题</button>
                        <button class="secondary-btn" id="btn-next-q" ${index === questions.length - 1 ? 'disabled' : ''}>下一题</button>
                    </div>
                </div>

                <div class="pdf-view-panel">
                    <div style="position:absolute; top:15px; left:20px; z-index:10; background:rgba(0,0,0,0.6); padding:8px 15px; border-radius:30px; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.1); font-size:12px;">
                        📖 ${q.pdf_name || '未关联 PDF'} ${q.page_number ? `· P${q.page_number}` : ''}
                    </div>
                    ${q.pdf_path ? `<iframe src="file://${q.pdf_path}#page=${q.page_number || 1}&navpanes=0&pagemode=none"></iframe>` : `
                    <div style="height:100%; display:flex; align-items:center; justify-content:center; opacity:0.4;">暂无 PDF 解析</div>`}
                </div>
            </div>
        `;

        document.getElementById('btn-session-back').addEventListener('click', () => {
            if (isPreview) {
                navigate('library', renderLibrary);
            } else {
                navigate('dashboard', renderDashboard);
            }
        });
        document.getElementById('btn-prev-q').addEventListener('click', () => showQuestion(--currentIndex));
        document.getElementById('btn-next-q').addEventListener('click', () => showQuestion(++currentIndex));

        document.getElementById('btn-act-fail').addEventListener('click', () => recordResult('wrong'));
        document.getElementById('btn-act-success').addEventListener('click', () => recordResult('correct'));
    };

    const recordResult = async (result) => {
        if (isPreview) {
            alert(`[预览模式] 模拟记录: ${result === 'correct' ? '掌握' : '记不清'}`);
            return;
        }

        const q = questions[currentIndex];
        await window.electronAPI.recordReviewResult({ questionId: q.id, result });
        await window.electronAPI.updateSessionProgress({ sessionId: session.id, questionId: q.id, currentIndex });
        q.is_done = 1;

        if (questions.every(item => item.is_done === 1)) {
            await window.electronAPI.finishSession(session.id);
            alert('已全部完成！');
            navigate('dashboard', renderDashboard);
        } else {
            if (currentIndex < questions.length - 1) currentIndex++;
            showQuestion(currentIndex);
        }
    };
    showQuestion(currentIndex);
}

/**
 * 录入模块 - 重构以支持非破坏性更新
 */
async function renderAddQuestionForm() {
    const container = document.getElementById('main-view');

    // 1. 生成基础 HTML 结构
    container.innerHTML = `
        <div class="library-container animate-in">
            <h2 style="margin-bottom:30px;">📝 录入新错题</h2>
            <div class="glass-card">
                <div class="form-grid">
                    <div class="form-main">
                        <div class="form-row">
                            <div class="form-group">
                                <label>所属学科</label>
                                <div class="select-wrapper">
                                    <select id="q-subject">
                                        ${['数据结构', '计算机组成原理', '操作系统', '计算机网络', '高等数学', '线性代数', '英语', '政治', '其他'].map(s => `<option value="${s}">${s}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>关联教材 (PDF)</label>
                                <div class="select-wrapper">
                                    <select id="q-pdf-select">
                                        <option value="">正在加载题库...</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>对应页码</label>
                                <input type="number" id="q-page" placeholder="P001" min="1">
                            </div>
                        </div>
                        <div class="form-group" style="margin-top:20px;">
                            <label>题目简述 / 考点记录</label>
                            <textarea id="q-content" rows="10" placeholder="在此输入题目内容或您的复习心得..."></textarea>
                        </div>
                        <div style="margin-top:30px; display:flex; gap:15px; justify-content:flex-end;">
                            <button class="secondary-btn" id="btn-cancel-add">取消</button>
                            <button class="primary-btn" id="btn-save-q">保存入库</button>
                        </div>
                    </div>
                    <div class="form-aside">
                        <div class="help-card">
                            <div class="help-icon">ℹ️</div>
                            <h3>录入小贴士</h3>
                            <p style="opacity:0.7; font-size:14px; margin-top:10px;">支持真正的连续录入！聚焦考点，点击保存后无需离开页面即可立即录入下一条。</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 2. 绑定核心事件
    document.getElementById('btn-cancel-add').addEventListener('click', () => navigate('dashboard', renderDashboard));

    const pdfSelect = document.getElementById('q-pdf-select');
    pdfSelect.addEventListener('change', async (e) => {
        if (e.target.value === 'upload') {
            const id = await window.electronAPI.uploadPdf();
            if (id) {
                await refreshPDFList(id); // 仅更新下拉列表，保留已填内容
            } else {
                pdfSelect.value = '';
            }
        }
    });

    // 3. 题目保存逻辑
    document.getElementById('btn-save-q').addEventListener('click', async () => {
        const contentEl = document.getElementById('q-content');
        const content = contentEl.value.trim();
        if (!content) { alert('请输入内容'); return; }

        try {
            const q = {
                subject: document.getElementById('q-subject').value,
                content: content,
                pdfId: pdfSelect.value && pdfSelect.value !== 'upload' ? parseInt(pdfSelect.value) : null,
                pageNumber: parseInt(document.getElementById('q-page').value) || null
            };

            await window.electronAPI.saveQuestion(q);

            // 局部清空，支持多次导入
            contentEl.value = '';
            document.getElementById('q-page').value = '';
            contentEl.focus();

            // 浮窗反馈（可选），这里简单 alert
            console.log('Question saved successfully');
        } catch (error) {
            alert('保存失败，请检查数据库');
        }
    });

    // 4. 初次加载 PDF 列表并自动聚焦
    await refreshPDFList();
    setTimeout(() => {
        document.getElementById('q-content')?.focus();
    }, 100);
}

/**
 * PDF 管理视图
 */
async function renderPdfManage() {
    const container = document.getElementById('main-view');
    const pdfs = await window.electronAPI.getPdfs();

    container.innerHTML = `
        <div class="library-container animate-in">
            <div class="view-header">
                <h2>📂 PDF 资源管理 <span style="font-size:16px; opacity:0.6;">(${pdfs.length})</span></h2>
            </div>
            <div class="pdf-grid">
                ${pdfs.map(p => `
                    <div class="glass-card pdf-card animate-in">
                        <div class="pdf-header">
                            <span class="pdf-icon">📄</span>
                            <span class="pdf-name" title="${p.name}">${p.name}</span>
                        </div>
                        <div class="pdf-info">
                            <div style="margin-bottom:5px;">路径: ${p.path}</div>
                            <div>添加时间: ${new Date(p.created_at).toLocaleDateString()}</div>
                        </div>
                        <div style="margin-top:auto; display:flex; justify-content:flex-end;">
                            <button class="danger-btn" data-id="${p.id}">彻底删除</button>
                        </div>
                    </div>
                `).join('')}
                ${pdfs.length === 0 ? '<div style="opacity:0.3; padding:40px; grid-column:1/-1; text-align:center;">暂无上传的 PDF 文件</div>' : ''}
            </div>
        </div>
    `;

    container.querySelectorAll('.danger-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('确认删除该 PDF？关联记录将失去 PDF 链接（题目本身不会被删除）。')) {
                await window.electronAPI.deletePdf(btn.getAttribute('data-id'));
                renderPdfManage(); // 刷新视图
            }
        });
    });
}

/**
 * 局部更新 PDF 列表，防止破坏表单输入
 */
async function refreshPDFList(selectedId = null) {
    const pdfSelect = document.getElementById('q-pdf-select');
    if (!pdfSelect) return;

    try {
        const pdfs = await window.electronAPI.getPdfs();
        const options = [
            '<option value="">-- 请选择 --</option>',
            ...pdfs.map(p => `<option value="${p.id}" ${p.id == selectedId ? 'selected' : ''}>${p.name}</option>`),
            '<option value="upload">+ 上传新 PDF...</option>'
        ];
        pdfSelect.innerHTML = options.join('');
    } catch (err) {
        pdfSelect.innerHTML = '<option value="">加载失败</option>';
    }
}

/**
 * 题库模块
 */
async function renderLibrary() {
    const container = document.getElementById('main-view');
    const questions = await window.electronAPI.getAllQuestions();

    container.innerHTML = `
        <div class="library-container animate-in">
            <div class="view-header">
                <h2>📚 错题全库 <span style="font-size:16px; opacity:0.6;">(${questions.length})</span></h2>
                <button class="primary-btn" id="btn-lib-add">+ 录入</button>
            </div>
            <div class="question-list">
                ${questions.map(q => {
        const subInfo = SUBJ_MAP[q.subject] || SUBJ_MAP['其他'];
        return `
                        <div class="library-item glass-card animate-in">
                            <div class="item-info">
                                <div class="item-top">
                                    <span class="q-tag" style="background:${subInfo.color}15; color:${subInfo.color}; border:1px solid ${subInfo.color}30;">${subInfo.emoji} ${q.subject}</span>
                                    <span style="font-size:12px; opacity:0.5;">${new Date(q.created_at).toLocaleDateString()}</span>
                                </div>
                                <div class="item-content">${q.content}</div>
                                ${q.pdf_name ? `<div style="font-size:12px; color:var(--primary);">📎 ${q.pdf_name} (P${q.page_number || '?'})</div>` : ''}
                            </div>
                            <div class="item-actions">
                                <button class="secondary-btn btn-preview" data-id="${q.id}">预览/测试</button>
                                <button class="danger-btn btn-delete" data-id="${q.id}">移除</button>
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;

    document.getElementById('btn-lib-add')?.addEventListener('click', () => navigate('add', renderAddQuestionForm));

    container.querySelectorAll('.btn-preview').forEach(btn => {
        btn.addEventListener('click', () => {
            const q = questions.find(item => item.id == btn.getAttribute('data-id'));
            renderSplitSession({ id: 'preview', mode: 'preview', subject: q.subject, questions: [q], current_index: 0 }, true);
        });
    });

    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('确认删除？')) {
                await window.electronAPI.deleteQuestion(btn.getAttribute('data-id'));
                renderLibrary();
            }
        });
    });
}

// 启动入口
init();
