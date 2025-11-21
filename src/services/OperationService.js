// src/services/OperationService.js
const VideoService = require('./VideoService');
const SocketService = require('./SocketService');
const ApiKeyService = require('./ApiKeyService');
const { getInstance: getApiManager } = require('./ApiRequestManager');
const axios = require('axios');

class OperationService {
  // 存储已完成的操作结果 (缓存10分钟)
  static completedOperations = new Map();

  static async getOperationStatus({ operationName, webhookUrl, socketId, type = 'text' }) {
    try {
      const availableKeys = ApiKeyService.getAvailableKeys();

      if (availableKeys.length === 0) {
        throw new Error('没有可用的API密钥');
      }

      // 使用第一个可用密钥
      const key = availableKeys[0];

      // 使用API请求管理器开始智能轮询
      const apiManager = getApiManager();

      const pollId = await apiManager.startPolling(operationName, key, {
        onProgress: (operation, config) => {
          console.log(`操作进度 ${operationName}:`, {
            attempt: config.currentAttempt,
            done: operation.done,
            progress: operation.metadata?.progress || 0
          });

          if (socketId) {
            const progressMessage = this.getProgressMessage(operation);
            SocketService.emitToSocket(socketId, 'generationProgress', {
              ...progressMessage,
              type // 传递类型
            });
          }
        },

        onComplete: async (operation, config) => {
          console.log(`操作完成 ${operationName}:`, operation);

          try {
            if (operation.error) {
              throw new Error(`生成失败: ${operation.error.message || '未知错误'}`);
            }

            if (operation.response && operation.response.videoUri) {
              const videoUri = operation.response.videoUri;
              console.log('视频生成完成，开始下载:', videoUri);

              // 下载视频
              const downloadResult = await VideoService.downloadVideo(videoUri); // 移除了 key

              const payload = {
                success: true,
                operationName: operationName,
                message: '视频生成完成！',
                videoUrl: downloadResult.downloadUrl,
                done: true,
                type // 传递类型
              };

              // 存入缓存
              this.completedOperations.set(operationName, {
                ...payload,
                timestamp: Date.now()
              });

              // 清理过期缓存
              this.cleanupCache();

              if (socketId) {
                SocketService.emitToSocket(socketId, 'generationComplete', payload);
              }

              if (webhookUrl) {
                try {
                  await axios.post(webhookUrl, payload);
                  console.log(`Webhook 已发送到: ${webhookUrl}`);
                } catch (webhookError) {
                  console.error(`发送 Webhook 失败: ${webhookError.message}`);
                }
              }
            }
          } catch (error) {
            console.error('处理完成操作时出错:', error);
            const errorPayload = {
              success: false,
              operationName: operationName,
              message: `生成失败: ${error.message}`,
              error: true,
              type // 传递类型
            };

            // 存入缓存 (错误状态)
            this.completedOperations.set(operationName, {
              ...errorPayload,
              timestamp: Date.now()
            });

            if (socketId) {
              SocketService.emitToSocket(socketId, 'generationError', errorPayload);
            }

            if (webhookUrl) {
              try {
                await axios.post(webhookUrl, errorPayload);
                console.log(`Webhook (错误) 已发送到: ${webhookUrl}`);
              } catch (webhookError) {
                console.error(`发送 Webhook (错误) 失败: ${webhookError.message}`);
              }
            }
          }
        },

        onError: async (error, config) => { // 改为 async
          console.error(`轮询失败 ${operationName}:`, error);
          const errorPayload = {
            success: false,
            operationName: operationName,
            message: `生成失败: ${error.message}`,
            error: true,
            type // 传递类型
          };

          // 存入缓存 (错误状态)
          this.completedOperations.set(operationName, {
            ...errorPayload,
            timestamp: Date.now()
          });

          if (socketId) {
            SocketService.emitToSocket(socketId, 'generationError', errorPayload);
          }

          if (webhookUrl) {
            try {
              await axios.post(webhookUrl, errorPayload);
              console.log(`Webhook (错误) 已发送到: ${webhookUrl}`);
            } catch (webhookError) {
              console.error(`发送 Webhook (错误) 失败: ${webhookError.message}`);
            }
          }
        },

        maxAttempts: 120, // 最大轮询次数
        interval: 5000 // 初始间隔5秒
      });

      return {
        success: true,
        pollId: pollId,
        message: '开始监控操作状态'
      };

    } catch (error) {
      console.error('查询操作状态失败:', error);

      if (socketId) {
        SocketService.emitToSocket(socketId, 'generationError', {
          message: `生成失败: ${error.message}`,
          error: true,
          type // 传递类型
        });
      }

      throw new Error(`查询操作状态失败: ${error.message}`);
    }
  }

