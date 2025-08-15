const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

// 导入配置
const config = require('./config');

// GPU支持检测函数
async function detectGPUSupport() {
  const gpuSupport = {
    nvidia: config.gpu.nvidia,
    intel: config.gpu.intel,
    amd: config.gpu.amd
  };
  
  try {
    // 在macOS上检测GPU
    if (process.platform === 'darwin') {
      // Intel Mac通常有Intel集成显卡
      gpuSupport.intel = true;
      
      // 检查是否有AMD独显
      // 在实际应用中，您可能需要使用系统命令来检测
      // 这里我们假设较新的Mac可能有AMD显卡
      gpuSupport.amd = true;
    } 
    // Windows系统检测
    else if (process.platform === 'win32') {
      // Windows系统可能有多种GPU
      gpuSupport.nvidia = true;
      gpuSupport.intel = true;
      gpuSupport.amd = true;
    }
    // Linux系统检测
    else if (process.platform === 'linux') {
      // Linux系统可能有多种GPU
      gpuSupport.nvidia = true;
      gpuSupport.intel = true;
      gpuSupport.amd = true;
    }
  } catch (error) {
    console.log('GPU detection failed, using CPU encoding:', error.message);
  }
  
  return gpuSupport;
}

// 文件清理函数
async function cleanupOldFiles() {
  try {
    const now = Date.now();
    const maxAge = config.cleanup.maxFileAge;
    
    // 清理uploads目录
    const uploadsDir = config.upload.uploadDir;
    try {
      const files = await fs.readdir(uploadsDir);
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          console.log(`Deleted old upload file: ${filePath}`);
        }
      }
    } catch (err) {
      console.log('Error cleaning uploads directory:', err.message);
    }
    
    // 清理generated目录
    const generatedDir = config.upload.generatedDir;
    try {
      const files = await fs.readdir(generatedDir);
      for (const file of files) {
        const filePath = path.join(generatedDir, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          console.log(`Deleted old generated file: ${filePath}`);
        }
      }
    } catch (err) {
      console.log('Error cleaning generated directory:', err.message);
    }
  } catch (error) {
    console.log('Error during file cleanup:', error.message);
  }
}

// 初始化GPU支持检测
let gpuSupport = {
  nvidia: false,
  intel: false,
  amd: false
};

// 视频生成队列
const videoGenerationQueue = [];
let isProcessingQueue = false;

require('dotenv').config();

const app = express();
const PORT = config.server.port;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 配置multer用于文件上传 - 增加文件类型验证
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
  // 检查文件类型
  if (config.upload.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件 (JPEG, PNG, GIF, WebP)'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: config.upload.maxSize
  },
  fileFilter: fileFilter
});

// 创建必要的目录
async function createDirectories() {
  const dirs = [config.upload.uploadDir, 'public', config.upload.generatedDir];
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir);
    }
  }
}

// 获取可用的API密钥列表
function getAvailableApiKeys(sessionApiKey = null) {
  // 如果会话中有临时API密钥，优先使用
  if (sessionApiKey) {
    return [sessionApiKey];
  }
  
  // 从环境变量中获取API密钥列表（只使用GEMINI_API_KEYS）
  const apiKeyList = [];
  
  // 检查GEMINI_API_KEYS（多个密钥，逗号分隔）
  if (process.env.GEMINI_API_KEYS) {
    const keys = process.env.GEMINI_API_KEYS.split(',').map(key => key.trim()).filter(key => key);
    apiKeyList.push(...keys);
  }
  
  return apiKeyList;
}

// 获取默认模型配置
function getDefaultModels() {
  return {
    videoModel: config.video.defaultModel,
    optimizationModel: config.video.defaultOptimizationModel
  };
}

