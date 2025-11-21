export class UI {
    static NOTIFICATION_ICONS = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    static showNotification(message, type = 'info', options = {}) {
        const {
            duration = 5000,
            onRetry = null,
            dismissible = true
        } = options;

        const area = document.getElementById('notification-area');
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;

        const icon = document.createElement('span');
        icon.className = 'notification-icon';
        icon.textContent = this.NOTIFICATION_ICONS[type] || this.NOTIFICATION_ICONS.info;

        const messageEl = document.createElement('span');
        messageEl.className = 'notification-message';
        messageEl.textContent = message;

        notif.appendChild(icon);
        notif.appendChild(messageEl);

        // Add retry button if callback provided
        if (onRetry && type === 'error') {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'notification-retry-btn';
            retryBtn.textContent = '重试';
            retryBtn.onclick = (e) => {
                e.stopPropagation();
                notif.remove();
                onRetry();
            };
            notif.appendChild(retryBtn);
        }

        // Add close button if dismissible
        if (dismissible) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'notification-close-btn';
            closeBtn.textContent = '×';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.dismissNotification(notif);
            };
            notif.appendChild(closeBtn);
        }

        area.appendChild(notif);

        // Trigger animation
        requestAnimationFrame(() => {
            notif.classList.add('show');
        });

        // Auto-dismiss after duration
        if (duration > 0) {
            setTimeout(() => {
                this.dismissNotification(notif);
            }, duration);
        }

        return notif;
    }

    static dismissNotification(notif) {
        notif.classList.remove('show');
        notif.classList.add('hide');
        setTimeout(() => notif.remove(), 300);
    }

    static showLoading(show = true) {
        const empty = document.getElementById('preview-empty');
        const loading = document.getElementById('preview-loading');
        const video = document.getElementById('preview-video');

        if (show) {
            empty.style.display = 'none';
            loading.style.display = 'flex';
            video.style.display = 'none';

            // Add skeleton loader if not present
            if (!loading.querySelector('.skeleton-video')) {
                const skeleton = document.createElement('div');
                skeleton.className = 'skeleton skeleton-video';
                loading.innerHTML = '';
                loading.appendChild(skeleton);

                const text = document.createElement('p');
                text.textContent = '正在生成视频...';
                text.style.marginTop = '20px';
                text.style.color = 'var(--text-muted)';
                loading.appendChild(text);
            }
        } else {
            loading.style.display = 'none';
            // Restore original spinner if needed
            if (loading.querySelector('.skeleton-video')) {
                loading.innerHTML = `
                    <div class="liquid-spinner"></div>
                    <p>正在生成视频...</p>
                `;
            }
        }
    }

    static showVideo(videoUrl) {
        const empty = document.getElementById('preview-empty');
        const loading = document.getElementById('preview-loading');
        const wrapper = document.getElementById('preview-video');
        const actions = document.getElementById('stage-actions');

        empty.style.display = 'none';
        loading.style.display = 'none';
        wrapper.style.display = 'block';
        actions.style.display = 'flex';

        // Find the video-wrapper inside preview-video
        const videoWrapper = wrapper.querySelector('.video-wrapper');
        videoWrapper.innerHTML = `
            <video controls autoplay loop>
                <source src="${videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;

        // Setup download button
        document.getElementById('download-btn').onclick = () => {
            const a = document.createElement('a');
            a.href = videoUrl;
            a.download = `veo-creation-${Date.now()}.mp4`;
            a.click();
        };
    }

    static resetPreview() {
        document.getElementById('preview-empty').style.display = 'block';
        document.getElementById('preview-loading').style.display = 'none';
        document.getElementById('preview-video').style.display = 'none';
        document.getElementById('stage-actions').style.display = 'none';
        document.getElementById('preview-video').innerHTML = '';
    }
}
