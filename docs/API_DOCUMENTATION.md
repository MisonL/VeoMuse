# VeoMuse API 接口文档

## 基础URL
```
http://localhost:3000/api
```

## 身份验证
所有API接口都需要有效的Gemini API密钥。您可以在请求体中提供，或通过`.env`文件配置。

## 模型管理

### 获取可用模型
获取可用于视频生成和提示词优化的模型列表。

**接口地址：** `GET /models`  
**查询参数：**
- `apiKey` (可选)：您的Gemini API密钥

**响应示例：**
```json
{
  "videoModels": [
    {
      "id": "veo-3.0-generate-preview",
      "name": "Veo 3.0 (预览版)"
    }
  ],
  "optimizationModels": [
    {
      "id": "gemini-2.5-pro",
      "name": "Gemini 2.5 Pro"
    }
  ]
}
```

## 文字生成视频

### 根据文字描述生成视频
基于文字描述创建视频内容。

**接口地址：** `POST /text-to-video`  
**请求体：**
```json
{
  "text": "海洋上美丽的日落景色",
  "negativePrompt": "模糊，低质量",
  "apiKey": "your-api-key",
  "model": "veo-3.0-generate-preview",
  "optimize": true,
  "socketId": "实时更新的socket-id"
}
```

**响应示例：**
```json
{
  "success": true,
  "message": "视频生成已开始",
  "operationName": "operations/...",
  "usedApiKey": "使用的API密钥",
  "usedModel": "veo-3.0-generate-preview"
}
```

## 图片生成视频

### 根据图片生成视频
基于上传的图片和描述创建视频内容。

**接口地址：** `POST /image-to-video`  
**表单数据：**
- `image`：要上传的图片文件
- `prompt`：如何生成视频的描述
- `negativePrompt`：视频中要避免的元素
- `apiKey`：您的Gemini API密钥
- `model`：用于生成的模型
- `optimize`：是否优化提示词
- `socketId`：实时更新的Socket ID

**响应示例：**
```json
{
  "success": true,
  "message": "视频生成已开始",
  "operationName": "operations/...",
  "usedApiKey": "使用的API密钥",
  "usedModel": "veo-3.0-generate-preview"
}
```

## 提示词优化

### 优化提示词
改进文字提示词以获得更好的视频生成效果。

**接口地址：** `POST /optimize-prompt`  
**请求体：**
```json
{
  "prompt": "一只猫在玩耍",
  "apiKey": "your-api-key",
  "model": "gemini-2.5-pro"
}
```

**响应示例：**
```json
{
  "success": true,
  "optimizedPrompt": "一只顽皮的橙色小猫在阳光洒落的客厅里追逐毛线球"
}
```

## 操作状态查询

### 检查操作状态
轮询视频生成操作的状态。

**接口地址：** `GET /operation/:operationName`  
**查询参数：**
- `apiKey`：您的Gemini API密钥
- `socketId`：实时更新的Socket ID

**响应示例：**
```json
{
  "done": false,
  "response": {
    "generateVideoResponse": {
      "generatedSamples": [
        {
          "video": {
            "uri": "https://..."
          }
        }
      ]
    }
  }
}
```

## 视频管理

### 下载生成的视频
下载并保存生成的视频到服务器。

**接口地址：** `POST /download-video`  
**请求体：**
```json
{
  "videoUri": "https://...",
  "apiKey": "your-api-key"
}
```

**响应示例：**
```json
{
  "success": true,
  "message": "视频下载成功",
  "videoPath": "generated/video-12345.mp4"
}
```

### 视频转码
将视频转换为不同的格式、分辨率或帧率。

**接口地址：** `POST /transcode-video`  
**请求体：**
```json
{
  "inputPath": "generated/video-12345.mp4",
  "format": "webm",
  "resolution": "720p",
  "fps": 30,
  "socketId": "实时更新的socket-id"
}
```

**响应示例：**
```json
{
  "success": true,
  "message": "视频转码成功",
  "videoPath": "generated/transcoded-12345_720p_30fps.webm"
}
```

## 实时更新

应用程序使用Socket.IO在视频生成和转码过程中提供实时进度更新。

### 事件列表

- `generationProgress`：视频生成过程中触发
- `transcodeProgress`：视频转码过程中触发
- `transcodeComplete`：转码完成时触发
- `transcodeError`：转码失败时触发

## 文件访问

### 生成的视频
在`/generated/:filename`路径访问生成的视频

### 上传的图片
在`/uploads/:filename`路径访问上传的图片

## 健康检查

### 应用程序健康状态
检查应用程序是否正常运行。

**接口地址：** `GET /health`  
**响应示例：**
```json
{
  "status": "ok",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "gpuSupport": {
    "nvidia": true,
    "intel": true,
    "amd": false
  }
}
```