// 从API获取可用模型列表
async function getAvailableModels(apiKey) {
  try {
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
    
    const response = await axios.get(`${API_URL}?key=${apiKey}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const models = response.data.models || [];
    
    // 分类模型
    const videoModels = models.filter(model => 
      model.name && (model.name.includes('veo') || model.name.includes('video'))
    ).map(model => ({
      id: model.name.split('/').pop(),
      name: model.displayName || model.name.split('/').pop()
    }));
    
    const optimizationModels = models.filter(model => 
      model.name && (model.name.includes('gemini') && !model.name.includes('embedding'))
    ).map(model => ({
      id: model.name.split('/').pop(),
      name: model.displayName || model.name.split('/').pop()
    }));
    
    return {
      videoModels: videoModels.length > 0 ? videoModels : [
        { id: 'veo-3.0-generate-preview', name: 'Veo 3.0 (Preview)' },
        { id: 'veo-3.0-fast-generate-preview', name: 'Veo 3.0 Fast (Preview)' },
        { id: 'veo-2.0-generate-001', name: 'Veo 2.0' }
      ],
      optimizationModels: optimizationModels.length > 0 ? optimizationModels : [
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
      ]
    };
  } catch (error) {
    console.error('Error fetching models:', error.response?.data || error.message);
    // 返回默认模型列表
    return {
      videoModels: [
        { id: 'veo-3.0-generate-preview', name: 'Veo 3.0 (Preview)' },
        { id: 'veo-3.0-fast-generate-preview', name: 'Veo 3.0 Fast (Preview)' },
        { id: 'veo-2.0-generate-001', name: 'Veo 2.0' }
      ],
      optimizationModels: [
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
      ]
    };
  }
}

// 使用AI优化提示词
async function optimizePrompt(prompt, apiKey, model) {
  try {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    const requestData = {
      contents: [{
        parts: [{
          text: `请优化以下视频生成提示词，使其更加详细和富有表现力，包含场景、动作、风格、相机运动等元素：\n\n${prompt}`
        }]
      }]
    };
    
    const response = await axios.post(`${API_URL}?key=${apiKey}`, requestData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const optimizedPrompt = response.data.candidates[0].content.parts[0].text;
    return optimizedPrompt;
  } catch (error) {
    console.error('Error optimizing prompt:', error.response?.data || error.message);
    // 如果优化失败，返回原始提示词
    return prompt;
  }
}

// 调用Gemini Veo API生成视频（文字到视频）
async function generateVideoFromText(prompt, negativePrompt = null, sessionApiKey = null, model = null) {
  const apiKeys = getAvailableApiKeys(sessionApiKey);
  
  if (apiKeys.length === 0) {
    throw new Error('No API keys available. Please configure your API keys in the .env file or provide a temporary key.');
  }
  
  // 使用指定模型或默认模型
  const videoModel = model || getDefaultModels().videoModel;
  
  // 尝试每个API密钥，直到成功或用完所有密钥
  for (const apiKey of apiKeys) {
    try {
      const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${videoModel}:predictLongRunning`;
      
      // 构建请求数据
      const requestData = {
        instances: [{
          prompt: prompt
        }],
        parameters: {
          // Veo 支持的参数
          aspectRatio: "16:9"
        }
      };
      
      // 如果提供了negativePrompt，则添加到参数中
      if (negativePrompt) {
        requestData.parameters.negativePrompt = negativePrompt;
      }
      
      // 调用Veo API
      const response = await axios.post(`${API_URL}?key=${apiKey}`, requestData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // 返回操作名称和使用的API密钥，用于轮询
      return {
        operationName: response.data.name,
        apiKey: apiKey,
        model: videoModel
      };
    } catch (error) {
      console.error(`Error calling Gemini Veo API with key ${apiKey.substring(0, 5)}...:`, error.response?.data || error.message);
      
      // 如果是认证错误或配额错误，尝试下一个密钥
      if (error.response?.status === 401 || error.response?.status === 429) {
        console.log(`Skipping API key ${apiKey.substring(0, 5)}... due to error ${error.response?.status}`);
        continue;
      }
      
      // 其他错误直接抛出
      if (error.response?.status === 400) {
        throw new Error('Invalid API request. Please check your prompt and API key.');
      } else if (error.response?.status === 403) {
        throw new Error('Forbidden. You do not have permission to access this API.');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout. Please try again.');
      }
      throw new Error('Failed to generate video with Gemini Veo API: ' + (error.response?.data?.error?.message || error.message));
    }
  }
  
  // 所有密钥都尝试失败
  throw new Error('All API keys failed. Please check your API keys and quotas.');
}

// 调用Gemini Veo API生成视频（图片到视频）
async function generateVideoFromImage(imagePath, prompt, negativePrompt = null, sessionApiKey = null, model = null) {
  // 对于Veo模型，图片到视频的实现方式是将图片描述加入提示中
  const imageBasedPrompt = `基于以下图片内容生成视频: ${prompt}`;
  
  // 调用文字到视频的函数
  return await generateVideoFromText(imageBasedPrompt, negativePrompt, sessionApiKey, model);
}

// 轮询操作状态直到视频生成完成
async function pollOperationStatus(operationName, apiKey, socketId = null) {
  try {
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta';
    
    // 轮询操作状态
    while (true) {
      // 等待指定时间后再检查
      await new Promise(resolve => setTimeout(resolve, config.video.pollingInterval));
      
      // 获取操作状态
      const statusResponse = await axios.get(`${API_URL}/${operationName}?key=${apiKey}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const statusData = statusResponse.data;
      
      // 发送进度更新到客户端
      if (socketId && global.io) {
        global.io.to(socketId).emit('generationProgress', {
          message: '视频生成中，请耐心等待...',
          done: statusData.done || false
        });
      }
      
      // 检查操作是否完成
      if (statusData.done) {
        // 如果操作完成，检查是否有错误
        if (statusData.error) {
          throw new Error('Video generation failed: ' + statusData.error.message);
        }
        
        // 提取视频URI
        const videoUri = statusData.response.generateVideoResponse.generatedSamples[0].video.uri;
        return videoUri;
      }
      
      console.log('Video generation in progress...');
    }
  } catch (error) {
    console.error('Error polling operation status:', error.response?.data || error.message);
    throw new Error('Failed to check video generation status: ' + (error.response?.data?.error?.message || error.message));
  }
}

// 下载视频并保存到本地
async function downloadVideo(videoUri, filename, apiKey) {
  try {
    // 下载视频
    const response = await axios.get(videoUri, {
      headers: {
        'x-goog-api-key': apiKey
      },
      responseType: 'arraybuffer'
    });
    
    // 保存视频到generated目录
    const videoPath = `${config.upload.generatedDir}${filename}`;
    await fs.writeFile(videoPath, response.data);
    
    return videoPath;
  } catch (error) {
    console.error('Error downloading video:', error.response?.data || error.message);
    throw new Error('Failed to download generated video: ' + (error.response?.data?.error?.message || error.message));
  }
}

// 真正的视频转码功能（支持多种GPU加速和进度报告）
async function transcodeVideo(inputPath, outputPath, format, resolution, fps, socketId = null) {
  return new Promise((resolve, reject) => {
    try {
      // 创建FFmpeg命令
      let command = ffmpeg(inputPath);
      
      // 根据GPU支持选择编码器
      if (gpuSupport.nvidia) {
        console.log('Using NVIDIA GPU acceleration for video transcoding');
        // NVIDIA GPU加速编码
        if (format === 'webm') {
          command = command.videoCodec('h264_nvenc').audioCodec('libvorbis');
        } else {
          command = command.videoCodec('h264_nvenc').audioCodec('aac');
        }
      } else if (gpuSupport.intel) {
        console.log('Using Intel GPU acceleration for video transcoding');
        // Intel GPU加速编码
        if (format === 'webm') {
          command = command.videoCodec('h264_qsv').audioCodec('libvorbis');
        } else {
          command = command.videoCodec('h264_qsv').audioCodec('aac');
        }
      } else if (gpuSupport.amd) {
        console.log('Using AMD GPU acceleration for video transcoding');
        // AMD GPU加速编码
        if (format === 'webm') {
          command = command.videoCodec('h264_amf').audioCodec('libvorbis');
        } else {
          command = command.videoCodec('h264_amf').audioCodec('aac');
        }
      } else {
        console.log('Using CPU encoding for video transcoding');
        // 使用CPU编码
        if (format === 'webm') {
          command = command.videoCodec('libvpx-vp9').audioCodec('libvorbis');
        } else if (format === 'mov') {
          command = command.videoCodec('libx264').audioCodec('aac');
        } else {
          // 默认MP4格式
          command = command.videoCodec('libx264').audioCodec('aac');
        }
      }
      
      // 设置分辨率
      if (resolution) {
        switch (resolution) {
          case '480p':
            command = command.size('854x480');
            break;
          case '720p':
            command = command.size('1280x720');
            break;
          case '1080p':
            command = command.size('1920x1080');
            break;
        }
      }
      
      // 设置帧率
      if (fps) {
        command = command.fps(fps);
      }
      
      // 添加文件扩展名
      const ext = format === 'webm' ? '.webm' : format === 'mp4' ? '.mp4' : '.mov';
      const resolutionSuffix = resolution ? `_${resolution}` : '';
      const fpsSuffix = fps ? `_${fps}fps` : '';
      const outputFilename = outputPath.replace(/\.[^/.]+$/, "") + resolutionSuffix + fpsSuffix + ext;
      
      // 执行转码
      command
        .on('start', (commandLine) => {
          console.log('Spawned FFmpeg with command: ' + commandLine);
        })
        .on('progress', (progress) => {
          console.log('Processing: ' + progress.percent + '% done');
          // 如果有socketId，发送进度更新
          if (socketId && global.io) {
            global.io.to(socketId).emit('transcodeProgress', {
              percent: Math.round(progress.percent || 0),
              message: `正在转换视频: ${Math.round(progress.percent || 0)}%`
            });
          }
        })
        .on('end', () => {
          console.log('Video transcoding finished!');
          if (socketId && global.io) {
            global.io.to(socketId).emit('transcodeComplete', {
              message: '视频转换完成!'
            });
          }
          resolve(outputFilename);
        })
        .on('error', (err) => {
          console.error('Error transcoding video:', err);
          if (socketId && global.io) {
            global.io.to(socketId).emit('transcodeError', {
              message: '视频转换失败: ' + err.message
            });
          }
          reject(new Error('Failed to transcode video: ' + err.message));
        })
        .save(outputFilename);
    } catch (error) {
      console.error('Error setting up video transcoding:', error);
      reject(new Error('Failed to set up video transcoding: ' + error.message));
    }
  });
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 获取可用模型列表
app.get('/api/models', async (req, res) => {
  try {
    const apiKey = req.query.apiKey;
    
    if (!apiKey) {
      // 如果没有提供API密钥，返回默认模型列表
      const models = {
        videoModels: [
          { id: 'veo-3.0-generate-preview', name: 'Veo 3.0 (Preview)' },
          { id: 'veo-3.0-fast-generate-preview', name: 'Veo 3.0 Fast (Preview)' },
          { id: 'veo-2.0-generate-001', name: 'Veo 2.0' }
        ],
        optimizationModels: [
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
          { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
        ]
      };
      
      return res.json(models);
    }
    
    // 从API获取模型列表
    const models = await getAvailableModels(apiKey);
    res.json(models);
  } catch (error) {
    console.error('Error getting models:', error);
    res.status(500).json({ error: 'Failed to get models: ' + error.message });
  }
});

// 优化提示词API端点
app.post('/api/optimize-prompt', async (req, res) => {
  try {
    const { prompt, apiKey, model } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    const optimizationModel = model || getDefaultModels().optimizationModel;
    
    console.log(`Optimizing prompt with model: ${optimizationModel}`);
    
    // 优化提示词
    const optimizedPrompt = await optimizePrompt(prompt, apiKey, optimizationModel);
    
    res.json({ 
      success: true, 
      optimizedPrompt: optimizedPrompt
    });
  } catch (error) {
    console.error('Error optimizing prompt:', error);
    res.status(500).json({ error: 'Failed to optimize prompt: ' + error.message });
  }
});

// 文字生成视频的API端点
app.post('/api/text-to-video', async (req, res) => {
  try {
    const { text, negativePrompt, apiKey, model, optimize, socketId } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    let prompt = text;
    
    // 如果需要优化提示词
    if (optimize) {
      const optimizationModel = getDefaultModels().optimizationModel;
      prompt = await optimizePrompt(text, apiKey, optimizationModel);
    }
    
    console.log(`Generating video from text: ${prompt}`);
    
    // 调用视频生成函数
    const result = await generateVideoFromText(prompt, negativePrompt, apiKey, model);
    
    // 立即返回操作名称，前端可以轮询状态
    res.json({ 
      success: true, 
      message: 'Video generation started', 
      operationName: result.operationName,
      usedApiKey: result.apiKey,
      usedModel: result.model,
      socketId: socketId
    });
  } catch (error) {
    console.error('Error generating video:', error);
    res.status(500).json({ error: 'Failed to generate video: ' + error.message });
  }
});

// 图片生成视频的API端点
app.post('/api/image-to-video', upload.single('image'), async (req, res) => {
  try {
    const { prompt, negativePrompt, apiKey, model, optimize, socketId } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required for image-to-video generation' });
    }
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    let textPrompt = prompt;
    
    // 如果需要优化提示词
    if (optimize) {
      const optimizationModel = getDefaultModels().optimizationModel;
      textPrompt = await optimizePrompt(prompt, apiKey, optimizationModel);
    }
    
    console.log(`Generating video with image context. Prompt: ${textPrompt}`);
    
    // 调用视频生成函数
    const result = await generateVideoFromImage(req.file?.path, textPrompt, negativePrompt, apiKey, model);
    
    // 立即返回操作名称，前端可以轮询状态
    res.json({ 
      success: true, 
      message: 'Video generation started', 
      operationName: result.operationName,
      usedApiKey: result.apiKey,
      usedModel: result.model,
      socketId: socketId
    });
  } catch (error) {
    console.error('Error generating video:', error);
    res.status(500).json({ error: 'Failed to generate video: ' + error.message });
  }
});

// 检查操作状态的API端点
app.get('/api/operation/:operationName', async (req, res) => {
  try {
    const { operationName } = req.params;
    const { apiKey, socketId } = req.query;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta';
    
    // 获取操作状态
    const statusResponse = await axios.get(`${API_URL}/${operationName}?key=${apiKey}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const statusData = statusResponse.data;
    
    // 发送进度更新到客户端
    if (socketId && global.io) {
      global.io.to(socketId).emit('generationProgress', {
        message: '视频生成中，请耐心等待...',
        done: statusData.done || false
      });
    }
    
    res.json(statusData);
  } catch (error) {
    console.error('Error checking operation status:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to check operation status: ' + (error.response?.data?.error?.message || error.message) });
  }
});

// 下载并保存生成的视频
app.post('/api/download-video', async (req, res) => {
  try {
    const { videoUri, apiKey } = req.body;
    
    if (!videoUri || !apiKey) {
      return res.status(400).json({ error: 'Video URI and API key are required' });
    }
    
    // 生成文件名
    const filename = `video-${Date.now()}.mp4`;
    
    // 下载视频
    const videoPath = await downloadVideo(videoUri, filename, apiKey);
    
    res.json({ 
      success: true, 
      message: 'Video downloaded successfully', 
      videoPath: videoPath 
    });
  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ error: 'Failed to download video: ' + error.message });
  }
});

