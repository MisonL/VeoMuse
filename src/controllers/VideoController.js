// src/controllers/VideoController.js
const VideoService = require('../services/VideoService');
const PromptService = require('../services/PromptService');
const TranscodeService = require('../services/TranscodeService');
const { validationResult } = require('express-validator');

class VideoController {
  // 文字生成视频
  static async generateVideoFromText(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { text, negativePrompt, apiKey, model } = req.body;
      const socketId = req.headers['socket-id'];

      const result = await VideoService.generateFromText({
        text,
        negativePrompt,
        apiKey,
        model,
        socketId
      });

      res.json(result);
    } catch (error) {
      console.error('Text to video generation error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  // 图片生成视频
  static async generateVideoFromImage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: '请上传图片文件' 
        });
      }

      const { prompt, negativePrompt, apiKey } = req.body;
      const socketId = req.headers['socket-id'];

      const result = await VideoService.generateFromImage({
        imagePath: req.file.path,
        prompt,
        negativePrompt,
        apiKey,
        socketId
      });

      res.json(result);
    } catch (error) {
      console.error('Image to video generation error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  // 优化提示词
  static async optimizePrompt(req, res) {
    try {
      const { prompt, apiKey, model } = req.body;

      if (!prompt || !apiKey) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少必要参数' 
        });
      }

      const optimizedPrompt = await PromptService.optimizePrompt(prompt, apiKey, model);

      res.json({ 
        success: true, 
        optimizedPrompt 
      });
    } catch (error) {
      console.error('Prompt optimization error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  // 下载视频
  static async downloadVideo(req, res) {
    try {
      const { videoUri, apiKey } = req.body;

      if (!videoUri || !apiKey) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少必要参数' 
        });
      }

      const result = await VideoService.downloadVideo(videoUri, apiKey);

      res.json(result);
    } catch (error) {
      console.error('Video download error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  // 转码视频
  static async transcodeVideo(req, res) {
    try {
      const { inputPath, format, resolution, fps } = req.body;

      if (!inputPath) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少输入文件路径' 
        });
      }

      const result = await TranscodeService.transcodeVideo({
        inputPath,
        format: format || 'mp4',
        resolution: resolution || '720p',
        fps: fps || 30
      });

      res.json(result);
    } catch (error) {
      console.error('Video transcode error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

module.exports = VideoController;