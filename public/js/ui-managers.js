// js/ui-managers.js - UI管理器模块

// 通知管理器
class NotificationManager {
    static show(message, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// 加载状态管理器
class LoadingManager {
    static show() {
        document.getElementById('loading').classList.add('show');
        document.getElementById('result').classList.remove('show');
        this.updateProgress('正在初始化视频生成...', 0);
    }

    static hide() {
        document.getElementById('loading').classList.remove('show');
    }

    static updateProgress(text, percent) {
        document.getElementById('status-text').textContent = text;
        document.getElementById('progress').style.width = percent + '%';
    }
}

// 图片模态框管理器
class ImageModal {
    static show(imageSrc) {
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'image-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            cursor: pointer;
        `;
        
        const img = document.createElement('img');
        img.src = imageSrc;
        img.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        `;
        
        modal.appendChild(img);
        document.body.appendChild(modal);
        
        // 点击模态框关闭
        modal.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // ESC键关闭
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
                document.removeEventListener('keydown', handleEscKey);
            }
        };
        document.addEventListener('keydown', handleEscKey);
    }
}

// 提示词模板管理器
class PromptTemplateManager {
    static templates = {
        '景观风光': [
            '广角镜头：壮观的日出照亮雄伟的山脉，金色光芒穿透晨雾',
            '航拍视角：蔚蓝海洋中的热带岛屿，白色沙滩和椰子树',
            '特写：清澈小溪缓缓流过青苔覆盖的岩石',
            '全景：漫天繁星下的沙漠绿洲，远处有驼队剪影'
        ],
        '人物活动': [
            '特写镜头：一位艺术家专注地绘画，颜料在画布上流淌',
            '中景：一群朋友在公园里欢笑，阳光透过树叶洒下',
            '慢镜头：舞者优雅地旋转，裙摆飞扬',
            '跟踪镜头：跑步者沿着海岸线奔跑，浪花拍打岸边'
        ],
        '动物世界': [
            '慢动作：雄鹰展翅高飞，俯瞰山谷',
            '水下镜头：色彩斑斓的热带鱼群游过珊瑚礁',
            '特写：可爱的小猫咪伸懒腰，阳光洒在毛发上',
            '追踪拍摄：野马在草原上自由奔跑，鬃毛飞扬'
        ],
        '科技未来': [
            '俯拍：霓虹闪烁的赛博朋克城市夜景，飞行器穿梭其间',
            '特写：机器人手臂精确地组装复杂零件',
            '环绕镜头：全息投影在空中旋转显示数据',
            '远景：太空站在地球轨道上缓缓转动，星空璀璨'
        ],
        '美食料理': [
            '俯拍：厨师熟练地切制新鲜蔬菜，刀工精湛',
            '特写：热腾腾的面条从锅中挑起，汤汁滴落',
            '慢镜头：巧克力慢慢融化，流淌成丝滑状',
            '环绕拍摄：精美摆盘的料理，色彩丰富诱人'
        ]
    };

    static getTemplatesByCategory(category) {
        return this.templates[category] || [];
    }

    static getAllCategories() {
        return Object.keys(this.templates);
    }

    static getRandomTemplate() {
        const categories = this.getAllCategories();
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        const templates = this.templates[randomCategory];
        return templates[Math.floor(Math.random() * templates.length)];
    }

    // 图片生成视频专用模板
    static imageVideoTemplates = [
        '图片中的主体开始缓慢移动，背景保持静止',
        '镜头慢慢推进，突出图片中的主要元素',
        '图片场景中添加自然的动态效果，如风吹、水流',
        '图片中的人物开始进行自然的动作和表情变化',
        '从图片的静态场景过渡到动态的故事情节',
        '图片中的光影开始变化，营造不同的氛围',
        '镜头环绕图片中的主体进行360度旋转',
        '图片场景中添加粒子效果，如雪花、雨滴、尘埃',
        '图片中的物体开始漂浮或轻微摆动',
        '从图片的近景逐渐拉远到全景视角'
    ];

    static getImageVideoTemplates() {
        return this.imageVideoTemplates;
    }

    static getRandomImageTemplate() {
        const templates = this.getImageVideoTemplates();
        return templates[Math.floor(Math.random() * templates.length)];
    }
}

// 生成历史管理器
class GenerationHistoryManager {
    static maxHistoryItems = 10;

