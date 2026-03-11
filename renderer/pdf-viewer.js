/**
 * PdfViewer — 基于 PDF.js 的嵌入式 PDF 渲染器
 * 支持: 精确跳页、平滑缩放、键盘导航
 */
import * as pdfjsLib from './lib/pdf.min.mjs';

export class PdfViewer {
    /**
     * @param {HTMLElement} container  - 挂载容器（.pdf-view-panel）
     * @param {string}      filePath   - 本地文件绝对路径
     * @param {number}      initPage   - 初始页码（1-based）
     */
    constructor(container, filePath, initPage = 1) {
        this.container = container;
        this.filePath = filePath;
        this.initPage = initPage;
        this.pdfDoc = null;
        this.currentPage = initPage;
        this.totalPages = 0;
        this.scale = 1.5;   // 默认缩放
        this.renderTask = null;
        this._build();
    }

    /** 构建 DOM 结构 */
    _build() {
        this.container.innerHTML = `
            <div class="pdfv-toolbar" id="pdfv-toolbar">
                <button class="pdfv-btn" id="pdfv-prev" title="上一页">‹</button>
                <span class="pdfv-page-info">
                    <input type="number" id="pdfv-page-input" min="1" value="${this.initPage}" />
                    <span id="pdfv-total"> / --</span>
                </span>
                <button class="pdfv-btn" id="pdfv-next" title="下一页">›</button>
                <div class="pdfv-sep"></div>
                <button class="pdfv-btn" id="pdfv-zoom-out" title="缩小">－</button>
                <span class="pdfv-zoom-label" id="pdfv-zoom-label">150%</span>
                <button class="pdfv-btn" id="pdfv-zoom-in" title="放大">＋</button>
                <button class="pdfv-btn pdfv-fit-btn" id="pdfv-fit" title="适应宽度">⊡</button>
            </div>
            <div class="pdfv-canvas-wrap" id="pdfv-canvas-wrap">
                <canvas id="pdfv-canvas"></canvas>
            </div>
            <div class="pdfv-loading" id="pdfv-loading">正在加载 PDF…</div>
        `;

        // 缓存 DOM 引用
        this.canvas = this.container.querySelector('#pdfv-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.wrap = this.container.querySelector('#pdfv-canvas-wrap');
        this.loading = this.container.querySelector('#pdfv-loading');
        this.pageInput = this.container.querySelector('#pdfv-page-input');
        this.totalEl = this.container.querySelector('#pdfv-total');
        this.zoomLabel = this.container.querySelector('#pdfv-zoom-label');

        this._bindEvents();
        this._load();
    }

    /** 绑定所有控件事件 */
    _bindEvents() {
        this.container.querySelector('#pdfv-prev').addEventListener('click', () => this.goTo(this.currentPage - 1));
        this.container.querySelector('#pdfv-next').addEventListener('click', () => this.goTo(this.currentPage + 1));

        this.pageInput.addEventListener('change', () => {
            const n = parseInt(this.pageInput.value);
            if (!isNaN(n)) this.goTo(n);
        });
        this.pageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.pageInput.blur();
        });

        this.container.querySelector('#pdfv-zoom-in').addEventListener('click', () => this.setScale(this.scale + 0.25));
        this.container.querySelector('#pdfv-zoom-out').addEventListener('click', () => this.setScale(this.scale - 0.25));
        this.container.querySelector('#pdfv-fit').addEventListener('click', () => this._fitWidth());

