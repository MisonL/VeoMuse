import { API } from './api.js';
import { UI } from './ui.js';
import { I18n } from './i18n.js';
import { TemplateManager } from './templates.js';
import { VideoProcessor } from './video-processor.js';
import { BatchManager } from './batch.js';

class App {
    constructor() {
        this.i18n = new I18n();
        this.templateManager = new TemplateManager(this.i18n);
        this.videoProcessor = new VideoProcessor(this.i18n);
        this.batchManager = new BatchManager(this.i18n);

        this.initI18n();
        this.initTabs();
        this.initTheme();
        this.initForms();
        this.initImageUpload();
        this.initHistory();
        this.initTemplates();
        this.initModels();
        this.initKeyboardShortcuts(); // New: keyboard shortcuts
        this.batchManager.init();

        // Initial render
        this.updateLanguage();
    }

    initI18n() {
        const langToggle = document.getElementById('lang-toggle');
        langToggle.addEventListener('click', () => {
            this.i18n.toggle();
            this.updateLanguage();
        });
    }

    updateLanguage() {
        // Update all elements with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = this.i18n.get(el.dataset.i18n);
        });

        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = this.i18n.get(el.dataset.i18nPlaceholder);
        });

        // Update tooltips (for nav buttons)
        document.querySelectorAll('[data-tooltip]').forEach(el => {
            const tooltipKey = el.dataset.tooltip;
            el.setAttribute('data-tooltip', this.i18n.get(tooltipKey));
        });

        // Update page title
        document.title = this.i18n.get('appTitle');
    }

    initTabs() {
        const tabs = document.querySelectorAll('.nav-item[data-tab]');
        const textControls = document.getElementById('text-controls');
        const imageControls = document.getElementById('image-controls');
        const historyControls = document.getElementById('history-controls');
        const batchControls = document.getElementById('batch-controls');
        const pageTitle = document.getElementById('page-title');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const tabId = tab.dataset.tab;

                if (tabId === 'text') {
                    textControls.style.display = 'block';
                    imageControls.style.display = 'none';
                    historyControls.style.display = 'none';
                    batchControls.style.display = 'none';
                    pageTitle.dataset.i18n = 'text.title';
                    // 确保优化按钮存在
                    setTimeout(() => this.addOptimizeButtonsToLabels(), 0);
                } else if (tabId === 'image') {
                    textControls.style.display = 'none';
                    imageControls.style.display = 'block';
                    historyControls.style.display = 'none';
                    batchControls.style.display = 'none';
                    pageTitle.dataset.i18n = 'image.title';
                    // 确保优化按钮存在
                    setTimeout(() => this.addOptimizeButtonsToLabels(), 0);
                } else if (tabId === 'history') {
                    textControls.style.display = 'none';
                    imageControls.style.display = 'none';
                    historyControls.style.display = 'block';
                    batchControls.style.display = 'none';
                    pageTitle.dataset.i18n = 'history.title';
                    this.loadHistory();
                } else if (tabId === 'batch') {
                    textControls.style.display = 'none';
                    imageControls.style.display = 'none';
                    historyControls.style.display = 'none';
                    batchControls.style.display = 'block';
                    pageTitle.dataset.i18n = 'batch.title';
                    this.batchManager.loadUserBatches();
                }

                this.updateLanguage(); // Refresh title
            });
        });
    }

    initTheme() {
        const toggle = document.getElementById('theme-toggle');
        const body = document.body;

        // Check saved theme
        if (localStorage.getItem('veo_theme') === 'dark') {
            body.setAttribute('data-theme', 'dark');
        }

        toggle.addEventListener('click', () => {
            if (body.getAttribute('data-theme') === 'dark') {
                body.removeAttribute('data-theme');
                localStorage.setItem('veo_theme', 'light');
            } else {
                body.setAttribute('data-theme', 'dark');
                localStorage.setItem('veo_theme', 'dark');
            }
        });
    }

    // 表单验证
    validateTextForm(prompt, model) {
        const errors = [];

        if (!prompt || prompt.trim().length === 0) {
            errors.push(this.i18n.get('notifications.inputError'));
        }

        if (prompt && prompt.length > 2000) {
            errors.push('提示词长度不能超过2000个字符');
        }

        if (!model) {
            errors.push('请选择生成模型');
        }

        return errors;
    }

    validateImageForm(file, prompt) {
        const errors = [];

        if (!file) {
            errors.push(this.i18n.get('notifications.uploadError'));
        }

        if (file && file.size > 10 * 1024 * 1024) { // 10MB
            errors.push('图片大小不能超过10MB');
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (file && !validTypes.includes(file.type)) {
            errors.push('只支持 JPG、PNG、WEBP 格式的图片');
        }

        if (prompt && prompt.length > 1000) {
            errors.push('提示词长度不能超过1000个字符');
        }

        return errors;
    }

    initForms() {
        // Text to Video
        document.getElementById('generate-btn').addEventListener('click', async () => {
            const prompt = document.getElementById('text-prompt').value;
            const style = document.getElementById('style-select').value;
            const model = document.getElementById('model-select').value;

            const negativePrompt = document.getElementById('text-negative-prompt').value;

            // Validate form
            const errors = this.validateTextForm(prompt, model);
            if (errors.length > 0) {
                UI.showNotification(errors[0], 'warning');
                return;
            }

            try {
                UI.showLoading(true);
                const initialResult = await API.generateTextToVideo(prompt, model, style, negativePrompt);

                let videoUri;
                if (initialResult.videoUri) {
                    videoUri = initialResult.videoUri;
                } else if (initialResult.operationName) {
                    // Start polling
                    UI.showNotification(this.i18n.get('status.generating'), 'info');
                    const pollResult = await this.pollForVideo(initialResult.operationName, (progress) => {
                        // Optional: update UI with progress
                        console.log(`Progress: ${progress}%`);
                    });
                    videoUri = pollResult.videoUri;
                } else {
                    throw new Error('No operation name or video URI returned');
                }

                if (videoUri) {
                    UI.showVideo(videoUri);
                    UI.showNotification(this.i18n.get('notifications.genSuccess'), 'success');
                    API.saveHistory({ type: 'text', prompt, videoUri: videoUri });

                    // 添加视频处理菜单
                    // We need videoPath for processing. If videoUri is a URL, we might need to extract filename
                    // The backend returns downloadUrl as /generated/filename.mp4
                    // The processor expects a path relative to public or absolute?
                    // Let's assume videoUri is enough for download, but for transcode we need server path?
                    // API.transcodeVideo takes inputPath.
                    // If videoUri is /generated/foo.mp4, the server knows how to map it.
                    // Actually, VideoController.transcodeVideo expects inputPath.
                    // We should pass videoUri as inputPath if it's a local path.
                    this.addVideoProcessorMenu(videoUri, videoUri);
                }
            } catch (error) {
                UI.showLoading(false);
                console.error(error);
                const errorMessage = error.userMessage || error.message || this.i18n.get('notifications.genError');
                UI.showNotification(errorMessage, 'error', {
                    onRetry: () => document.getElementById('generate-btn').click()
                });
            }
        });

        // Image to Video
        document.getElementById('generate-image-btn').addEventListener('click', async () => {
            const prompt = document.getElementById('image-prompt').value;
            const fileInput = document.getElementById('image-input');
            const model = 'veo-3.1-generate-preview';

            const negativePrompt = document.getElementById('image-negative-prompt').value;

            // Validate form
            const errors = this.validateImageForm(fileInput.files[0], prompt);
            if (errors.length > 0) {
                UI.showNotification(errors[0], 'warning');
                return;
            }

            try {
                UI.showLoading(true);
                const initialResult = await API.generateImageToVideo(fileInput.files[0], prompt || 'Animate this image', model, negativePrompt);

                let videoUri;
                if (initialResult.videoUri) {
                    videoUri = initialResult.videoUri;
                } else if (initialResult.operationName) {
                    // Start polling
                    UI.showNotification(this.i18n.get('status.generating'), 'info');
                    const pollResult = await this.pollForVideo(initialResult.operationName, (progress) => {
                        console.log(`Progress: ${progress}%`);
                    });
                    videoUri = pollResult.videoUri;
                } else {
                    throw new Error('No operation name or video URI returned');
                }

                if (videoUri) {
                    UI.showVideo(videoUri);
                    UI.showNotification(this.i18n.get('notifications.genSuccess'), 'success');
                    API.saveHistory({ type: 'image', prompt, videoUri: videoUri });

                    // 添加视频处理菜单
                    this.addVideoProcessorMenu(videoUri, videoUri);
                }
            } catch (error) {
                UI.showLoading(false);
                console.error(error);
                const errorMessage = error.userMessage || error.message || this.i18n.get('notifications.genError');
                UI.showNotification(errorMessage, 'error', {
                    onRetry: () => document.getElementById('generate-image-btn').click()
                });
            }
        });
    }

    // 初始化模板功能
    async initTemplates() {
        await this.templateManager.init();

        // 为文字生成添加模板选择器
        const textPromptGroup = document.querySelector('#text-controls .form-group');
        const textTemplateSelector = this.templateManager.createTemplateSelector('text-prompt', 'text');
        textPromptGroup.appendChild(textTemplateSelector);

        // 为图片生成添加模板选择器
        const imagePromptGroup = document.querySelector('#image-controls .form-group:nth-child(2)');
        const imageTemplateSelector = this.templateManager.createTemplateSelector('image-prompt', 'image');
        imagePromptGroup.appendChild(imageTemplateSelector);

        // 添加优化按钮到 label 右侧
        this.addOptimizeButtonsToLabels();
    }

    // 将优化按钮添加到 label 右侧
    addOptimizeButtonsToLabels() {
        // 为文字提示词的 label 添加优化按钮
        const textLabel = document.querySelector('#text-controls .form-group label');
        if (textLabel && !textLabel.querySelector('.optimize-btn')) {
            const optimizeBtn = this.createOptimizeButton('text-prompt');
            textLabel.classList.add('label-with-button');
            textLabel.appendChild(optimizeBtn);
        }

        // 为图片提示词的 label 添加优化按钮
        const imageLabel = document.querySelector('#image-controls .form-group:nth-child(2) label');
        if (imageLabel && !imageLabel.querySelector('.optimize-btn')) {
            const optimizeBtnImage = this.createOptimizeButton('image-prompt');
            imageLabel.classList.add('label-with-button');
            imageLabel.appendChild(optimizeBtnImage);
        }
    }

    createOptimizeButton(inputId) {
        const button = document.createElement('button');
        button.className = 'optimize-btn';
        button.type = 'button';
        button.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
            </svg>
            <span data-i18n="optimize.button">${this.i18n.get('optimize.button')}</span>
        `;

        button.addEventListener('click', async () => {
            const input = document.getElementById(inputId);
            const originalPrompt = input.value;

            if (!originalPrompt) {
                UI.showNotification(this.i18n.get('notifications.inputError'), 'error');
                return;
            }

            button.disabled = true;
            button.classList.add('loading');
            const span = button.querySelector('span');
            const originalText = span.textContent;
            span.textContent = this.i18n.get('optimize.optimizing');

            try {
                const model = document.getElementById('model-select')?.value || 'veo-3.1-generate-preview';
                const result = await API.optimizePrompt(originalPrompt, model);

                if (result.success && result.optimizedPrompt) {
                    input.value = result.optimizedPrompt;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    UI.showNotification(this.i18n.get('optimize.success'), 'success');
                }
            } catch (error) {
                console.error('Optimize error:', error);
                const errorMessage = error.userMessage || this.i18n.get('optimize.error');
                UI.showNotification(errorMessage, 'error', {
                    onRetry: () => button.click()
                });
            } finally {
                button.disabled = false;
                button.classList.remove('loading');
                span.textContent = originalText;
            }
        });

        return button;
    }

    // 动态加载模型列表
    async initModels() {
        try {
            const result = await API.getAvailableModels();
            if (result.success && result.models) {
                const modelSelect = document.getElementById('model-select');
                modelSelect.innerHTML = result.models.map(model => `
                    <option value="${model.name}">${model.displayName || model.name}</option>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to load models:', error);
            // 保持默认的硬编码模型选项
        }
    }

    // 添加视频处理菜单
    addVideoProcessorMenu(videoPath, videoUri) {
        const previewContainer = document.querySelector('.preview-video-wrapper');

        // 移除旧的处理菜单
        const oldMenu = previewContainer.querySelector('.video-processor-menu');
        if (oldMenu) oldMenu.remove();

        // 添加新的处理菜单
        const menu = this.videoProcessor.createProcessorMenu(videoPath, videoUri);
        previewContainer.appendChild(menu);
    }

    initImageUpload() {
        const zone = document.getElementById('upload-zone');
        const input = document.getElementById('image-input');
        const preview = document.getElementById('image-preview');
        const clearBtn = document.getElementById('clear-image');
        const content = zone.querySelector('.upload-content');

        zone.addEventListener('click', (e) => {
            if (e.target !== clearBtn) input.click();
        });

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                    content.style.display = 'none';
                    clearBtn.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });

        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            input.value = '';
            preview.style.display = 'none';
            content.style.display = 'block';
            clearBtn.style.display = 'none';
        });
    }

    initHistory() {
        const clearBtn = document.getElementById('clear-history-btn');
        clearBtn.addEventListener('click', () => {
            if (confirm(this.i18n.get('history.title') + '?')) {
                localStorage.removeItem('veo_history');
                this.loadHistory();
                UI.showNotification(this.i18n.get('history.clearAll') + ' ✓', 'success');
            }
        });
    }

    loadHistory() {
        const historyList = document.getElementById('history-list');
        const history = API.getHistory();

        if (history.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <span class="icon">📝</span>
                    <p data-i18n="history.empty">${this.i18n.get('history.empty')}</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = history.map(item => {
            const typeIcon = item.type === 'text' ? '✨' : '🖼️';
            const typeText = this.i18n.get(item.type === 'text' ? 'history.textType' : 'history.imageType');
            const date = new Date(item.timestamp);
            const dateStr = date.toLocaleString(this.i18n.lang === 'zh' ? 'zh-CN' : 'en-US');

            return `
                <div class="history-item" data-video-uri="${item.videoUri}">
                    <span class="history-item-icon">${typeIcon}</span>
                    <div class="history-item-content">
                        <div class="history-item-prompt">${item.prompt || 'Generated Video'}</div>
                        <div class="history-item-meta">
                            <span class="history-item-type">${typeText}</span>
                            <span>•</span>
                            <span>${dateStr}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers to history items
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // If clicking the prompt text, reuse it
                if (e.target.classList.contains('history-item-prompt')) {
                    const prompt = e.target.textContent;
                    const type = item.querySelector('.history-item-type').textContent;

                    // Determine target tab based on type (simple heuristic or data attribute)
                    // Since we localized the type text, we should rely on data attribute if possible, 
                    // but we didn't save type in data attribute. 
                    // Let's assume we stay on current tab or switch based on content?
                    // Better: check if we are on text or image tab.

                    const activeTab = document.querySelector('.nav-item.active').dataset.tab;
                    if (activeTab === 'text') {
                        const input = document.getElementById('text-prompt');
                        input.value = prompt;
                        UI.showNotification(this.i18n.get('notifications.promptCopied') || '提示词已填入', 'success');
                    } else if (activeTab === 'image') {
                        const input = document.getElementById('image-prompt');
                        input.value = prompt;
                        UI.showNotification(this.i18n.get('notifications.promptCopied') || '提示词已填入', 'success');
                    } else {
                        // If on history tab, maybe switch to text tab?
                        document.querySelector('.nav-item[data-tab="text"]').click();
                        setTimeout(() => {
                            document.getElementById('text-prompt').value = prompt;
                            UI.showNotification(this.i18n.get('notifications.promptCopied') || '提示词已填入', 'success');
                        }, 100);
                    }
                    return;
                }

                // Otherwise show video
                const videoUri = item.dataset.videoUri;
                if (videoUri) {
                    UI.showVideo(videoUri);
                }
            });
        });
    }

    // 初始化键盘快捷键
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Esc: Close modals/notifications
            if (e.key === 'Escape') {
                // Close all notifications
                document.querySelectorAll('.notification').forEach(n => UI.dismissNotification(n));

                // Close template modal if open
                const templateModal = document.querySelector('.template-modal');
                if (templateModal) {
                    templateModal.remove();
                }

                // Close transcode modal if open
                const transcodeModal = document.querySelector('.transcode-modal');
                if (transcodeModal) {
                    transcodeModal.remove();
                }
            }

            // Ctrl/Cmd + L: Toggle language
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                document.getElementById('lang-toggle').click();
            }

            // Ctrl/Cmd + D: Toggle theme
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                document.getElementById('theme-toggle').click();
            }

            // Ctrl/Cmd + 1-4: Switch tabs
            if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '4') {
                e.preventDefault();
                const tabIndex = parseInt(e.key) - 1;
                const tabs = document.querySelectorAll('.nav-item[data-tab]');
                if (tabs[tabIndex]) {
                    tabs[tabIndex].click();
                }
            }

            // Enter in textarea: Submit if Ctrl/Cmd is pressed
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;

                if (activeTab === 'text') {
                    const prompt = document.getElementById('text-prompt');
                    if (document.activeElement === prompt) {
                        e.preventDefault();
                        document.getElementById('generate-btn').click();
                    }
                } else if (activeTab === 'image') {
                    const prompt = document.getElementById('image-prompt');
                    if (document.activeElement === prompt) {
                        e.preventDefault();
                        document.getElementById('generate-image-btn').click();
                    }
                }
            }
        });

        // Show keyboard shortcuts hint on first visit
        if (!localStorage.getItem('shortcuts_shown')) {
            setTimeout(() => {
                UI.showNotification('💡 提示: 使用 Ctrl+Enter 快速生成，Ctrl+L 切换语言', 'info', {
                    duration: 8000
                });
                localStorage.setItem('shortcuts_shown', 'true');
            }, 2000);
        }
    }
    // 轮询视频生成状态
    async pollForVideo(operationName, onProgress) {
        const maxAttempts = 120; // 10 minutes max (5s interval)
        const interval = 5000;

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const status = await API.checkOperationStatus(operationName);

                if (status.done) {
                    if (status.error) {
                        throw new Error(status.message || '生成失败');
                    }

                    if (status.videoUrl) {
                        return { videoUri: status.videoUrl };
                    }
                }

                // Update progress if callback provided
                if (onProgress && status.progress) {
                    onProgress(status.progress);
                }

                await new Promise(resolve => setTimeout(resolve, interval));
            } catch (error) {
                console.warn('Poll error:', error);
                // Continue polling on temporary errors
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }

        throw new Error('生成超时，请稍后在历史记录中查看');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