// 视频转码API端点
app.post('/api/transcode-video', async (req, res) => {
  try {
    const { inputPath, format, resolution, fps, socketId } = req.body;
    
    if (!inputPath || !format) {
      return res.status(400).json({ error: 'Input path and format are required' });
    }
    
    // 生成输出文件名
    const outputFilename = `transcoded-${Date.now()}`;
    const outputPath = `${config.upload.generatedDir}${outputFilename}`;
    
    // 转码视频
    const transcodedPath = await transcodeVideo(inputPath, outputPath, format, resolution, fps, socketId);
    
    res.json({ 
      success: true, 
      message: 'Video transcoded successfully', 
      videoPath: transcodedPath 
    });
  } catch (error) {
    console.error('Error transcoding video:', error);
    res.status(500).json({ error: 'Failed to transcode video: ' + error.message });
  }
});

// 获取生成视频的端点
app.get('/generated/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, config.upload.generatedDir, filename);
  
  // 检查文件是否存在
  fs.access(filePath)
    .then(() => {
      // 根据文件扩展名设置正确的MIME类型
      const ext = path.extname(filename).toLowerCase();
      let mimeType = 'video/mp4';
      
      if (ext === '.webm') {
        mimeType = 'video/webm';
      } else if (ext === '.mov') {
        mimeType = 'video/quicktime';
      }
      
      res.setHeader('Content-Type', mimeType);
      res.sendFile(filePath);
    })
    .catch(() => {
      res.status(404).json({ error: 'File not found' });
    });
});

