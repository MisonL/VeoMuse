// src/services/VideoService.js
const path = require('path');
const fs = require('fs').promises;
const config = require('../../config');
const SocketService = require('./SocketService');
const ApiKeyService = require('./ApiKeyService');
const { getInstance: getApiManager } = require('./ApiRequestManager');

class VideoService {
  static async generateFromText({ text, negativePrompt, apiKey, model, socketId }) {
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-preview:predictLongRunning';
    
    try {
      const availableKeys = ApiKeyService.getAvailableKeys(apiKey);
      let lastError = null;

      for (const key of availableKeys) {
        try {
          const requestData = {
            contents: [{
              parts: [{
                text: negativePrompt ? 
                  `${text}\n\n负面提示：${negativePrompt}` : 
                  text
              }]
            }]
          };

          const apiManager = getApiManager();
          const response = await apiManager.makeRequest(API_URL, {
            method: 'POST',
            data: requestData,
            headers: {
              'Content-Type': 'application/json'
            },
            url: `${API_URL}?key=${key}`
          });

          const operationName = response.data.name;
          console.log('视频生成请求已提交，操作名称:', operationName);

          if (socketId) {
            SocketService.emitToSocket(socketId, 'generationProgress', {
              message: '视频生成请求已提交，正在处理...',
              done: false
            });
          }

          return {
            success: true,
            operationName: operationName,
            message: '视频生成请求已提交'
          };

        } catch (error) {
          lastError = error;
          console.log(`API密钥 ${key.substring(0, 10)}... 失败:`, error.message);
          continue;
        }
      }

      throw lastError || new Error('所有API密钥都已失效');

    } catch (error) {
      console.error('视频生成失败:', error);
      throw new Error(`视频生成失败: ${error.message}`);
    }
  }

  static async generateFromImage({ imagePath, prompt, negativePrompt, apiKey, socketId }) {
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-preview:predictLongRunning';
    
    try {
      // 读取并编码图片
      const imageData = await fs.readFile(imagePath);
      const base64Image = imageData.toString('base64');
      const mimeType = this.getMimeType(imagePath);

      const availableKeys = ApiKeyService.getAvailableKeys(apiKey);
      let lastError = null;

      for (const key of availableKeys) {
        try {
          const requestData = {
            contents: [{
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image
                  }
                },
                {
                  text: negativePrompt ? 
                    `${prompt}\n\n负面提示：${negativePrompt}` : 
                    prompt
                }
              ]
            }]
          };

          const response = await axios.post(`${API_URL}?key=${key}`, requestData, {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });

          const operationName = response.data.name;
          console.log('图片到视频生成请求已提交，操作名称:', operationName);

          if (socketId) {
            SocketService.emitToSocket(socketId, 'generationProgress', {
              message: '图片到视频生成请求已提交，正在处理...',
              done: false
            });
          }

          return {
            success: true,
            operationName: operationName,
            message: '图片到视频生成请求已提交'
          };

        } catch (error) {
          lastError = error;
          console.log(`API密钥 ${key.substring(0, 10)}... 失败:`, error.message);
          continue;
        }
      }

      throw lastError || new Error('所有API密钥都已失效');

    } catch (error) {
      console.error('图片到视频生成失败:', error);
      throw new Error(`图片到视频生成失败: ${error.message}`);
    }
  }

  static async downloadVideo(videoUri, apiKey) {
    try {
      const apiManager = getApiManager();
      const response = await apiManager.makeRequest(videoUri, {
        method: 'GET',
        responseType: 'stream',
        timeout: 300000 // 5分钟超时
      });

      const filename = `video_${Date.now()}.mp4`;
      const filepath = path.join(config.upload.generatedDir, filename);

      const writer = fs.createWriteStream(filepath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log('视频下载完成:', filepath);
          resolve({
            success: true,
            filename: filename,
            filepath: filepath,
            downloadUrl: `/generated/${filename}`
          });
        });

        writer.on('error', (error) => {
          console.error('视频下载失败:', error);
          reject(new Error(`视频下载失败: ${error.message}`));
        });
      });

    } catch (error) {
      console.error('视频下载错误:', error);
      throw new Error(`视频下载失败: ${error.message}`);
    }
  }

  static getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', 
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }
}

module.exports = VideoService;