// src/routes/video.js
const express = require('express');
const router = express.Router();
const VideoController = require('../controllers/VideoController');
const upload = require('../middleware/upload');
const { apiSecurity, uploadSecurity, validateApiKey, validateInput } = require('../middleware/security');

// 文字生成视频
router.post('/text-to-video', 
  apiSecurity,
  validateInput,
  validateApiKey,
  VideoController.generateVideoFromText
);

// 图片生成视频  
router.post('/image-to-video', 
  uploadSecurity,
  validateInput,
  upload.single('image'), 
  validateApiKey,
  VideoController.generateVideoFromImage
);

// 优化提示词
router.post('/optimize-prompt',
  apiSecurity,
  validateInput,
  validateApiKey,
  VideoController.optimizePrompt
);

// 下载视频
router.post('/download-video',
  apiSecurity,
  validateInput,
  validateApiKey,
  VideoController.downloadVideo
);

// 转码视频
router.post('/transcode-video',
  apiSecurity,
  validateInput,
  VideoController.transcodeVideo
);

module.exports = router;