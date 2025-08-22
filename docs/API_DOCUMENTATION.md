# VeoMuse API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
All API endpoints require a valid Gemini API key. You can provide it in the request body or through the `.env` file.

## Models

### Get Available Models
Retrieve a list of available models for video generation and prompt optimization.

**Endpoint:** `GET /models`  
**Query Parameters:**
- `apiKey` (optional): Your Gemini API key

**Response:**
```json
{
  "videoModels": [
    {
      "id": "veo-3.0-generate-preview",
      "name": "Veo 3.0 (Preview)"
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

## Text-to-Video Generation

### Generate Video from Text
Create a video based on a text description.

**Endpoint:** `POST /text-to-video`  
**Request Body:**
```json
{
  "text": "A beautiful sunset over the ocean",
  "negativePrompt": "blurry, low quality",
  "apiKey": "your-api-key",
  "model": "veo-3.0-generate-preview",
  "optimize": true,
  "socketId": "socket-id-for-realtime-updates"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video generation started",
  "operationName": "operations/...",
  "usedApiKey": "used-api-key",
  "usedModel": "veo-3.0-generate-preview"
}
```

## Image-to-Video Generation

### Generate Video from Image
Create a video based on an uploaded image and description.

**Endpoint:** `POST /image-to-video`  
**Form Data:**
- `image`: The image file to upload
- `prompt`: Description of how to generate the video
- `negativePrompt`: Elements to avoid in the video
- `apiKey`: Your Gemini API key
- `model`: The model to use for generation
- `optimize`: Whether to optimize the prompt
- `socketId`: Socket ID for real-time updates

**Response:**
```json
{
  "success": true,
  "message": "Video generation started",
  "operationName": "operations/...",
  "usedApiKey": "used-api-key",
  "usedModel": "veo-3.0-generate-preview"
}
```

## Prompt Optimization

### Optimize Prompt
Improve a text prompt for better video generation results.

**Endpoint:** `POST /optimize-prompt`  
**Request Body:**
```json
{
  "prompt": "A cat playing",
  "apiKey": "your-api-key",
  "model": "gemini-2.5-pro"
}
```

**Response:**
```json
{
  "success": true,
  "optimizedPrompt": "A playful orange cat chasing a ball of yarn in a sunlit living room"
}
```

## Operation Status

### Check Operation Status
Poll the status of a video generation operation.

**Endpoint:** `GET /operation/:operationName`  
**Query Parameters:**
- `apiKey`: Your Gemini API key
- `socketId`: Socket ID for real-time updates

**Response:**
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

## Video Management

### Download Generated Video
Download and save a generated video to the server.

**Endpoint:** `POST /download-video`  
**Request Body:**
```json
{
  "videoUri": "https://...",
  "apiKey": "your-api-key"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video downloaded successfully",
  "videoPath": "generated/video-12345.mp4"
}
```

### Transcode Video
Convert a video to different formats, resolutions, or frame rates.

**Endpoint:** `POST /transcode-video`  
**Request Body:**
```json
{
  "inputPath": "generated/video-12345.mp4",
  "format": "webm",
  "resolution": "720p",
  "fps": 30,
  "socketId": "socket-id-for-realtime-updates"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video transcoded successfully",
  "videoPath": "generated/transcoded-12345_720p_30fps.webm"
}
```

## Real-time Updates

The application uses Socket.IO for real-time progress updates during video generation and transcoding.

### Events

- `generationProgress`: Emitted during video generation
- `transcodeProgress`: Emitted during video transcoding
- `transcodeComplete`: Emitted when transcoding is complete
- `transcodeError`: Emitted when transcoding fails

## File Access

### Generated Videos
Access generated videos at `/generated/:filename`

### Uploaded Images
Access uploaded images at `/uploads/:filename`

## Health Check

### Application Health
Check if the application is running properly.

**Endpoint:** `GET /health`  
**Response:**
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