    static saveGeneration(prompt, videoPath, type = 'text') {
        const history = this.getHistory();
        const newItem = {
            id: Date.now(),
            prompt: prompt.substring(0, 100), // 限制长度
            videoPath,
            type,
            timestamp: Date.now(),
            date: new Date().toLocaleString('zh-CN')
        };
        
        history.unshift(newItem);
        
        // 保持最大数量限制
        const limitedHistory = history.slice(0, this.maxHistoryItems);
        localStorage.setItem('generation_history', JSON.stringify(limitedHistory));
        
        return newItem;
    }

    static getHistory() {
        try {
            return JSON.parse(localStorage.getItem('generation_history') || '[]');
        } catch {
            return [];
        }
    }

    static clearHistory() {
        localStorage.removeItem('generation_history');
    }

    static removeHistoryItem(id) {
        const history = this.getHistory();
        const filteredHistory = history.filter(item => item.id !== id);
        localStorage.setItem('generation_history', JSON.stringify(filteredHistory));
    }

    static getHistoryItem(id) {
        const history = this.getHistory();
        return history.find(item => item.id === id);
    }
}

// 视频风格预设管理器
class VideoStyleManager {
    static styles = {
        '写实风格': {
            description: '真实感强，细节丰富的现实主义风格',
            modifiers: 'photorealistic, high detail, realistic lighting, 4K quality'
        },
        '动画风格': {
            description: '卡通动画风格，色彩鲜艳',
            modifiers: 'animated style, cartoon, vibrant colors, stylized'
        },
        '电影风格': {
            description: '电影级画质，戏剧性光影',
            modifiers: 'cinematic, dramatic lighting, film grain, wide aspect ratio'
        },
        '梦幻风格': {
            description: '梦幻般的视觉效果，柔和光线',
            modifiers: 'dreamy, ethereal, soft lighting, fantasy style'
        },
        '复古风格': {
            description: '怀旧复古感，温暖色调',
            modifiers: 'vintage, retro, warm tones, film aesthetic'
        },
        '科幻风格': {
            description: '未来感科技风格，冷色调',
            modifiers: 'sci-fi, futuristic, neon lights, high-tech'
        }
    };

    static getStyles() {
        return this.styles;
    }

    static getStyleModifiers(styleName) {
        return this.styles[styleName]?.modifiers || '';
    }

    static applyStyleToPrompt(prompt, styleName) {
        const modifiers = this.getStyleModifiers(styleName);
        if (modifiers) {
            return `${prompt}, ${modifiers}`;
        }
        return prompt;
    }
}

// 批量处理管理器
class BatchProcessingManager {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.currentIndex = 0;
    }

    addToQueue(prompt, type = 'text', options = {}) {
        const item = {
            id: Date.now() + Math.random(),
            prompt,
            type,
            options,
            status: 'pending',
            result: null,
            error: null
        };
        
        this.queue.push(item);
        return item.id;
    }

    async processQueue() {
        if (this.processing) return;
        
        this.processing = true;
        this.currentIndex = 0;
        
        for (let i = 0; i < this.queue.length; i++) {
            const item = this.queue[i];
            this.currentIndex = i;
            
            try {
                item.status = 'processing';
                this.updateBatchProgress();
                
                // 这里调用相应的生成方法
                if (item.type === 'text') {
                    // await this.processTextGeneration(item);
                } else if (item.type === 'image') {
                    // await this.processImageGeneration(item);
                }
                
                item.status = 'completed';
            } catch (error) {
                item.status = 'error';
                item.error = error.message;
            }
            
            this.updateBatchProgress();
        }
        
        this.processing = false;
        NotificationManager.show('批量处理完成!');
    }

    updateBatchProgress() {
        const total = this.queue.length;
        const completed = this.queue.filter(item => 
            item.status === 'completed' || item.status === 'error'
        ).length;
        
        const progress = Math.round((completed / total) * 100);
        
        // 这里可以更新UI显示批量处理进度
        console.log(`批量处理进度: ${completed}/${total} (${progress}%)`);
    }

    clearQueue() {
        this.queue = [];
        this.currentIndex = 0;
    }

    getQueueStatus() {
        return {
            total: this.queue.length,
            processing: this.processing,
            currentIndex: this.currentIndex,
            completed: this.queue.filter(item => item.status === 'completed').length,
            failed: this.queue.filter(item => item.status === 'error').length
        };
    }
}