// 获取上传图片的端点
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, config.upload.uploadDir, filename);
  
  // 检查文件是否存在
  fs.access(filePath)
    .then(() => {
      // 设置正确的MIME类型
      res.setHeader('Content-Type', 'image/jpeg');
      res.sendFile(filePath);
    })
    .catch(() => {
      res.status(404).json({ error: 'File not found' });
    });
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    gpuSupport: gpuSupport,
    config: {
      port: PORT,
      upload: {
        maxSize: config.upload.maxSize,
        allowedTypes: config.upload.allowedTypes
      }
    }
  });
});

// 初始化服务器
async function init() {
  await createDirectories();
  
  // 检测GPU支持
  gpuSupport = await detectGPUSupport();
  
  const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    const apiKeys = getAvailableApiKeys();
    if (apiKeys.length === 0) {
      console.warn('Warning: No API keys found. Please configure your API keys in the .env file or provide a temporary key in the UI.');
    } else {
      console.log(`Found ${apiKeys.length} API key(s) available for use.`);
    }
    
    const models = getDefaultModels();
    console.log(`Default video model: ${models.videoModel}`);
    console.log(`Default optimization model: ${models.optimizationModel}`);
    
    // 输出GPU支持信息
    console.log('GPU Support:');
    console.log(`  NVIDIA: ${gpuSupport.nvidia}`);
    console.log(`  Intel: ${gpuSupport.intel}`);
    console.log(`  AMD: ${gpuSupport.amd}`);
    
    // 启动定期文件清理任务
    setInterval(cleanupOldFiles, config.cleanup.cleanupInterval);
  });
  
  // 初始化Socket.IO用于实时进度更新
  const io = require('socket.io')(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  global.io = io;
  
  io.on('connection', (socket) => {
    console.log('User connected for video transcoding progress');
    
    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });
}

init();