        // 鼠标滚轮缩放：Ctrl + 滚轮
        this.wrap.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                this.setScale(this.scale + (e.deltaY < 0 ? 0.15 : -0.15));
            }
        }, { passive: false });
    }

    /** 加载 PDF 文档 */
    async _load() {
        try {
            this.loading.style.display = 'flex';
            this.loading.textContent = '正在初始化环境...';

            // 解决 Electron 下 file:// 协议无法直接创建 Worker 的绝杀方案：
            if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                const workerUrl = new URL('./lib/pdf.worker.min.mjs', import.meta.url);
                let workerPath = decodeURIComponent(workerUrl.pathname);
                // 兼容 Windows 的前导斜杠 (比如 /C:/xxx => C:/xxx)
                if (workerPath.match(/^\/[a-zA-Z]:\//)) {
                    workerPath = workerPath.substring(1);
                }

                // 为了防止 IPC ArrayBuffer 转码成 Object 对象导致 worker 加载出一句 "[object Object]" 崩溃卡死，这里同样走安全的 base64：
                const b64Worker = await window.electronAPI.readPdfBase64(workerPath);
                const workerRes = await fetch(`data:text/javascript;base64,${b64Worker}`);
                const workerText = await workerRes.text();

                // 给 worker 注入 Polyfill 避免 TypeError: Promise.try is not a function 导致 worker 闪崩
                const polyfills = `
if (!Promise.try) { Promise.try = function(fn) { return new Promise((resolve, reject) => { try { resolve(fn()); } catch (err) { reject(err); } }); }; }
if (!Promise.withResolvers) { Promise.withResolvers = function() { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }; }
                `;
                const workerBlob = new Blob([polyfills + workerText], { type: 'text/javascript' });
                pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
            }

            this.loading.textContent = '正在提取内部文件...';

            const b64 = await window.electronAPI.readPdfBase64(this.filePath);

            this.loading.textContent = '正在解码文件流...';

            // 绝杀方案 2：利用浏览器原生底层的 fetch 解码 base64，彻底避免 atob() 带来的字符串过长崩溃与性能卡顿问题
            const base64Response = await fetch(`data:application/pdf;base64,${b64}`);
            const arrayBuffer = await base64Response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // 使用原生解析，因为 worker 已经成功注册，主线程毫无压力
            this.pdfDoc = await pdfjsLib.getDocument({
                data: uint8Array,
                cMapUrl: './lib/cmaps/',
                cMapPacked: true,
                standardFontDataUrl: './lib/standard_fonts/'
            }).promise;

            this.totalPages = this.pdfDoc.numPages;
            this.totalEl.textContent = ` / ${this.totalPages}`;
            this.loading.style.display = 'none';
            await this.goTo(Math.min(this.initPage, this.totalPages));
        } catch (err) {
            this.loading.textContent = `❌ PDF 加载失败：${err.name || err.message}`;
            console.error('[PdfViewer] load error', err);
        }
    }

    /** 跳转到指定页码并渲染 */
    async goTo(pageNum) {
        if (!this.pdfDoc) return;
        pageNum = Math.max(1, Math.min(pageNum, this.totalPages));
        if (pageNum === this.currentPage && this.renderTask) return;
        this.currentPage = pageNum;
        this.pageInput.value = pageNum;

        // 取消上一次未完成的渲染
        if (this.renderTask) {
            try { await this.renderTask.promise; } catch (_) { }
            this.renderTask = null;
        }

        await this._renderPage(pageNum);
        this._updateNav();
    }

    /** 渲染单页到 canvas */
    async _renderPage(pageNum) {
        const page = await this.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: this.scale });

        this.canvas.width = viewport.width;
        this.canvas.height = viewport.height;
        this.canvas.style.width = `${viewport.width}px`;
        this.canvas.style.height = `${viewport.height}px`;

        this.renderTask = page.render({ canvasContext: this.ctx, viewport });
        try {
            await this.renderTask.promise;
        } catch (e) {
            if (e?.name !== 'RenderingCancelledException') throw e;
        }
    }

    /** 设置缩放比例 */
    async setScale(newScale) {
        newScale = Math.max(0.5, Math.min(4.0, Math.round(newScale * 100) / 100));
        if (newScale === this.scale) return;
        this.scale = newScale;
        this.zoomLabel.textContent = `${Math.round(newScale * 100)}%`;
        await this._renderPage(this.currentPage);
    }

    /** 自适应容器宽度 */
    async _fitWidth() {
        if (!this.pdfDoc) return;
        const page = await this.pdfDoc.getPage(this.currentPage);
        const baseVp = page.getViewport({ scale: 1 });
        const wrapW = this.wrap.clientWidth - 40; // 左右留 padding
        const fitScale = wrapW / baseVp.width;
        await this.setScale(fitScale);
    }

    /** 更新上/下一页按钮状态 */
    _updateNav() {
        this.container.querySelector('#pdfv-prev').disabled = this.currentPage <= 1;
        this.container.querySelector('#pdfv-next').disabled = this.currentPage >= this.totalPages;
    }

    /** 销毁，释放内存 */
    destroy() {
        if (this.pdfDoc) {
            this.pdfDoc.destroy();
            this.pdfDoc = null;
        }
    }
}
