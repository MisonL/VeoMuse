// src/services/BatchVideoService.js
const EventEmitter = require('events');
const { getInstance: getVideoProcessingQueue } = require('./VideoProcessingQueue');
const VideoService = require('./VideoService');
const PromptService = require('./PromptService');
const SocketService = require('./SocketService');
const OperationService = require('./OperationService');
const path = require('path');
const fs = require('fs').promises;

class BatchVideoService extends EventEmitter {
  constructor() {
    super();

    this.batches = new Map();
    this.templates = new Map();

    // 加载默认模板
    this.loadDefaultTemplates();

    console.log('BatchVideoService 初始化完成');
  }

  // 加载默认模板
  loadDefaultTemplates() {
    const defaultTemplates = [
      {
        id: 'social_media',
        name: '社交媒体视频',
        description: '适合社交媒体平台的短视频模板',
        basePrompt: '创建一个引人注目的短视频，适合在社交媒体上分享。',
        settings: {
          duration: 15,
          resolution: '1080x1920', // 竖屏
          style: '现代,活力,吸引人'
        },
        variations: [
          { suffix: '使用明亮的色彩和快节奏的音乐' },
          { suffix: '采用简约的设计风格' },
          { suffix: '包含动态文字效果' }
        ]
      },
      {
        id: 'product_showcase',
        name: '产品展示',
        description: '产品介绍和展示视频模板',
        basePrompt: '展示产品的特点和优势，突出其独特价值。',
        settings: {
          duration: 30,
          resolution: '1920x1080',
          style: '专业,清晰,信任感'
        },
        variations: [
          { suffix: '从多个角度展示产品' },
          { suffix: '重点突出产品的核心功能' },
          { suffix: '展示产品的使用场景' }
        ]
      },
      {
        id: 'tutorial',
        name: '教程视频',
        description: '教学和指导类视频模板',
        basePrompt: '创建一个清晰易懂的教程视频，帮助观众学习新技能。',
        settings: {
          duration: 60,
          resolution: '1920x1080',
          style: '清晰,有序,易懂'
        },
        variations: [
          { suffix: '分步骤详细说明' },
          { suffix: '包含实践演示' },
          { suffix: '添加重点提示和注意事项' }
        ]
      }
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });

