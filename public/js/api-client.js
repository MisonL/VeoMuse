// js/api-client.js - API客户端模块
class APIClient {
    static async optimizePrompt(prompt, apiKey, model) {
        const response = await fetch('/api/optimize-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt, apiKey, model })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '优化失败');
        }

        return data.optimizedPrompt;
    }

    static async generateTextToVideo(params) {
        const { text, negativePrompt, apiKey, model } = params;

        const requestBody = {
            text,
            apiKey,
            model,
            optimize: false // 我们已经手动优化过了
        };

        if (negativePrompt) {
            requestBody.negativePrompt = negativePrompt;
        }

        const response = await fetch('/api/text-to-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '生成失败');
        }

        return data;
    }

    static async generateImageToVideo(params) {
        const { file, prompt, negativePrompt, apiKey, model } = params;

        const formData = new FormData();
        formData.append('image', file);
        formData.append('prompt', prompt);
        formData.append('apiKey', apiKey);
        formData.append('model', model);
        formData.append('optimize', false); // 我们已经手动优化过了

        if (negativePrompt) {
            formData.append('negativePrompt', negativePrompt);
        }

        const response = await fetch('/api/image-to-video', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '生成失败');
        }

        return data;
    }

    static async checkOperationStatus(operationName, apiKey) {
        const response = await fetch(`/api/operation/${operationName}?apiKey=${encodeURIComponent(apiKey)}`);
        return await response.json();
    }

    // 智能轮询管理器
    static async intelligentPolling(operationName, apiKey, onProgress = null) {
        let delay = 5000; // 起始5秒
        const maxDelay = 30000; // 最大30秒
        const backoffFactor = 1.2; // 退避系数
        let attempt = 0;
        const maxAttempts = 100; // 最大尝试次数

        console.log(`开始智能轮询: ${operationName}`);

        while (attempt < maxAttempts) {
            try {
                const data = await this.checkOperationStatus(operationName, apiKey);

                if (data.done) {
                    console.log(`轮询完成，总尝试次数: ${attempt + 1}`);
                    return data;
                }

                // 调用进度回调
                if (onProgress) {
                    const progress = Math.min(10 + (attempt * 2), 85);
                    onProgress(`视频生成中，请耐心等待... (第${attempt + 1}次检查)`, progress);
                }

                // 等待下一次轮询
                console.log(`第${attempt + 1}次轮询，等待${Math.round(delay / 1000)}秒...`);
                await new Promise(resolve => setTimeout(resolve, delay));

                // 指数退避
                delay = Math.min(delay * backoffFactor, maxDelay);
                attempt++;

            } catch (error) {
                console.error(`轮询错误 (第${attempt + 1}次尝试):`, error);

                // 错误重试策略
                if (attempt >= 3) {
                    throw new Error(`轮询失败，尝试${attempt + 1}次: ${error.message}`);
                }

                // 错误后等待更长时间
                const errorDelay = Math.min(delay * 2, maxDelay);
                console.log(`错误后等待${Math.round(errorDelay / 1000)}秒重试...`);
                await new Promise(resolve => setTimeout(resolve, errorDelay));

                attempt++;
            }
        }

        throw new Error(`轮询超时，超过最大尝试次数: ${maxAttempts}`);
    }

    static async downloadVideo(videoUri, apiKey) {
        const response = await fetch('/api/download-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ videoUri, apiKey })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '下载视频失败');
        }

        return data;
    }

    static async transcodeVideo(params) {
        const { inputPath, format, resolution, fps } = params;

        const response = await fetch('/api/transcode-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputPath,
                format,
                resolution,
                fps
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '转换失败');
        }

        return data;
    }

    static async getModels(apiKey = null) {
        const queryParams = apiKey ? `?apiKey=${encodeURIComponent(apiKey)}` : '';

        const response = await fetch(`/api/models${queryParams}`);
        const models = await response.json();

        // 返回默认模型结构
        return {
            optimizationModels: models.optimizationModels || [
                { id: 'gemini-3.0-pro', name: 'Gemini 3.0 Pro' },
                { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
            ],
            videoModels: models.videoModels || [
                { id: 'veo-3.1-generate-preview', name: 'Veo 3.1 (Preview)' },
                { id: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast (Preview)' },
                { id: 'veo-3.0-generate-preview', name: 'Veo 3.0' }
            ]
        };
    }

    static async getHealth() {
        const response = await fetch('/health');
        return await response.json();
    }

    static async getDetailedHealth() {
        const response = await fetch('/health/detailed');
        return await response.json();
    }
}