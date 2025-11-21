// src/services/PromptService.js
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises; // 引入 fs 模块
const ApiKeyService = require('./ApiKeyService');

let cachedTemplates = null; // 用于缓存模板数据

class PromptService {
  static async loadTemplates() {
    if (cachedTemplates) {
      return cachedTemplates;
    }
    try {
      const templatesPath = path.join(__dirname, '../../config/prompts/templates.json');
      const data = await fs.readFile(templatesPath, 'utf8');
      cachedTemplates = JSON.parse(data);
      console.log('提示词模板加载成功。');
      return cachedTemplates;
    } catch (error) {
      console.error('加载提示词模板失败:', error);
      cachedTemplates = { general: {}, imageVideo: [] }; // 失败时返回空对象，防止后续错误
      return cachedTemplates;
    }
  }

  static async getAllTemplates() {
    const templates = await this.loadTemplates();
    const result = [];

    // 将按分类组织的模板转换为数组格式
    for (const [category, prompts] of Object.entries(templates.general)) {
      prompts.forEach((prompt, index) => {
        result.push({
          id: `${category}_${index}`,
          category: category,
          prompt: prompt,
          text: prompt,
          name: `${category} - ${index + 1}`,
          description: prompt
        });
      });
    }

    return result;
  }

  static async getTemplatesByCategory(category) {
    const templates = await this.loadTemplates();
    const prompts = templates.general[category] || [];

    return prompts.map((prompt, index) => ({
      id: `${category}_${index}`,
      category: category,
      prompt: prompt,
      text: prompt,
      name: `${category} - ${index + 1}`,
      description: prompt
    }));
  }

  static async getAllCategories() {
    const templates = await this.loadTemplates();
    return Object.keys(templates.general);
  }

  static async getRandomTemplate() {
    const categories = await this.getAllCategories();
    if (categories.length === 0) return null;

    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const templates = await this.getTemplatesByCategory(randomCategory);

    if (templates.length === 0) return null;

    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    return randomTemplate;
  }

  static async getImageVideoTemplates() {
    const templates = await this.loadTemplates();
    const imageVideoPrompts = templates.imageVideo || [];

    return imageVideoPrompts.map((prompt, index) => ({
      id: `image_video_${index}`,
      category: '图片生视频',
      prompt: prompt,
      text: prompt,
      name: `图片动画 - ${index + 1}`,
      description: prompt
    }));
  }

  static async getRandomImageTemplate() {
    const imageTemplates = await this.getImageVideoTemplates();
    if (imageTemplates.length === 0) return null;

    return imageTemplates[Math.floor(Math.random() * imageTemplates.length)];
  }

  static async optimizePrompt(prompt, model = 'gemini-2.5-flash') {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    try {
      let availableKeys = [];
      try {
        availableKeys = ApiKeyService.getAvailableKeys();
      } catch (e) {
        console.warn('PromptService: No keys available via ApiKeyService');
      }


      // Development Mock: If no keys or dev mode explicitly requests mock
      if (process.env.NODE_ENV !== 'production' && (availableKeys.length === 0 || process.env.MOCK_GEMINI === 'true')) {
        console.log('Dev Mode: Returning mock optimized prompt');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        return `(Optimized) ${prompt} - Enhanced with cinematic lighting, 8k resolution, highly detailed textures, and dramatic camera angles. The scene is vibrant and full of life.`;
      }

      let lastError = null;

      for (const key of availableKeys) {
        try {
          const requestData = {
            contents: [{
              parts: [{
                text: `请优化以下视频生成提示词，使其更加详细和富有表现力，包含场景、动作、风格、相机运动等元素：\n\n${prompt}`
              }]
            }]
          };

          const response = await axios.post(`${API_URL}?key=${key}`, requestData, {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });

          const optimizedPrompt = response.data.candidates[0].content.parts[0].text;
          console.log('提示词优化成功');

          return optimizedPrompt;

        } catch (error) {
          lastError = error;
          console.log(`API密钥 ${key.substring(0, 10)}... 失败:`, error.message);
          continue;
        }
      }

      // Fallback to mock in dev if all keys fail
      if (process.env.NODE_ENV !== 'production') {
        console.warn('All API keys failed. Returning mock optimized prompt in Dev mode.');
        return `(Optimized Fallback) ${prompt} - Enhanced with cinematic lighting, 8k resolution, highly detailed textures, and dramatic camera angles.`;
      }

      throw lastError || new Error('所有API密钥都已失效');

    } catch (error) {
      console.error('提示词优化失败:', error);
      throw new Error(`提示词优化失败: ${error.message}`);
    }
  }
}

module.exports = PromptService;