// src/controllers/BatchController.js
const { getInstance: getBatchService } = require('../services/BatchVideoService');
const { validationResult } = require('express-validator');

const batchService = getBatchService();

class BatchController {
  // 创建批量任务
  static async createBatch(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { name, inputs, template, settings, optimizePrompts, maxConcurrent } = req.body;
      const userId = req.user.id;
      const apiKey = req.validatedApiKey;
      const socketId = req.headers['socket-id'];

      if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
        return res.status(400).json({
          success: false,
          error: '输入数据不能为空'
        });
      }

      const result = await batchService.createBatch({
        name,
        userId,
        inputs,
        template,
        settings,
        apiKey,
        optimizePrompts,
        maxConcurrent,
        socketId
      });

      res.json({
        success: true,
        message: '批量任务已创建',
        ...result
      });

    } catch (error) {
      console.error('创建批量任务失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // 获取批量任务状态
  static async getBatchStatus(req, res) {
    try {
      const { batchId } = req.params;
      const userId = req.user.id;

      const batch = batchService.getBatchStatus(batchId);
      
      if (!batch) {
        return res.status(404).json({
          success: false,
          error: '批量任务不存在'
        });
      }

      // 检查权限
      const fullBatch = batchService.batches.get(batchId);
      if (fullBatch.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: '无权限访问此批量任务'
        });
      }

      res.json({
        success: true,
        batch
      });

    } catch (error) {
      console.error('获取批量任务状态失败:', error);
      res.status(500).json({
        success: false,
        error: '获取批量任务状态失败'
      });
    }
  }

  // 获取用户的批量任务列表
  static async getUserBatches(req, res) {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = batchService.getUserBatches(userId, page, limit);

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('获取批量任务列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取批量任务列表失败'
      });
    }
  }

  // 取消批量任务
  static async cancelBatch(req, res) {
    try {
      const { batchId } = req.params;
      const userId = req.user.id;

      const result = batchService.cancelBatch(batchId, userId);

      res.json({
        success: true,
        message: '批量任务已取消'
      });

    } catch (error) {
      console.error('取消批量任务失败:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // 获取模板列表
  static async getTemplates(req, res) {
    try {
      const templates = batchService.getTemplates();

      res.json({
        success: true,
        templates
      });

    } catch (error) {
      console.error('获取模板列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取模板列表失败'
      });
    }
  }

  // 创建自定义模板
  static async createTemplate(req, res) {
    try {
      const templateData = req.body;
      const template = batchService.addTemplate(templateData);

      res.json({
        success: true,
        message: '模板创建成功',
        template
      });

    } catch (error) {
      console.error('创建模板失败:', error);
      res.status(500).json({
        success: false,
        error: '创建模板失败'
      });
    }
  }

  // 获取批量服务统计
  static async getStats(req, res) {
    try {
      const stats = batchService.getStats();

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('获取统计数据失败:', error);
      res.status(500).json({
        success: false,
        error: '获取统计数据失败'
      });
    }
  }
}

module.exports = BatchController;