    console.log(`已加载 ${defaultTemplates.length} 个默认模板`);
  }

  // 创建批量生成任务
  async createBatch(batchData) {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const batch = {
      id: batchId,
      name: batchData.name || `批量任务_${new Date().toLocaleString()}`,
      userId: batchData.userId,
      status: 'preparing',
      createdAt: new Date(),
      updatedAt: new Date(),

      // 输入数据
      inputs: batchData.inputs || [], // 文本提示词数组或图片路径数组
      template: batchData.template, // 使用的模板
      settings: batchData.settings || {},

      // 处理状态
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      progress: 0,

      // 结果
      results: [],
      errors: [],

      // 配置
      config: {
        apiKey: batchData.apiKey,
        model: batchData.model,
        optimizePrompts: batchData.optimizePrompts !== false,
        maxConcurrent: batchData.maxConcurrent || 3,
        retryAttempts: batchData.retryAttempts || 2,
        socketId: batchData.socketId
      }
    };

    this.batches.set(batchId, batch);

    console.log(`批量任务已创建: ${batchId}`);

    // 开始处理
    this.processBatch(batchId);

    return {
      batchId,
      status: batch.status,
      totalJobs: batch.totalJobs
    };
  }

  // 处理批量任务
  async processBatch(batchId) {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error('批量任务不存在');
    }

    try {
      batch.status = 'processing';
      batch.updatedAt = new Date();

      // 准备任务列表
      const jobs = await this.prepareBatchJobs(batch);
      batch.totalJobs = jobs.length;

      if (jobs.length === 0) {
        batch.status = 'completed';
        this.emitBatchUpdate(batch);
        return;
      }

      this.emitBatchUpdate(batch);

      // 执行批量任务
      await this.executeBatchJobs(batch, jobs);

    } catch (error) {
      console.error(`批量任务处理失败 ${batchId}:`, error);
      batch.status = 'failed';
      batch.error = error.message;
      batch.updatedAt = new Date();
      this.emitBatchUpdate(batch);
    }
  }

  // 准备批量任务
  async prepareBatchJobs(batch) {
    const jobs = [];
    const { inputs, template, config } = batch;

    // 获取模板设置
    let templateData = null;
    if (template) {
      templateData = this.templates.get(template);
      if (!templateData) {
        throw new Error(`模板不存在: ${template}`);
      }
    }

    // 为每个输入创建任务
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];

      // 生成提示词
      let prompt = input.text || input.prompt;

      if (templateData) {
        // 应用模板
        prompt = this.applyTemplate(templateData, input, i);
      }

      const job = {
        id: `${batch.id}_job_${i}`,
        batchId: batch.id,
        index: i,
        type: input.image ? 'image-to-video' : 'text-to-video',
        input: input,
        prompt: prompt,
        status: 'pending',
        createdAt: new Date()
      };

      jobs.push(job);
    }

    return jobs;
  }

  // 应用模板到输入
  applyTemplate(template, input, index) {
    let prompt = template.basePrompt;

    // 添加用户输入
    if (input.text || input.prompt) {
      prompt += ` ${input.text || input.prompt}`;
    }

    // 应用变化
    if (template.variations && template.variations.length > 0) {
      const variation = template.variations[index % template.variations.length];
      prompt += ` ${variation.suffix}`;
    }

    // 应用样式设置
    if (template.settings && template.settings.style) {
      prompt += ` 风格: ${template.settings.style}`;
    }

    return prompt;
  }

  // 执行批量任务
  async executeBatchJobs(batch, jobs) {
    const { config } = batch;
    const maxConcurrent = config.maxConcurrent || 3;

    // 分批处理任务
    const batches = this.chunkArray(jobs, maxConcurrent);

    for (const jobBatch of batches) {
      // 并行执行当前批次的任务
      const promises = jobBatch.map(job => this.executeSingleJob(batch, job));

      try {
        await Promise.allSettled(promises);
      } catch (error) {
        console.error('批次执行出错:', error);
      }

      // 更新批量任务状态
      this.updateBatchProgress(batch);

      // 如果所有任务都完成了，退出循环
      if (batch.completedJobs + batch.failedJobs >= batch.totalJobs) {
        break;
      }
    }

    // 完成批量任务
    this.completeBatch(batch);
  }

  // 执行单个任务
  async executeSingleJob(batch, job) {
    try {
      job.status = 'processing';
      job.startedAt = new Date();

      this.emitJobUpdate(batch, job);

      let result;
      let optimizedPrompt = job.prompt; // Initialize optimizedPrompt here

      if (job.type === 'image-to-video') {
        // 图片生成视频
        result = await VideoService.generateFromImage({
          imagePath: job.input.image,
          prompt: job.prompt,
          negativePrompt: job.input.negativePrompt,
          socketId: batch.config.socketId
        });
      } else {
        // 优化提示词（如果启用）
        if (batch.config.optimizePrompts) {
          try {
            optimizedPrompt = await PromptService.optimizePrompt(
              job.prompt,
              batch.config.apiKey,
              batch.config.model
            );
          } catch (error) {
            console.warn(`提示词优化失败，使用原始提示词: ${error.message}`);
          }
        }

        // 文字生成视频
        result = await VideoService.generateFromText({
          text: optimizedPrompt,
          negativePrompt: job.input.negativePrompt,
          apiKey: batch.config.apiKey,
          model: batch.config.model,
          socketId: batch.config.socketId
        });
      }

      // 如果返回了 operationName，说明是异步任务，需要轮询等待完成
      if (result.success && result.operationName) {
        const operationName = result.operationName;
        let isDone = false;
        let pollResult;

        console.log(`任务 ${job.id} 开始轮询: ${operationName}`);

        // 轮询最多 120 次，每次 5 秒，共 10 分钟
        for (let i = 0; i < 120; i++) {
          await new Promise(resolve => setTimeout(resolve, 5000));

          try {
            pollResult = await OperationService.checkStatus(operationName);

            if (pollResult.done) {
              isDone = true;
              if (pollResult.error) {
                throw new Error(pollResult.message || '生成失败');
              }

              // 更新结果
              result = {
                ...result,
                videoUri: pollResult.videoUrl,
                videoPath: pollResult.videoUrl
              };
              break;
            }
          } catch (err) {
            console.warn(`轮询出错 (尝试 ${i + 1}):`, err.message);
            // 继续轮询，除非是致命错误
          }
        }

        if (!isDone) {
          throw new Error('视频生成超时');
        }
      }

      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      job.optimizedPrompt = job.type === 'text-to-video' ? optimizedPrompt : null; // Use the local optimizedPrompt variable

      batch.completedJobs++;
      batch.results.push({
        jobId: job.id,
        index: job.index,
        input: job.input,
        result: result,
        prompt: job.prompt,
        optimizedPrompt: job.type === 'text-to-video' ? optimizedPrompt : null // Use the local optimizedPrompt variable
      });

      console.log(`批量任务 ${batch.id} 中的任务 ${job.id} 完成`);

    } catch (error) {
      job.status = 'failed';
      job.failedAt = new Date();
      job.error = error.message;

      batch.failedJobs++;
      batch.errors.push({
        jobId: job.id,
        index: job.index,
        input: job.input,
        error: error.message
      });

      console.error(`批量任务 ${batch.id} 中的任务 ${job.id} 失败:`, error);
    }

    this.emitJobUpdate(batch, job);
  }

  // 更新批量任务进度
  updateBatchProgress(batch) {
    const total = batch.totalJobs;
    const completed = batch.completedJobs + batch.failedJobs;

    batch.progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    batch.updatedAt = new Date();

    this.emitBatchUpdate(batch);
  }

  // 完成批量任务
  completeBatch(batch) {
    batch.status = batch.failedJobs > 0 ? 'completed_with_errors' : 'completed';
    batch.completedAt = new Date();
    batch.progress = 100;

    console.log(`批量任务完成: ${batch.id} - 成功: ${batch.completedJobs}, 失败: ${batch.failedJobs}`);

    this.emitBatchUpdate(batch);

    // 触发完成事件
    this.emit('batchCompleted', {
      batchId: batch.id,
      userId: batch.userId,
      stats: {
        total: batch.totalJobs,
        completed: batch.completedJobs,
        failed: batch.failedJobs
      }
    });
  }

  // 发送批量任务更新事件
  emitBatchUpdate(batch) {
    if (batch.config.socketId) {
      SocketService.emitToSocket(batch.config.socketId, 'batchUpdate', {
        batchId: batch.id,
        status: batch.status,
        progress: batch.progress,
        completedJobs: batch.completedJobs,
        failedJobs: batch.failedJobs,
        totalJobs: batch.totalJobs
      });
    }

    this.emit('batchUpdate', batch);
  }

  // 发送任务更新事件
  emitJobUpdate(batch, job) {
    if (batch.config.socketId) {
      SocketService.emitToSocket(batch.config.socketId, 'jobUpdate', {
        batchId: batch.id,
        jobId: job.id,
        status: job.status,
        index: job.index
      });
    }
  }

  // 获取批量任务状态
  getBatchStatus(batchId) {
    const batch = this.batches.get(batchId);
    if (!batch) {
      return null;
    }

    return {
      id: batch.id,
      name: batch.name,
      status: batch.status,
      progress: batch.progress,
      totalJobs: batch.totalJobs,
      completedJobs: batch.completedJobs,
      failedJobs: batch.failedJobs,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      completedAt: batch.completedAt,
      results: batch.results,
      errors: batch.errors
    };
  }

  // 获取用户的批量任务列表
  getUserBatches(userId, page = 1, limit = 20) {
    const userBatches = Array.from(this.batches.values())
      .filter(batch => batch.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);

    const total = userBatches.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedBatches = userBatches.slice(startIndex, endIndex);

    return {
      batches: paginatedBatches.map(batch => ({
        id: batch.id,
        name: batch.name,
        status: batch.status,
        progress: batch.progress,
        totalJobs: batch.totalJobs,
        completedJobs: batch.completedJobs,
        failedJobs: batch.failedJobs,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // 取消批量任务
  cancelBatch(batchId, userId = null) {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error('批量任务不存在');
    }

    if (userId && batch.userId !== userId) {
      throw new Error('无权限取消此批量任务');
    }

    if (batch.status === 'completed' || batch.status === 'failed') {
      throw new Error('任务已完成，无法取消');
    }

    batch.status = 'cancelled';
    batch.updatedAt = new Date();

    this.emitBatchUpdate(batch);

    console.log(`批量任务已取消: ${batchId}`);

    return true;
  }

  // 获取可用模板
  getTemplates() {
    return Array.from(this.templates.values());
  }

  // 添加自定义模板
  addTemplate(templateData) {
    const template = {
      id: templateData.id || `template_${Date.now()}`,
      name: templateData.name,
      description: templateData.description,
      basePrompt: templateData.basePrompt,
      settings: templateData.settings || {},
      variations: templateData.variations || [],
      createdAt: new Date(),
      isCustom: true
    };

    this.templates.set(template.id, template);

    return template;
  }

  // 工具方法：数组分块
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // 清理过期的批量任务
  cleanup() {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天

    for (const [batchId, batch] of this.batches.entries()) {
      if (now - batch.createdAt.getTime() > maxAge) {
        this.batches.delete(batchId);
      }
    }

    console.log('BatchVideoService 清理完成');
  }

  // 获取批量服务统计
  getStats() {
    const batches = Array.from(this.batches.values());

    return {
      totalBatches: batches.length,
      activeBatches: batches.filter(b => b.status === 'processing').length,
      completedBatches: batches.filter(b => b.status === 'completed').length,
      failedBatches: batches.filter(b => b.status === 'failed').length,
      totalJobs: batches.reduce((sum, b) => sum + b.totalJobs, 0),
      completedJobs: batches.reduce((sum, b) => sum + b.completedJobs, 0),
      availableTemplates: this.templates.size
    };
  }
}

// 单例模式
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new BatchVideoService();
  }
  return instance;
}

module.exports = {
  BatchVideoService,
  getInstance
};