// src/routes/video.js
const express = require('express');
const router = express.Router();
const VideoController = require('../controllers/VideoController');
const upload = require('../middleware/upload');
const { apiSecurity, uploadSecurity, validateInput } = require('../middleware/security'); // 移除 validateApiKey
const { body } = require('express-validator'); // 引入 body

// 文字生成视频
router.post('/text-to-video',
  apiSecurity,
  validateInput,
  [
    body('text').notEmpty().withMessage('文本描述不能为空').isString().withMessage('文本描述必须是字符串'),
    body('model').optional().isString().withMessage('模型ID必须是字符串'),
    body('negativePrompt').optional().isString().withMessage('负面提示必须是字符串'),
    body('webhookUrl').optional().isURL().withMessage('Webhook URL格式不正确')
  ],
  VideoController.generateVideoFromText
);

// 图片生成视频  
router.post('/image-to-video',
  uploadSecurity,
  validateInput,
  upload.single('image'),
  [
    body('prompt').notEmpty().withMessage('图片描述不能为空').isString().withMessage('图片描述必须是字符串'),
    body('model').optional().isString().withMessage('模型ID必须是字符串'),
    body('negativePrompt').optional().isString().withMessage('负面提示必须是字符串'),
    body('webhookUrl').optional().isURL().withMessage('Webhook URL格式不正确'),
    body('file').custom((value, { req }) => {
      if (!req.file) throw new Error('请上传图片文件');
      return true;
    }).withMessage('请上传图片文件')
  ],
  VideoController.generateVideoFromImage
);


// 下载视频
router.post('/download-video',
  apiSecurity,
  validateInput,
  [
    body('videoUri').notEmpty().withMessage('视频URI不能为空').isURL().withMessage('视频URI格式不正确')
  ],
  VideoController.downloadVideo
);

// 转码视频

router.post('/transcode-video',

  apiSecurity,

  validateInput,

  [

    body('inputPath').notEmpty().withMessage('输入路径不能为空').isString().withMessage('输入路径必须是字符串'),

    body('format').notEmpty().withMessage('格式不能为空').isIn(['mp4', 'webm', 'mov']).withMessage('无效的视频格式'),

    body('resolution').optional().isIn(['1080p', '720p', '480p', '360p']).withMessage('无效的分辨率'), // 增加一个更低的分辨率选项

    body('fps').optional().isInt({ min: 1, max: 60 }).withMessage('帧率必须是1到60之间的整数') // 限制帧率范围

  ],

  VideoController.transcodeVideo

);



// 生成GIF

router.post('/generate-gif',

  apiSecurity,

  validateInput,

  [

    body('inputPath').notEmpty().withMessage('视频路径不能为空').isString().withMessage('视频路径必须是字符串')

  ],

  VideoController.generateGif

);



// 截取视频封面

router.post('/capture-thumbnail',

  apiSecurity,

  validateInput,

  [

    body('inputPath').notEmpty().withMessage('视频路径不能为空').isString().withMessage('视频路径必须是字符串'),

    body('time').optional().isString().withMessage('时间点必须是字符串，例如 00:00:01')

  ],

  VideoController.captureThumbnail

);



module.exports = router;