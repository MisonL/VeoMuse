// src/services/TranscodeService.js
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const config = require('../../config');
const SocketService = require('./SocketService');

class TranscodeService {
  static async transcodeVideo({ inputPath, format = 'mp4', resolution = '720p', fps = 30, socketId }) {
    return new Promise((resolve, reject) => {
      const filename = `transcoded_${Date.now()}.${format}`;
      const outputPath = path.join(config.upload.generatedDir, filename);

      // 获取GPU支持情况
      const gpuCodec = this.getOptimalCodec(format);

      // 分辨率映射
      const resolutionMap = {
        '480p': '854x480',
        '720p': '1280x720',
        '1080p': '1920x1080',
        '1440p': '2560x1440',
        '4k': '3840x2160'
      };

      const targetResolution = resolutionMap[resolution] || '1280x720';



      // 处理输入路径
      let fullInputPath = inputPath;
      if (inputPath.startsWith('/generated/')) {
        const filename = inputPath.replace('/generated/', '');
        fullInputPath = path.join(config.upload.generatedDir, filename);
      }

      // 转换为绝对路径
      fullInputPath = path.resolve(fullInputPath);

      console.log(`开始转码: ${fullInputPath} -> ${outputPath}`);
      console.log(`使用编码器: ${gpuCodec}, 分辨率: ${targetResolution}, 帧率: ${fps}`);

      let command = ffmpeg(fullInputPath)
        .videoCodec(gpuCodec)
        .videoBitrate('2000k')
        .fps(fps)
        .size(targetResolution)
        .format(format);

      // 根据格式设置额外参数
      if (format === 'webm') {
        command = command.audioCodec('libvorbis');
      } else {
        command = command.audioCodec('aac');
      }

      // 监听进度
      command.on('progress', (progress) => {
        const percent = Math.round(progress.percent || 0);
        console.log(`转码进度: ${percent}%`);

        if (socketId) {
          SocketService.emitToSocket(socketId, 'transcodeProgress', {
            percent: percent,
            message: `正在转换视频: ${percent}%`
          });
        }
      });

      // 监听完成
      command.on('end', () => {
        console.log('视频转码完成:', outputPath);

        if (socketId) {
          SocketService.emitToSocket(socketId, 'transcodeComplete', {
            message: '视频转换完成!'
          });
        }

        resolve({
          success: true,
          filename: filename,
          outputPath: outputPath,
          downloadUrl: `/generated/${filename}`,
          message: '视频转码完成'
        });
      });

      // 监听错误
      command.on('error', (error) => {
        console.error('视频转码失败:', error);

        if (socketId) {
          SocketService.emitToSocket(socketId, 'transcodeError', {
            message: `视频转换失败: ${error.message}`
          });
        }

        reject(new Error(`视频转码失败: ${error.message}`));
      });

      // 开始转码
      command.save(outputPath);
    });
  }

  static getOptimalCodec(format) {
    // 根据平台和格式选择最优编码器
    const platform = process.platform;

    if (format === 'webm') {
      // WebM格式优先使用VP9编码器
      if (platform === 'darwin') {
        return 'libvpx-vp9'; // macOS
      } else if (platform === 'win32') {
        return 'libvpx-vp9'; // Windows
      } else {
        return 'libvpx-vp9'; // Linux
      }
    } else {
      // MP4格式优先使用GPU加速编码器
      if (platform === 'darwin') {
        // macOS - 优先使用VideoToolbox，然后是Intel QSV，最后CPU
        return 'h264_videotoolbox';
      } else if (platform === 'win32') {
        // Windows - 优先使用NVENC，然后是QSV，最后CPU
        return 'h264_nvenc';
      } else {
        // Linux - 优先使用NVENC，然后是VAAPI，最后CPU
        return 'h264_nvenc';
      }
    }
  }

  static async getVideoInfo(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          video: videoStream ? {
            codec: videoStream.codec_name,
            width: videoStream.width,
            height: videoStream.height,
            fps: eval(videoStream.r_frame_rate)
          } : null,
          audio: audioStream ? {
            codec: audioStream.codec_name,
            bitrate: audioStream.bit_rate,
            sampleRate: audioStream.sample_rate
          } : null
        });
      });
    });
  }
}

module.exports = TranscodeService;