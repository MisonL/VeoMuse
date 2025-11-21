// src/controllers/VideoController.js
const VideoService = require('../services/VideoService');
const OperationService = require('../services/OperationService');
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

      const { text, negativePrompt, model, webhookUrl } = req.body;
      const socketId = req.headers['socket-id'];

      const result = await VideoService.generateFromText({
        text,
        negativePrompt,
        model,
        webhookUrl,
        socketId
      });

      // 自动开始轮询操作状态
      if (result.success && result.operationName) {
        OperationService.getOperationStatus({
          operationName: result.operationName,
          webhookUrl,
          socketId,
          type: 'text' // 标记为文字生成
        }).catch(err => console.error('Failed to start auto-polling for text:', err));
      }

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

      const { prompt, negativePrompt, webhookUrl } = req.body;
      const socketId = req.headers['socket-id'];

      const result = await VideoService.generateFromImage({
        imagePath: req.file.path,
        prompt,
        negativePrompt,
        webhookUrl,
        socketId
      });

      // 自动开始轮询操作状态
      if (result.success && result.operationName) {
        OperationService.getOperationStatus({
          operationName: result.operationName,
          webhookUrl,
          socketId,
          type: 'image' // 标记为图片生成
        }).catch(err => console.error('Failed to start auto-polling for image:', err));
      }

      res.json(result);
    } catch (error) {
      console.error('Image to video generation error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }


  // 下载视频
  static async downloadVideo(req, res) {
    try {
      const { videoUri } = req.body;

      if (!videoUri) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数'
        });
      }

      const result = await VideoService.downloadVideo(videoUri);

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

  // 生成GIF
  static async generateGif(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      const { inputPath } = req.body;
      const result = await VideoService.generateGif(inputPath);
      res.json(result);
    } catch (error) {
      console.error('Generate GIF error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 截取视频封面
  static async captureThumbnail(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      const { inputPath, time } = req.body;
      const result = await VideoService.captureThumbnail(inputPath, time);
      res.json(result);
    } catch (error) {
      console.error('Capture thumbnail error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = VideoController;