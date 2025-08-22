// src/services/ApiRequestManager.js
const axios = require('axios');
const EventEmitter = require('events');

class ApiRequestManager extends EventEmitter {
  constructor() {
    super();
    
    // 连接池配置
    this.connectionPool = axios.create({
      timeout: 30000,
      maxRedirects: 5,
      keepAlive: true,
      maxSockets: 10,
      headers: {
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=5, max=1000'
      }
    });

    // 轮询管理
    this.activePolls = new Map();
    this.requestQueue = [];
    this.isProcessingQueue = false;
    
    // 配置
    this.config = {
      maxConcurrentRequests: 5,
      retryAttempts: 3,
      baseDelay: 5000, // 5秒基础延迟
      maxDelay: 60000, // 最大60秒延迟
      backoffMultiplier: 1.5 // 指数退避倍数
    };

    // 设置请求拦截器
    this.setupInterceptors();
  }

  setupInterceptors() {
    // 请求拦截器
    this.connectionPool.interceptors.request.use(
      (config) => {
        config.requestStartTime = Date.now();
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.connectionPool.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.requestStartTime;
        console.log(`API请求完成: ${response.config.url} (${duration}ms)`);
        return response;
      },
      (error) => {
        const duration = error.config ? Date.now() - error.config.requestStartTime : 0;
        console.log(`API请求失败: ${error.config?.url} (${duration}ms) - ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  async makeRequest(url, options = {}) {
    const requestConfig = {
      url,
      method: options.method || 'GET',
      data: options.data,
      headers: options.headers || {},
      timeout: options.timeout || 30000
    };

    return this.retryRequest(requestConfig);
  }

  async retryRequest(config, attempt = 1) {
    try {
      const response = await this.connectionPool(config);
      return response;
    } catch (error) {
      if (attempt < this.config.retryAttempts && this.isRetryableError(error)) {
        const delay = this.calculateBackoffDelay(attempt);
        console.log(`请求失败，${delay}ms后重试 (第${attempt}次重试): ${error.message}`);
        
        await this.sleep(delay);
        return this.retryRequest(config, attempt + 1);
      }
      
      throw error;
    }
  }

  isRetryableError(error) {
    // 判断是否是可重试的错误
    if (!error.response) {
      // 网络错误，连接超时等
      return true;
    }
    
    const status = error.response.status;
    // 5xx服务器错误或429限流错误可重试
    return status >= 500 || status === 429;
  }

  calculateBackoffDelay(attempt) {
    const delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * 1000; // 添加随机抖动
    return Math.min(delay + jitter, this.config.maxDelay);
  }

  // 智能轮询功能
  async startPolling(operationName, apiKey, options = {}) {
    const pollId = `${operationName}_${Date.now()}`;
    
    const pollConfig = {
      operationName,
      apiKey,
      pollId,
      interval: options.interval || this.config.baseDelay,
      maxAttempts: options.maxAttempts || 100,
      onProgress: options.onProgress || (() => {}),
      onComplete: options.onComplete || (() => {}),
      onError: options.onError || (() => {}),
      currentAttempt: 0,
      startTime: Date.now()
    };

    this.activePolls.set(pollId, pollConfig);
    this.pollOperation(pollConfig);
    
    return pollId;
  }

  async pollOperation(pollConfig) {
    const { operationName, apiKey, pollId } = pollConfig;
    
    try {
      pollConfig.currentAttempt++;
      
      const url = `https://generativelanguage.googleapis.com/v1beta/${operationName}`;
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        url: `${url}?key=${apiKey}`
      });

      const operation = response.data;
      
      // 调用进度回调
      pollConfig.onProgress(operation, pollConfig);
      
      if (operation.done) {
        // 操作完成
        this.activePolls.delete(pollId);
        pollConfig.onComplete(operation, pollConfig);
        return;
      }
      
      // 检查是否超过最大尝试次数
      if (pollConfig.currentAttempt >= pollConfig.maxAttempts) {
        this.activePolls.delete(pollId);
        pollConfig.onError(new Error('轮询超时'), pollConfig);
        return;
      }
      
      // 智能调整轮询间隔
      const newInterval = this.calculateAdaptiveInterval(pollConfig);
      pollConfig.interval = newInterval;
      
      // 继续轮询
      setTimeout(() => {
        if (this.activePolls.has(pollId)) {
          this.pollOperation(pollConfig);
        }
      }, newInterval);
      
    } catch (error) {
      console.error(`轮询操作失败 ${operationName}:`, error);
      
      // 如果是临时错误，继续重试
      if (this.isRetryableError(error) && pollConfig.currentAttempt < pollConfig.maxAttempts) {
        const retryDelay = this.calculateBackoffDelay(pollConfig.currentAttempt);
        setTimeout(() => {
          if (this.activePolls.has(pollId)) {
            this.pollOperation(pollConfig);
          }
        }, retryDelay);
      } else {
        // 永久性错误或超过重试次数
        this.activePolls.delete(pollId);
        pollConfig.onError(error, pollConfig);
      }
    }
  }

  calculateAdaptiveInterval(pollConfig) {
    const { currentAttempt, startTime } = pollConfig;
    const elapsedTime = Date.now() - startTime;
    
    // 根据已用时间和尝试次数智能调整间隔
    let interval = this.config.baseDelay;
    
    // 前几次快速轮询
    if (currentAttempt <= 3) {
      interval = 3000; // 3秒
    } 
    // 中期适中间隔
    else if (currentAttempt <= 10) {
      interval = 8000; // 8秒
    }
    // 后期较长间隔
    else if (currentAttempt <= 20) {
      interval = 15000; // 15秒
    }
    // 最终长间隔
    else {
      interval = 30000; // 30秒
    }
    
    // 如果已经运行很长时间，增加间隔
    if (elapsedTime > 5 * 60 * 1000) { // 5分钟后
      interval = Math.min(interval * 2, this.config.maxDelay);
    }
    
    return interval;
  }

  stopPolling(pollId) {
    if (this.activePolls.has(pollId)) {
      this.activePolls.delete(pollId);
      console.log(`停止轮询: ${pollId}`);
    }
  }

  getActivePolls() {
    return Array.from(this.activePolls.keys());
  }

  getPoolStats() {
    return {
      activePolls: this.activePolls.size,
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessingQueue
    };
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 清理资源
  destroy() {
    // 停止所有轮询
    this.activePolls.clear();
    
    // 清理请求队列
    this.requestQueue = [];
    
    console.log('ApiRequestManager已清理');
  }
}

// 单例模式
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new ApiRequestManager();
  }
  return instance;
}

module.exports = {
  ApiRequestManager,
  getInstance
};