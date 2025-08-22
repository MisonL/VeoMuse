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
        
        // 初始化主题
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
        const body = document.body;
        
        // 检查本地存储的主题设置
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            body.classList.add('dark');
            themeToggle.textContent = '☀️';
        }
        
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark');
            const isDark = body.classList.contains('dark');
            themeToggle.textContent = isDark ? '☀️' : '🌙';
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    initTabs() {
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // 移除所有active类
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(tc => tc.classList.remove('active'));
                
                // 添加active类到当前tab
                tab.classList.add('active');
                const tabId = tab.getAttribute('data-tab');
                document.getElementById(`${tabId}-content`).classList.add('active');
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
        document.getElementById('api-key').addEventListener('input', () => {
            this.loadModels();
        });
    }

    initImagePreview() {
        const imageInput = document.getElementById('image-input');
        const imagePreview = document.getElementById('image-preview');
        
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.innerHTML = `<img src="${e.target.result}" alt="预览图片">`;
                };
                reader.readAsDataURL(file);
            } else {
                imagePreview.innerHTML = '';
            }
        });
        
        // 点击预览图片查看大图
        imagePreview.addEventListener('click', (e) => {
            if (e.target.tagName === 'IMG') {
                ImageModal.show(e.target.src);
            }
        });
    }

    initPromptOptimization() {
        // 文字提示词优化
        document.getElementById('optimize-text-btn').addEventListener('click', async () => {
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
        
        // 图片提示词优化
        document.getElementById('optimize-image-btn').addEventListener('click', async () => {
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

    initVideoGeneration() {
        // 文字生成视频
        document.getElementById('generate-text-btn').addEventListener('click', async () => {
            const textInput = document.getElementById('text-input');
            const negativePromptInput = document.getElementById('negative-prompt-text');
            const text = this.optimizedTextPrompt || textInput.value.trim();
            const negativePrompt = negativePromptInput.value.trim();
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
        
        // 图片生成视频
        document.getElementById('generate-image-btn').addEventListener('click', async () => {
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
            
            const negativePrompt = negativePromptInput.value.trim();
            
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

    initVideoConversion() {
        document.getElementById('convert-btn').addEventListener('click', async () => {
            if (!this.currentVideoPath) {
                NotificationManager.show('没有可转换的视频', 'error');
                return;
            }
            
            const format = document.getElementById('convert-format').value;
            const resolution = document.getElementById('convert-resolution').value;
            const fps = document.getElementById('convert-fps').value;
            
            try {
                this.showTranscodeProgress();
                this.updateTranscodeProgress('正在开始视频转换...', 0);
                
                const result = await APIClient.transcodeVideo({
                    inputPath: this.currentVideoPath.startsWith('/') ? this.currentVideoPath.substring(1) : this.currentVideoPath,
                    format,
                    resolution: resolution || null,
                    fps: fps ? parseInt(fps) : null
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
        
        // 下载按钮事件
        document.getElementById('download-btn').addEventListener('click', () => {
            if (this.currentVideoPath) {
                this.downloadFile(this.currentVideoPath, 'generated-video.mp4');
            }
        });
        
        document.getElementById('download-converted-btn').addEventListener('click', () => {
            const convertedVideoPath = document.getElementById('download-converted-btn').dataset.videoUrl;
            if (convertedVideoPath) {
                const format = document.getElementById('convert-format').value;
                const ext = format === 'webm' ? '.webm' : format === 'mov' ? '.mov' : '.mp4';
                this.downloadFile(convertedVideoPath, `converted-video${ext}`);
            }
        });
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
        
        // 更新视频模型下拉列表
        const videoModelText = document.getElementById('video-model-text');
        const videoModelImage = document.getElementById('video-model-image');
        
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

    // 工具方法
    getApiKey() {
        return document.getElementById('api-key').value.trim() || null;
    }

    showOptimizedPrompt(content, isImage = false) {
        const promptElement = isImage ? 
            document.getElementById('optimized-image-prompt') : 
            document.getElementById('optimized-text-prompt');
        const contentElement = isImage ? 
            document.getElementById('optimized-image-content') : 
            document.getElementById('optimized-text-content');
        
        contentElement.textContent = content;
        promptElement.classList.add('show');
    }

    showResult(videoPath) {
        LoadingManager.hide();
        
        this.currentVideoPath = videoPath;
        
        const videoContainer = document.getElementById('video-container');
        videoContainer.innerHTML = `
            <video controls>
                <source src="${videoPath}" type="video/mp4">
                您的浏览器不支持视频播放。
            </video>
        `;
        
        // 隐藏转换预览和进度
        document.getElementById('conversion-preview').classList.remove('show');
        this.hideTranscodeProgress();
        
        document.getElementById('result').classList.add('show');
    }

    showConvertedResult(videoPath) {
        const videoContainer = document.getElementById('converted-video-container');
        videoContainer.innerHTML = `
            <video controls>
                <source src="${videoPath}" type="video/mp4">
                您的浏览器不支持视频播放。
            </video>
        `;
        
        document.getElementById('download-converted-btn').dataset.videoUrl = videoPath;
        document.getElementById('conversion-preview').classList.add('show');
    }

    showTranscodeProgress() {
        document.getElementById('transcode-progress').classList.add('show');
    }

    hideTranscodeProgress() {
        document.getElementById('transcode-progress').classList.remove('show');
    }

    updateTranscodeProgress(text, percent) {
        document.getElementById('transcode-status-text').textContent = text;
        document.getElementById('transcode-progress-bar').style.width = percent + '%';
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