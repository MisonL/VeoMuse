export class API {
    static MAX_RETRIES = 3;
    static RETRY_DELAY = 1000; // 1 second base delay

    // Check network connectivity
    static isOnline() {
        return navigator.onLine;
    }

    // Sleep utility for retry delays
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Extract meaningful error message
    static getErrorMessage(error, data) {
        if (!this.isOnline()) {
            return '网络连接已断开，请检查您的网络设置';
        }

        if (error.name === 'AbortError') {
            return '请求超时，请重试';
        }

        if (data?.error) {
            return data.error;
        }

        if (error.message) {
            return error.message;
        }

        return 'API请求失败，请稍后重试';
    }

    static async request(endpoint, options = {}, retryCount = 0) {
        // Check network before attempting request
        if (!this.isOnline()) {
            throw new Error('网络连接已断开，请检查您的网络设置');
        }

        try {
            // Add timeout to fetch
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(endpoint, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                signal: controller.signal
            });

            clearTimeout(timeout);

            const data = await response.json();

            if (!response.ok) {
                const errorMsg = this.getErrorMessage(new Error(`HTTP ${response.status}`), data);
                const error = new Error(errorMsg);
                error.status = response.status;
                error.data = data;
                throw error;
            }

            if (!data.success) {
                throw new Error(data.error || 'API Request Failed');
            }

            return data;
        } catch (error) {
            console.error(`API Error (attempt ${retryCount + 1}/${this.MAX_RETRIES + 1}):`, error);

            // Don't retry on client errors (4xx) or if max retries reached
            const shouldRetry = retryCount < this.MAX_RETRIES &&
                (!error.status || error.status >= 500) &&
                this.isOnline();

            if (shouldRetry) {
                // Exponential backoff
                const delay = this.RETRY_DELAY * Math.pow(2, retryCount);
                console.log(`Retrying in ${delay}ms...`);
                await this.sleep(delay);
                return this.request(endpoint, options, retryCount + 1);
            }

            // Enhance error with user-friendly message
            error.userMessage = this.getErrorMessage(error, error.data);
            throw error;
        }
    }

    static async generateTextToVideo(text, model, style, negativePrompt) {
        // Append style to prompt if provided
        const finalPrompt = style ? `${text}, ${style} style` : text;

        return this.request('/api/text-to-video', {
            method: 'POST',
            body: JSON.stringify({
                text: finalPrompt,
                model,
                negativePrompt,
                optimize: false
            })
        });
    }

    static async generateImageToVideo(file, prompt, model, negativePrompt) {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('prompt', prompt);
        formData.append('model', model);
        if (negativePrompt) {
            formData.append('negativePrompt', negativePrompt);
        }
        formData.append('optimize', false);

        const response = await fetch('/api/image-to-video', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Generation Failed');
        return data;
    }

    static getHistory() {
        // Mock history for now or implement if backend supports it
        // The old app used localStorage for history
        try {
            return JSON.parse(localStorage.getItem('veo_history') || '[]');
        } catch (e) {
            console.error('Failed to parse history:', e);
            return [];
        }
    }

    static saveHistory(item) {
        try {
            const current = JSON.parse(localStorage.getItem('veo_history') || '[]');
            current.unshift({ ...item, timestamp: Date.now() });
            localStorage.setItem('veo_history', JSON.stringify(current.slice(0, 20)));
        } catch (e) {
            console.error('Failed to save history:', e);
        }
    }

    // ========== 提示词优化 ==========
    static async optimizePrompt(prompt, model) {
        return this.request('/api/prompts/optimize', {
            method: 'POST',
            body: JSON.stringify({ prompt, model })
        });
    }

    // ========== 提示词模板 ==========
    static async getPromptTemplates() {
        return this.request('/api/prompts', { method: 'GET' });
    }

    static async getRandomTemplate() {
        return this.request('/api/prompts/random', { method: 'GET' });
    }

    static async getImageVideoTemplates() {
        return this.request('/api/prompts/image-video', { method: 'GET' });
    }

    static async getTemplatesByCategory(category) {
        return this.request(`/api/prompts/${category}`, { method: 'GET' });
    }

    static async getRandomImageTemplate() {
        return this.request('/api/prompts/image-random', { method: 'GET' });
    }

    // ========== 模型管理 ==========
    static async getAvailableModels() {
        return this.request('/api/models', { method: 'GET' });
    }

    // ========== 操作状态查询 ==========
    static async getOperationStatus(operationName) {
        // Encode operation name because it contains slashes (e.g., operations/123)
        const encodedName = encodeURIComponent(operationName);
        return this.request(`/api/operation/${encodedName}`, { method: 'GET' });
    }

    static async checkOperationStatus(operationName) {
        // Encode operation name because it contains slashes
        const encodedName = encodeURIComponent(operationName);
        return this.request(`/api/operation/${encodedName}/status`, { method: 'GET' });
    }

    // ========== 视频后处理 ==========
    static async downloadVideo(videoUri) {
        return this.request('/api/download-video', {
            method: 'POST',
            body: JSON.stringify({ videoUri })
        });
    }

    static async transcodeVideo(inputPath, format, resolution, fps) {
        return this.request('/api/transcode-video', {
            method: 'POST',
            body: JSON.stringify({ inputPath, format, resolution, fps })
        });
    }

    static async generateGif(inputPath) {
        return this.request('/api/generate-gif', {
            method: 'POST',
            body: JSON.stringify({ inputPath })
        });
    }

    static async captureThumbnail(inputPath, time = '00:00:01') {
        return this.request('/api/capture-thumbnail', {
            method: 'POST',
            body: JSON.stringify({ inputPath, time })
        });
    }

    // ========== 批量生成 ==========
    static async createBatch(batchData) {
        return this.request('/api/batch', {
            method: 'POST',
            body: JSON.stringify(batchData)
        });
    }

    static async getBatches(page = 1, limit = 20) {
        return this.request(`/api/batches?page=${page}&limit=${limit}`, {
            method: 'GET'
        });
    }

    static async getBatchStatus(batchId) {
        return this.request(`/api/batch/${batchId}`, {
            method: 'GET'
        });
    }

    static async cancelBatch(batchId) {
        return this.request(`/api/batch/${batchId}/cancel`, {
            method: 'POST'
        });
    }

    static async getBatchTemplates() {
        return this.request('/api/batch/templates', {
            method: 'GET'
        });
    }

    static async createBatchTemplate(templateData) {
        return this.request('/api/batch/templates', {
            method: 'POST',
            body: JSON.stringify(templateData)
        });
    }

    static async getBatchStats() {
        return this.request('/api/batch/stats', {
            method: 'GET'
        });
    }
}
