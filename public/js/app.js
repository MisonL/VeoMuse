// js/app.js - 主应用程序类
class VeoMuseApp {
    constructor() {
        this.socket = null;
        this.socketId = null;
        this.optimizedTextPrompt = null;
        this.optimizedImagePrompt = null;
        this.currentVideoPath = null;

        this.init();
    }

    async init() {
        // 初始化Socket.IO连接
        this.initSocket();

        // 初始化主题 (新主题默认深色，此方法可能只需处理切换逻辑或留空)
        this.initTheme();

        // 初始化选项卡
        this.initTabs();

        // 初始化事件监听器
        this.initEventListeners();

        // 加载模型列表
        await this.loadModels();

        console.log('VeoMuse App initialized');
    }

    initSocket() {
        this.socket = io();
        this.socketId = this.socket.id;

        // Socket事件监听
        this.socket.on('transcodeProgress', (data) => {
            this.updateTranscodeProgress(data.message, data.percent);
        });

        this.socket.on('transcodeComplete', (data) => {
            NotificationManager.show(data.message);
            this.hideTranscodeProgress();
        });

        this.socket.on('transcodeError', (data) => {
            NotificationManager.show(data.message, 'error');
            this.hideTranscodeProgress();
        });
    }

    initTheme() {
        const themeToggle = document.getElementById('theme-toggle');
        const icon = themeToggle ? themeToggle.querySelector('.icon') : null;

        // 检查本地存储的主题偏好
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (icon) icon.textContent = '☀️';
        } else {
            // 默认浅色
            document.documentElement.removeAttribute('data-theme');
            if (icon) icon.textContent = '🌙';
        }

        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                if (currentTheme === 'dark') {
                    // 切换到浅色
                    document.documentElement.removeAttribute('data-theme');
                    localStorage.setItem('theme', 'light');
                    if (icon) icon.textContent = '🌙';
                    NotificationManager.show('已切换到晨曦微光模式', 'success');
                } else {
                    // 切换到深色
                    document.documentElement.setAttribute('data-theme', 'dark');
                    localStorage.setItem('theme', 'dark');
                    if (icon) icon.textContent = '☀️';
                    NotificationManager.show('已切换到深邃宇宙模式', 'success');
                }
            });
        }
    }

    initTabs() {
        const tabs = document.querySelectorAll('.nav-item');
        const tabContents = document.querySelectorAll('.tab-content');
        const previewColumn = document.querySelector('.preview-column');
        const contentGrid = document.querySelector('.content-area-grid');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // 移除所有active类
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(tc => tc.classList.remove('active'));

                // 添加active类到当前tab
                tab.classList.add('active');
                const tabId = tab.getAttribute('data-tab');
                const targetContent = document.getElementById(`${tabId}-content`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }

                // 更新标题
                const titles = {
                    'text': '文字转视频',
                    'image': '图片转视频',
                    'history': '创作历史',
                    'api': 'API 文档'
                };
                const subtitles = {
                    'text': '使用 Gemini Veo 模型将您的创意转化为精彩视频',
                    'image': '让静态图片动起来，创造栩栩如生的视觉体验',
                    'history': '查看您过去生成的精彩视频作品',
                    'api': '了解如何通过 API 集成 VeoMuse 的强大功能'
                };

                const titleEl = document.getElementById('page-title-text');
                const subtitleEl = document.getElementById('page-subtitle-text');

                if (titleEl && titles[tabId]) titleEl.textContent = titles[tabId];
                if (subtitleEl && subtitles[tabId]) subtitleEl.textContent = subtitles[tabId];

                // 控制右侧预览面板的显示
                if (tabId === 'text' || tabId === 'image') {
                    if (previewColumn) previewColumn.style.display = 'block';
                    if (contentGrid) contentGrid.style.gridTemplateColumns = '1fr 1fr';
                } else {
                    if (previewColumn) previewColumn.style.display = 'none';
                    if (contentGrid) contentGrid.style.gridTemplateColumns = '1fr';
                }
            });
        });
    }

    initEventListeners() {
        // 图片预览功能
        this.initImagePreview();

        // 优化提示词功能
        this.initPromptOptimization();

        // 视频生成功能
        this.initVideoGeneration();

        // 视频转换功能
        this.initVideoConversion();

        // API密钥变化监听
        const apiKeyInput = document.getElementById('api-key');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('input', () => {
                this.loadModels();
            });
        }

        // 模态框关闭
        const closeBtn = document.getElementById('close-template-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('template-modal').style.display = 'none';
            });
        }
    }

    initImagePreview() {
        const imageInput = document.getElementById('image-input');
        const previewContainer = document.getElementById('image-preview-container');
        const previewImg = document.getElementById('uploaded-image-preview');
        const removeBtn = document.getElementById('remove-image-btn');
        const uploadPlaceholder = document.querySelector('.upload-placeholder');

        if (!imageInput) return;

        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (previewImg) previewImg.src = e.target.result;
                    if (previewContainer) previewContainer.style.display = 'block';
                    if (uploadPlaceholder) uploadPlaceholder.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });

        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                imageInput.value = '';
                if (previewImg) previewImg.src = '';
                if (previewContainer) previewContainer.style.display = 'none';
                if (uploadPlaceholder) uploadPlaceholder.style.display = 'block';
            });
        }

        // 点击预览图片查看大图
        if (previewImg) {
            previewImg.addEventListener('click', () => {
                if (previewImg.src) ImageModal.show(previewImg.src);
            });
        }
    }

    initPromptOptimization() {
        // 文字提示词优化
        const optimizeTextBtn = document.getElementById('optimize-text-btn');
        if (optimizeTextBtn) {
            optimizeTextBtn.addEventListener('click', async () => {
                const textInput = document.getElementById('text-input');
                const text = textInput.value.trim();
                const apiKey = this.getApiKey();
                const model = document.getElementById('optimize-model-text').value;

                if (!text) {
                    NotificationManager.show('请输入文字描述', 'error');
                    return;
                }

                if (!apiKey) {
                    NotificationManager.show('请提供API密钥', 'error');
                    return;
                }

                try {
                    NotificationManager.show('正在优化提示词...');

                    const optimizedPrompt = await APIClient.optimizePrompt(text, apiKey, model);
                    this.optimizedTextPrompt = optimizedPrompt;
                    this.showOptimizedPrompt(optimizedPrompt, false);
                    NotificationManager.show('提示词优化完成!');
                } catch (error) {
                    NotificationManager.show('优化提示词时出错: ' + error.message, 'error');
                }
            });
        }

        // 图片提示词优化
        const optimizeImageBtn = document.getElementById('optimize-image-btn');
        if (optimizeImageBtn) {
            optimizeImageBtn.addEventListener('click', async () => {
                const imagePrompt = document.getElementById('image-prompt');
                const prompt = imagePrompt.value.trim();
                const apiKey = this.getApiKey();
                const model = document.getElementById('optimize-model-image').value;

                if (!prompt) {
                    NotificationManager.show('请输入图片描述', 'error');
                    return;
                }

                if (!apiKey) {
                    NotificationManager.show('请提供API密钥', 'error');
                    return;
                }

                try {
                    NotificationManager.show('正在优化提示词...');

                    const optimizedPrompt = await APIClient.optimizePrompt(prompt, apiKey, model);
                    this.optimizedImagePrompt = optimizedPrompt;
                    this.showOptimizedPrompt(optimizedPrompt, true);
                    NotificationManager.show('提示词优化完成!');
                } catch (error) {
                    NotificationManager.show('优化提示词时出错: ' + error.message, 'error');
                }
            });
        }
    }

    initVideoGeneration() {
        // 文字生成视频
        const generateTextBtn = document.getElementById('generate-text-btn');
        if (generateTextBtn) {
            generateTextBtn.addEventListener('click', async () => {
                const textInput = document.getElementById('text-input');
                const negativePromptInput = document.getElementById('negative-prompt-text');
                const text = this.optimizedTextPrompt || textInput.value.trim();
                const negativePrompt = negativePromptInput ? negativePromptInput.value.trim() : '';
                const apiKey = this.getApiKey();
                const model = document.getElementById('video-model-text').value;

                if (!text) {
                    NotificationManager.show('请输入文字描述', 'error');
                    return;
                }

                if (!apiKey) {
                    NotificationManager.show('请提供API密钥', 'error');
                    return;
                }

                try {
                    LoadingManager.show();

                    const result = await APIClient.generateTextToVideo({
                        text,
                        negativePrompt,
                        apiKey,
                        model
                    });

                    // 开始轮询操作状态
                    await this.pollOperationStatus(result.operationName, result.usedApiKey || apiKey);
                } catch (error) {
                    LoadingManager.hide();
                    NotificationManager.show('生成视频时出错: ' + error.message, 'error');
                }
            });
        }

        // 图片生成视频
        const generateImageBtn = document.getElementById('generate-image-btn');
        if (generateImageBtn) {
            generateImageBtn.addEventListener('click', async () => {
                const imageInput = document.getElementById('image-input');
                const imagePrompt = document.getElementById('image-prompt');
                const negativePromptInput = document.getElementById('negative-prompt-image');
                const file = imageInput.files[0];
                const prompt = this.optimizedImagePrompt || imagePrompt.value.trim();
                const apiKey = this.getApiKey();
                const model = document.getElementById('video-model-image').value;

                if (!file) {
                    NotificationManager.show('请上传一张图片', 'error');
                    return;
                }

                const negativePrompt = negativePromptInput ? negativePromptInput.value.trim() : '';

                if (!prompt) {
                    NotificationManager.show('请输入图片描述', 'error');
                    return;
                }

                if (!apiKey) {
                    NotificationManager.show('请提供API密钥', 'error');
                    return;
                }

                try {
                    LoadingManager.show();

                    const result = await APIClient.generateImageToVideo({
                        file,
                        prompt,
                        negativePrompt,
                        apiKey,
                        model
                    });

                    // 开始轮询操作状态
                    await this.pollOperationStatus(result.operationName, result.usedApiKey || apiKey);
                } catch (error) {
                    LoadingManager.hide();
                    NotificationManager.show('生成视频时出错: ' + error.message, 'error');
                }
            });
        }
    }

    initVideoConversion() {
        const convertBtn = document.getElementById('convert-btn');
        if (convertBtn) {
            convertBtn.addEventListener('click', async () => {
                if (!this.currentVideoPath) {
                    NotificationManager.show('没有可转换的视频', 'error');
                    return;
                }

                const format = document.getElementById('convert-format').value;
                const resolution = document.getElementById('convert-resolution').value;
                // const fps = document.getElementById('convert-fps').value; // 暂时移除FPS选项

                try {
                    this.showTranscodeProgress();
                    this.updateTranscodeProgress('正在开始视频转换...', 0);

                    const result = await APIClient.transcodeVideo({
                        inputPath: this.currentVideoPath.startsWith('/') ? this.currentVideoPath.substring(1) : this.currentVideoPath,
                        format,
                        resolution: resolution || null,
                        // fps: fps ? parseInt(fps) : null
                    });

                    this.updateTranscodeProgress('转换完成', 100);
                    setTimeout(() => {
                        this.hideTranscodeProgress();
                        this.showConvertedResult('/' + result.videoPath);
                        NotificationManager.show('视频转换成功!');
                    }, 500);
                } catch (error) {
                    this.hideTranscodeProgress();
                    NotificationManager.show('转换视频时出错: ' + error.message, 'error');
                }
            });
        }

        // 下载按钮事件
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                if (this.currentVideoPath) {
                    this.downloadFile(this.currentVideoPath, 'generated-video.mp4');
                }
            });
        }

        const downloadConvertedBtn = document.getElementById('download-converted-btn');
        if (downloadConvertedBtn) {
            downloadConvertedBtn.addEventListener('click', () => {
                const convertedVideoPath = downloadConvertedBtn.dataset.videoUrl;
                if (convertedVideoPath) {
                    const format = document.getElementById('convert-format').value;
                    const ext = format === 'webm' ? '.webm' : format === 'mov' ? '.mov' : '.mp4';
                    this.downloadFile(convertedVideoPath, `converted-video${ext}`);
                }
            });
        }
    }

    // 轮询操作状态
    async pollOperationStatus(operationName, apiKey) {
        try {
            LoadingManager.updateProgress('视频生成已启动...', 10);

            // 使用智能轮询
            const data = await APIClient.intelligentPolling(
                operationName,
                apiKey,
                (message, progress) => {
                    LoadingManager.updateProgress(message, progress);
                }
            );

            if (data.error) {
                throw new Error('视频生成失败: ' + data.error.message);
            }

            const videoUri = data.response.generateVideoResponse.generatedSamples[0].video.uri;

            LoadingManager.updateProgress('正在下载视频...', 90);

            const downloadResult = await APIClient.downloadVideo(videoUri, apiKey);
            this.showResult('/' + downloadResult.videoPath);
            NotificationManager.show('视频生成成功!');

        } catch (error) {
            LoadingManager.hide();
            NotificationManager.show('检查视频生成状态时出错: ' + error.message, 'error');
        }
    }

    // 加载模型列表
    async loadModels() {
        try {
            const apiKey = this.getApiKey();
            const models = await APIClient.getModels(apiKey);

            this.updateModelSelects(models);
        } catch (error) {
            console.error('Failed to load models:', error);
            NotificationManager.show('加载模型列表失败: ' + error.message, 'error');
        }
    }

    updateModelSelects(models) {
        // 更新优化模型下拉列表
        const optimizeModelText = document.getElementById('optimize-model-text');
        const optimizeModelImage = document.getElementById('optimize-model-image');

        if (optimizeModelText && optimizeModelImage) {
            // 清空现有选项
            optimizeModelText.innerHTML = '';
            optimizeModelImage.innerHTML = '';

            // 添加新选项
            models.optimizationModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                optimizeModelText.appendChild(option.cloneNode(true));
                optimizeModelImage.appendChild(option.cloneNode(true));
            });
        }

        // 更新视频模型下拉列表
        const videoModelText = document.getElementById('video-model-text');
        const videoModelImage = document.getElementById('video-model-image');

        if (videoModelText && videoModelImage) {
            // 清空现有选项
            videoModelText.innerHTML = '';
            videoModelImage.innerHTML = '';

            // 添加新选项
            models.videoModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                videoModelText.appendChild(option.cloneNode(true));
                videoModelImage.appendChild(option.cloneNode(true));
            });
        }
    }

    // 工具方法
    getApiKey() {
        const input = document.getElementById('api-key');
        return input ? (input.value.trim() || null) : null;
    }

    showOptimizedPrompt(content, isImage = false) {
        const promptElement = isImage ?
            document.getElementById('optimized-image-prompt') :
            document.getElementById('optimized-text-prompt');
        const contentElement = isImage ?
            document.getElementById('optimized-image-content') :
            document.getElementById('optimized-text-content');

        if (contentElement) contentElement.textContent = content;
        if (promptElement) promptElement.style.display = 'block';
    }

    showResult(videoPath) {
        LoadingManager.hide();

        this.currentVideoPath = videoPath;

        const videoContainer = document.getElementById('video-container');
        if (videoContainer) {
            videoContainer.innerHTML = `
                <video controls>
                    <source src="${videoPath}" type="video/mp4">
                    您的浏览器不支持视频播放。
                </video>
            `;
        }

        // 隐藏转换预览和进度
        const conversionPreview = document.getElementById('conversion-preview');
        if (conversionPreview) conversionPreview.style.display = 'none';
        this.hideTranscodeProgress();

        const resultDiv = document.getElementById('result');
        if (resultDiv) resultDiv.style.display = 'block';
    }

    showConvertedResult(videoPath) {
        const videoContainer = document.getElementById('converted-video-container');
        if (videoContainer) {
            videoContainer.innerHTML = `
                <video controls>
                    <source src="${videoPath}" type="video/mp4">
                    您的浏览器不支持视频播放。
                </video>
            `;
        }

        const downloadBtn = document.getElementById('download-converted-btn');
        if (downloadBtn) downloadBtn.dataset.videoUrl = videoPath;

        const previewDiv = document.getElementById('conversion-preview');
        if (previewDiv) previewDiv.style.display = 'block';
    }

    showTranscodeProgress() {
        const el = document.getElementById('transcode-progress');
        if (el) el.style.display = 'block';
    }

    hideTranscodeProgress() {
        const el = document.getElementById('transcode-progress');
        if (el) el.style.display = 'none';
    }

    updateTranscodeProgress(text, percent) {
        const textEl = document.getElementById('transcode-status-text');
        const barEl = document.getElementById('transcode-progress-bar');
        if (textEl) textEl.textContent = text;
        if (barEl) barEl.style.width = percent + '%';
    }

    downloadFile(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new VeoMuseApp();
});