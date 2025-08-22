// src/services/VideoProcessingQueue.js
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

class VideoProcessingQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // 队列配置
    this.maxConcurrency = options.maxConcurrency || 3;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 5000;
    
    // 队列状态
    this.queue = [];
    this.processing = new Map();
    this.completed = new Map();
    this.failed = new Map();
    
    // 统计信息
    this.stats = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      activeJobs: 0
    };
    
    console.log(`视频处理队列初始化完成 - 最大并发数: ${this.maxConcurrency}`);
  }

  // 添加任务到队列
  async addJob(jobData) {
    const job = {
      id: this.generateJobId(),
      type: jobData.type,
      data: jobData.data,
      priority: jobData.priority || 0,
      attempts: 0,
      maxAttempts: jobData.maxAttempts || this.retryAttempts,
      createdAt: new Date(),
      status: 'pending',
      progress: 0,
      metadata: jobData.metadata || {}
    };

    // 根据优先级插入队列
    this.insertByPriority(job);
    
    this.stats.totalJobs++;
    
    console.log(`任务已添加到队列: ${job.id} (类型: ${job.type})`);
    
    // 触发处理
    this.processNext();
    
    return job.id;
  }

  // 根据优先级插入任务
  insertByPriority(job) {
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (job.priority > this.queue[i].priority) {
        this.queue.splice(i, 0, job);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.queue.push(job);
    }
  }

  // 处理下一个任务
  async processNext() {
    // 检查是否达到最大并发数
    if (this.processing.size >= this.maxConcurrency) {
      return;
    }

    // 检查队列是否为空
    if (this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    this.processing.set(job.id, job);
    this.stats.activeJobs++;

    job.status = 'processing';
    job.startedAt = new Date();

    console.log(`开始处理任务: ${job.id} (类型: ${job.type})`);

    try {
      // 根据任务类型处理
      const result = await this.executeJob(job);
      
      // 任务成功完成
      await this.completeJob(job, result);
      
    } catch (error) {
      // 任务失败，尝试重试
      await this.handleJobFailure(job, error);
    }

    // 继续处理下一个任务
    this.processNext();
  }

  // 执行具体任务
  async executeJob(job) {
    const { type, data } = job;

    switch (type) {
      case 'transcode':
        return await this.executeTranscodeJob(job);
      
      case 'thumbnail':
        return await this.executeThumbnailJob(job);
      
      case 'analyze':
        return await this.executeAnalyzeJob(job);
      
      case 'compress':
        return await this.executeCompressJob(job);
      
      default:
        throw new Error(`未知的任务类型: ${type}`);
    }
  }

  // 执行转码任务
  async executeTranscodeJob(job) {
    const TranscodeService = require('./TranscodeService');
    const { inputPath, format, resolution, fps, socketId } = job.data;

    // 更新进度
    this.updateJobProgress(job, 10, '开始转码');

    try {
      const result = await TranscodeService.transcodeVideo({
        inputPath,
        format: format || 'mp4',
        resolution: resolution || '720p',
        fps: fps || 30,
        socketId,
        onProgress: (progress) => {
          this.updateJobProgress(job, 10 + progress * 0.8, `转码中: ${Math.round(progress)}%`);
        }
      });

      this.updateJobProgress(job, 100, '转码完成');
      return result;

    } catch (error) {
      throw new Error(`转码失败: ${error.message}`);
    }
  }

  // 执行缩略图生成任务
  async executeThumbnailJob(job) {
    const ffmpeg = require('fluent-ffmpeg');
    const { inputPath, outputPath, timestamp = 1 } = job.data;

    this.updateJobProgress(job, 20, '生成缩略图');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '320x240'
        })
        .on('end', () => {
          this.updateJobProgress(job, 100, '缩略图生成完成');
          resolve({ thumbnailPath: outputPath });
        })
        .on('error', (error) => {
          reject(new Error(`缩略图生成失败: ${error.message}`));
        });
    });
  }

  // 执行视频分析任务
  async executeAnalyzeJob(job) {
    const TranscodeService = require('./TranscodeService');
    const { inputPath } = job.data;

    this.updateJobProgress(job, 30, '分析视频信息');

    try {
      const info = await TranscodeService.getVideoInfo(inputPath);
      this.updateJobProgress(job, 100, '视频分析完成');
      return info;
    } catch (error) {
      throw new Error(`视频分析失败: ${error.message}`);
    }
  }

  // 执行压缩任务
  async executeCompressJob(job) {
    const ffmpeg = require('fluent-ffmpeg');
    const { inputPath, outputPath, quality = 'medium' } = job.data;

    this.updateJobProgress(job, 10, '开始压缩');

    const qualitySettings = {
      low: { crf: 28, preset: 'fast' },
      medium: { crf: 23, preset: 'medium' },
      high: { crf: 18, preset: 'slow' }
    };

    const settings = qualitySettings[quality] || qualitySettings.medium;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .addOption('-crf', settings.crf)
        .addOption('-preset', settings.preset)
        .on('progress', (progress) => {
          const percent = Math.round(progress.percent || 0);
          this.updateJobProgress(job, 10 + percent * 0.8, `压缩中: ${percent}%`);
        })
        .on('end', () => {
          this.updateJobProgress(job, 100, '压缩完成');
          resolve({ outputPath });
        })
        .on('error', (error) => {
          reject(new Error(`压缩失败: ${error.message}`));
        })
        .save(outputPath);
    });
  }

  // 更新任务进度
  updateJobProgress(job, progress, message) {
    job.progress = Math.min(100, Math.max(0, progress));
    job.lastUpdate = new Date();
    
    console.log(`任务 ${job.id}: ${message} (${job.progress}%)`);
    
    // 发送进度事件
    this.emit('jobProgress', {
      jobId: job.id,
      progress: job.progress,
      message: message,
      type: job.type
    });
  }

  // 完成任务
  async completeJob(job, result) {
    job.status = 'completed';
    job.completedAt = new Date();
    job.result = result;
    job.progress = 100;

    this.processing.delete(job.id);
    this.completed.set(job.id, job);
    
    this.stats.completedJobs++;
    this.stats.activeJobs--;

    console.log(`任务完成: ${job.id} (耗时: ${job.completedAt - job.startedAt}ms)`);

    // 发送完成事件
    this.emit('jobCompleted', {
      jobId: job.id,
      result: result,
      duration: job.completedAt - job.startedAt
    });
  }

  // 处理任务失败
  async handleJobFailure(job, error) {
    job.attempts++;
    job.lastError = error.message;
    job.lastAttemptAt = new Date();

    console.log(`任务失败: ${job.id} - ${error.message} (尝试 ${job.attempts}/${job.maxAttempts})`);

    if (job.attempts < job.maxAttempts) {
      // 重试任务
      job.status = 'retrying';
      
      // 延迟后重新加入队列
      setTimeout(() => {
        this.processing.delete(job.id);
        this.insertByPriority(job);
        this.processNext();
      }, this.retryDelay * job.attempts); // 指数退避
      
    } else {
      // 任务彻底失败
      job.status = 'failed';
      job.failedAt = new Date();
      
      this.processing.delete(job.id);
      this.failed.set(job.id, job);
      
      this.stats.failedJobs++;
      this.stats.activeJobs--;

      console.log(`任务彻底失败: ${job.id} - ${error.message}`);

      // 发送失败事件
      this.emit('jobFailed', {
        jobId: job.id,
        error: error.message,
        attempts: job.attempts
      });
    }
  }

  // 获取任务状态
  getJobStatus(jobId) {
    // 检查正在处理的任务
    if (this.processing.has(jobId)) {
      return this.processing.get(jobId);
    }
    
    // 检查已完成的任务
    if (this.completed.has(jobId)) {
      return this.completed.get(jobId);
    }
    
    // 检查失败的任务
    if (this.failed.has(jobId)) {
      return this.failed.get(jobId);
    }
    
    // 检查队列中的任务
    const queuedJob = this.queue.find(job => job.id === jobId);
    if (queuedJob) {
      return queuedJob;
    }
    
    return null;
  }

  // 取消任务
  cancelJob(jobId) {
    // 从队列中移除
    const queueIndex = this.queue.findIndex(job => job.id === jobId);
    if (queueIndex !== -1) {
      const job = this.queue.splice(queueIndex, 1)[0];
      job.status = 'cancelled';
      console.log(`任务已从队列中取消: ${jobId}`);
      return true;
    }
    
    // 如果正在处理，标记为取消（实际终止可能需要额外处理）
    if (this.processing.has(jobId)) {
      const job = this.processing.get(jobId);
      job.status = 'cancelling';
      console.log(`正在处理的任务标记为取消: ${jobId}`);
      return true;
    }
    
    return false;
  }

  // 获取队列统计
  getQueueStats() {
    return {
      ...this.stats,
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      completedCount: this.completed.size,
      failedCount: this.failed.size
    };
  }

  // 获取所有任务状态
  getAllJobs() {
    const allJobs = [];
    
    // 队列中的任务
    allJobs.push(...this.queue.map(job => ({ ...job, status: 'queued' })));
    
    // 正在处理的任务
    allJobs.push(...Array.from(this.processing.values()));
    
    // 已完成的任务（最近的50个）
    const completedJobs = Array.from(this.completed.values())
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, 50);
    allJobs.push(...completedJobs);
    
    // 失败的任务（最近的20个）
    const failedJobs = Array.from(this.failed.values())
      .sort((a, b) => b.failedAt - a.failedAt)
      .slice(0, 20);
    allJobs.push(...failedJobs);
    
    return allJobs;
  }

  // 清理过期任务
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    // 清理已完成的任务
    for (const [jobId, job] of this.completed.entries()) {
      if (now - job.completedAt.getTime() > maxAge) {
        this.completed.delete(jobId);
      }
    }
    
    // 清理失败的任务
    for (const [jobId, job] of this.failed.entries()) {
      if (now - job.failedAt.getTime() > maxAge) {
        this.failed.delete(jobId);
      }
    }
    
    console.log('视频处理队列清理完成');
  }

  // 生成任务ID
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 暂停队列
  pause() {
    this.isPaused = true;
    console.log('视频处理队列已暂停');
  }

  // 恢复队列
  resume() {
    this.isPaused = false;
    console.log('视频处理队列已恢复');
    this.processNext();
  }
}

// 单例模式
let instance = null;

function getInstance(options) {
  if (!instance) {
    instance = new VideoProcessingQueue(options);
  }
  return instance;
}

module.exports = {
  VideoProcessingQueue,
  getInstance
};