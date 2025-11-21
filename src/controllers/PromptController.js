const PromptService = require('../services/PromptService');
const { validationResult } = require('express-validator');

class PromptController {
  static async getTemplates(req, res) {
    try {
      const templates = await PromptService.getAllTemplates();
      res.json({ success: true, templates });
    } catch (error) {
      console.error('获取所有模板失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getTemplatesByCategory(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      const { category } = req.params;
      const templates = await PromptService.getTemplatesByCategory(category);
      res.json({ success: true, templates });
    } catch (error) {
      console.error('按分类获取模板失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getRandomTemplate(req, res) {
    try {
      const template = await PromptService.getRandomTemplate();
      res.json({ success: true, template });
    } catch (error) {
      console.error('获取随机模板失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getImageVideoTemplates(req, res) {
    try {
      const templates = await PromptService.getImageVideoTemplates();
      res.json({ success: true, templates });
    } catch (error) {
      console.error('获取图片视频模板失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getRandomImageTemplate(req, res) {
    try {
      const template = await PromptService.getRandomImageTemplate();
      res.json({ success: true, template });
    } catch (error) {
      console.error('获取随机图片模板失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async optimizePrompt(req, res) {
    try {
      const { prompt, model } = req.body;
      if (!prompt) {
        return res.status(400).json({ success: false, error: '提示词不能为空' });
      }

      const optimizedPrompt = await PromptService.optimizePrompt(prompt, model);
      res.json({ success: true, optimizedPrompt });
    } catch (error) {
      console.error('优化提示词失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = PromptController;
