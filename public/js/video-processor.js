// public/js/video-processor.js - 视频后处理模块
import { API } from './api.js';

export class VideoProcessor {
    constructor(i18n) {
        this.i18n = i18n;
    }

    // 创建视频处理菜单
    createProcessorMenu(videoPath, videoUri) {
        const menu = document.createElement('div');
        menu.className = 'video-processor-menu glass-panel';
        menu.innerHTML = `
            <h4>${this.i18n.get('videoProcessor.title')}</h4>
            <div class="processor-actions">
                <button class="processor-btn" data-action="download">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>${this.i18n.get('videoProcessor.download')}</span>
                </button>
                
                <button class="processor-btn" data-action="transcode">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polygon points="10 8 16 12 10 16 10 8"></polygon>
                    </svg>
                    <span>${this.i18n.get('videoProcessor.transcode')}</span>
                </button>
                
                <button class="processor-btn" data-action="gif">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="9" y1="9" x2="9" y2="15"></line>
                        <line x1="15" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <span>${this.i18n.get('videoProcessor.toGif')}</span>
                </button>
                
                <button class="processor-btn" data-action="thumbnail">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <span>${this.i18n.get('videoProcessor.thumbnail')}</span>
                </button>
            </div>
        `;

        // 绑定事件
        menu.querySelectorAll('.processor-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.action;
                await this.handleAction(action, videoPath, videoUri, btn);
            });
        });

        return menu;
    }

    async handleAction(action, videoPath, videoUri, button) {
        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<span class="loading-spinner"></span> ${this.i18n.get('videoProcessor.processing')}`;

        try {
            let result;
            switch (action) {
                case 'download':
                    result = await this.downloadVideo(videoUri);
                    break;
                case 'transcode':
                    result = await this.showTranscodeDialog(videoPath);
                    break;
                case 'gif':
                    result = await this.generateGif(videoPath);
                    break;
                case 'thumbnail':
                    result = await this.captureThumbnail(videoPath);
                    break;
            }

            if (result) {
                this.showNotification(this.i18n.get('videoProcessor.success'), 'success');
                return result;
            }
        } catch (error) {
            console.error(`Video processing error (${action}):`, error);
            this.showNotification(this.i18n.get('videoProcessor.error'), 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }

    async downloadVideo(videoUri) {
        const response = await API.downloadVideo(videoUri);
        return response;
    }

    async generateGif(videoPath) {
        const response = await API.generateGif(videoPath);
        if (response.success && response.gifPath) {
            // 自动下载GIF
            const link = document.createElement('a');
            link.href = response.gifPath;
            link.download = response.gifPath.split('/').pop();
            link.click();
        }
        return response;
    }

    async captureThumbnail(videoPath, time = '00:00:01') {
        const response = await API.captureThumbnail(videoPath, time);
        if (response.success && response.thumbnailPath) {
            // 显示缩略图
            this.showThumbnailPreview(response.thumbnailPath);
        }
        return response;
    }

    async showTranscodeDialog(videoPath) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'transcode-modal';
            modal.innerHTML = `
                <div class="modal-overlay"></div>
                <div class="modal-content glass-panel">
                    <h3>${this.i18n.get('videoProcessor.transcode')}</h3>
                    <form id="transcodeForm">
                        <div class="form-group">
                            <label>${this.i18n.get('videoProcessor.format')}</label>
                            <select name="format" required>
                                <option value="mp4">MP4</option>
                                <option value="webm">WebM</option>
                                <option value="mov">MOV</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${this.i18n.get('videoProcessor.resolution')}</label>
                            <select name="resolution">
                                <option value="">保持原分辨率</option>
                                <option value="1080p">1080p</option>
                                <option value="720p">720p</option>
                                <option value="480p">480p</option>
                                <option value="360p">360p</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${this.i18n.get('videoProcessor.fps')}</label>
                            <input type="number" name="fps" min="1" max="60" placeholder="留空保持原帧率">
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-cancel">取消</button>
                            <button type="submit" class="btn-confirm">转码</button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelector('.btn-cancel').addEventListener('click', () => {
                modal.remove();
                resolve(null);
            });

            modal.querySelector('#transcodeForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const options = {
                    format: formData.get('format'),
                    resolution: formData.get('resolution') || undefined,
                    fps: formData.get('fps') ? parseInt(formData.get('fps')) : undefined
                };

                const result = await API.transcodeVideo(videoPath, options.format, options.resolution, options.fps);
                modal.remove();

                if (result.success && result.outputPath) {
                    // 自动下载转码后的视频
                    const link = document.createElement('a');
                    link.href = result.outputPath;
                    link.download = result.outputPath.split('/').pop();
                    link.click();
                }

                resolve(result);
            });
        });
    }

    showThumbnailPreview(thumbnailPath) {
        const modal = document.createElement('div');
        modal.className = 'thumbnail-preview-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content glass-panel">
                <h3>视频封面</h3>
                <img src="${thumbnailPath}" alt="Thumbnail">
                <div class="form-actions">
                    <a href="${thumbnailPath}" download class="btn-download">下载</a>
                    <button type="button" class="btn-close">关闭</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.btn-close').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('.modal-overlay').addEventListener('click', () => {
            modal.remove();
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}
