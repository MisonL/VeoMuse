// src/middleware/upload.js
const multer = require('multer');
const path = require('path');
const config = require('../../config');

// 配置存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, config.upload.uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// 文件过滤器 - 只允许图片文件
const fileFilter = (req, file, cb) => {
  if (config.upload.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件 (JPEG, PNG, GIF, WebP)'), false);
  }
};

// 创建 multer 实例
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: config.upload.maxSize
  },
  fileFilter: fileFilter
});

module.exports = upload;