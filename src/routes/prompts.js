// src/routes/prompts.js
const express = require('express');
const router = express.Router();
const PromptController = require('../controllers/PromptController');
const { apiSecurity, validateInput } = require('../middleware/security');
const { param } = require('express-validator');

// 获取所有模板
router.get('/prompts', apiSecurity, validateInput, PromptController.getTemplates);

// 获取随机模板
router.get('/prompts/random', apiSecurity, validateInput, PromptController.getRandomTemplate);

// 获取图片视频模板
router.get('/prompts/image-video', apiSecurity, validateInput, PromptController.getImageVideoTemplates);

// 按分类获取模板
router.get('/prompts/:category',
  apiSecurity,
  validateInput,
  [
    param('category').notEmpty().withMessage('分类名称不能为空').isString().withMessage('分类名称必须是字符串')
  ],
  PromptController.getTemplatesByCategory
);

// 获取随机图片模板
router.get('/prompts/image-random', apiSecurity, validateInput, PromptController.getRandomImageTemplate);

// 优化提示词
router.post('/prompts/optimize', apiSecurity, validateInput, PromptController.optimizePrompt);

module.exports = router;
