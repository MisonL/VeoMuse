// src/services/OperationService.js
const VideoService = require('./VideoService');
const SocketService = require('./SocketService');
const ApiKeyService = require('./ApiKeyService');
const { getInstance: getApiManager } = require('./ApiRequestManager');

class OperationService {
  static async getOperationStatus({ operationName, apiKey, socketId }) {
    try {
      const availableKeys = ApiKeyService.getAvailableKeys(apiKey);
      
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
            SocketService.emitToSocket(socketId, 'generationProgress', progressMessage);
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
              const downloadResult = await VideoService.downloadVideo(videoUri, key);

              if (socketId) {
                SocketService.emitToSocket(socketId, 'generationComplete', {
                  message: '视频生成完成！',
                  videoUrl: downloadResult.downloadUrl,
                  done: true
                });
              }
            }
          } catch (error) {
            console.error('处理完成操作时出错:', error);
            if (socketId) {
              SocketService.emitToSocket(socketId, 'generationError', {
                message: `生成失败: ${error.message}`,
                error: true
              });
            }
          }
        },
        
        onError: (error, config) => {
          console.error(`轮询失败 ${operationName}:`, error);
          
          if (socketId) {
            SocketService.emitToSocket(socketId, 'generationError', {
              message: `生成失败: ${error.message}`,
              error: true
            });
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
          error: true
        });
      }

      throw new Error(`查询操作状态失败: ${error.message}`);
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