  // 检查操作状态 (不启动新轮询)
  static async checkStatus(operationName) {
    // 1. 检查已完成缓存
    if (this.completedOperations.has(operationName)) {
      return this.completedOperations.get(operationName);
    }

    // 2. 检查是否正在轮询
    const apiManager = getApiManager();
    // 这里我们假设如果正在轮询，它就是"处理中"
    // 实际上 ApiRequestManager 没有直接暴露通过 operationName 查找 pollConfig 的方法
    // 但我们可以简单返回 "processing"

    // 如果既不在缓存也不在活动轮询中，可能需要去 Google 查询一次
    // 但为了简单起见，我们假设如果后端正在处理，它最终会进入缓存。
    // 如果后端没有处理（比如重启了），我们需要重新触发查询。
    // 这里我们做一个简单的实现：如果缓存没有，就去 Google 查一次。

    try {
      const availableKeys = ApiKeyService.getAvailableKeys();
      if (availableKeys.length === 0) throw new Error('没有可用的API密钥');

      const key = availableKeys[0];
      const url = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${key}`;

      const response = await axios.get(url);
      const operation = response.data;

      if (operation.done) {
        // 如果 Google 说完成了，但我们缓存里没有，说明可能是在我们重启期间完成的，或者其他原因。
        // 我们需要手动触发下载流程吗？
        // 是的，否则用户拿不到视频。

        if (operation.error) {
          return { success: false, error: true, message: operation.error.message };
        }

        if (operation.response && operation.response.videoUri) {
          // 触发下载 (异步)
          // 注意：这里我们不等待下载完成，而是返回"处理中"，让前端继续轮询
          // 或者我们可以等待下载？下载可能需要时间。
          // 为了用户体验，我们应该等待下载，或者返回一个"downloading"状态。

          const videoUri = operation.response.videoUri;
          const downloadResult = await VideoService.downloadVideo(videoUri);

          const result = {
            success: true,
            done: true,
            videoUrl: downloadResult.downloadUrl,
            message: '生成完成'
          };

          // 存入缓存
          this.completedOperations.set(operationName, { ...result, timestamp: Date.now() });
          return result;
        }
      }

      // 如果还没完成
      return {
        success: true,
        done: false,
        progress: operation.metadata?.progress || 0,
        message: '处理中...'
      };

    } catch (error) {
      console.error('检查状态失败:', error);
      return { success: false, error: true, message: error.message };
    }
  }

  static cleanupCache() {
    const now = Date.now();
    const ttl = 10 * 60 * 1000; // 10分钟
    for (const [key, value] of this.completedOperations.entries()) {
      if (now - value.timestamp > ttl) {
        this.completedOperations.delete(key);
      }
    }
  }

  static getProgressMessage(operation) {
    if (operation.done) {
      return {
        message: '视频生成完成，正在下载...',
        done: false,
        progress: 95
      };
    }

    const progress = operation.metadata?.progress || 0;
    let message = '视频生成中...';

    if (progress > 0) {
      message = `视频生成中... ${Math.round(progress)}%`;
    }

    return {
      message,
      done: false,
      progress
    };
  }

  // 停止轮询
  static stopPolling(pollId) {
    const apiManager = getApiManager();
    apiManager.stopPolling(pollId);
  }

  // 获取活跃轮询状态
  static getPollingStats() {
    const apiManager = getApiManager();
    return apiManager.getPoolStats();
  }
}

module.exports = OperationService;