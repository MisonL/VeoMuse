export const translations = {
    zh: {
        appTitle: "VeoMuse 灵感工坊",
        nav: {
            text: "文字生视频",
            image: "图片生视频",
            history: "创作历史",
            batch: "批量生成",
            theme: "切换主题",
            lang: "English"
        },
        status: {
            ready: "就绪",
            generating: "正在生成...",
            error: "错误"
        },
        text: {
            title: "文字转视频",
            promptLabel: "描述你的创意",
            promptPlaceholder: "例如：一只在雨中漫步的赛博朋克猫咪，霓虹灯光...",
            negativePromptLabel: "负面提示词 (可选)",
            negativePromptPlaceholder: "例如：模糊，变形，低质量...",
            styleLabel: "艺术风格",
            modelLabel: "模型选择",
            styles: {
                default: "电影质感 (默认)",
                realistic: "超写实",
                anime: "日系动漫",
                render3d: "3D 渲染",
                cyberpunk: "赛博朋克",
                watercolor: "水彩艺术"
            },
            generateBtn: "开始生成"
        },
        image: {
            title: "图片转视频",
            dropText: "拖拽图片到此处 或 点击上传",
            promptLabel: "动态描述",
            promptPlaceholder: "描述图片应该如何动起来...",
            negativePromptLabel: "负面提示词 (可选)",
            negativePromptPlaceholder: "例如：模糊，变形，低质量...",
            generateBtn: "生成动画"
        },
        preview: {
            empty: "你的创意将在此呈现",
            download: "下载视频",
            share: "分享作品"
        },
        common: {
            cancel: "取消",
            confirm: "确认",
            close: "关闭",
            save: "保存"
        },
        notifications: {
            welcome: "欢迎来到 VeoMuse 灵感工坊",
            genSuccess: "视频生成成功！",
            genError: "生成失败，请重试",
            inputError: "请输入描述词",
            uploadError: "请先上传图片"
        },
        history: {
            title: "创作历史",
            subtitle: "你的创作记录",
            clearAll: "清空历史",
            empty: "暂无创作记录",
            textType: "文字生成",
            imageType: "图片生成"
        },
        templates: {
            title: "提示词模板",
            useTemplate: "使用模板",
            random: "随机模板",
            categories: "分类",
            apply: "应用"
        },
        optimize: {
            button: "优化提示词",
            optimizing: "优化中...",
            success: "优化成功",
            error: "优化失败"
        },
        videoProcessor: {
            title: "视频处理",
            download: "下载到服务器",
            transcode: "转码",
            toGif: "生成 GIF",
            thumbnail: "提取封面",
            format: "格式",
            resolution: "分辨率",
            fps: "帧率",
            processing: "处理中...",
            success: "处理成功",
            error: "处理失败"
        },
        batch: {
            title: "批量生成",
            create: "新建任务",
            templateLabel: "选择模板分类",
            selectCategory: "请选择分类...",
            countLabel: "生成数量",
            submit: "开始生成",
            empty: "暂无批量任务",
            errorCategory: "请选择一个分类",
            createSuccess: "批量任务创建成功",
            createError: "创建任务失败",
            videos: "视频",
            viewResults: "查看结果",
            status: {
                pending: "等待中",
                preparing: "准备中",
                processing: "处理中",
                completed: "已完成",
                completed_with_errors: "完成(有错误)",
                failed: "失败",
                cancelled: "已取消"
            },
            stats: {
                active: "活跃任务",
                jobs: "总作业数",
                completed: "已完成作业",
                total: "总任务数"
            }
        }
    },
    en: {
        appTitle: "VeoMuse Studio",
        nav: {
            text: "Text to Video",
            image: "Image to Video",
            history: "History",
            batch: "Batch Gen",
            theme: "Toggle Theme",
            lang: "中文"
        },
        status: {
            ready: "Ready",
            generating: "Generating...",
            error: "Error"
        },
        text: {
            title: "Text to Video",
            promptLabel: "Describe your vision",
            promptPlaceholder: "E.g., A cyberpunk cat walking in the rain, neon lights...",
            negativePromptLabel: "Negative Prompt (Optional)",
            negativePromptPlaceholder: "E.g., blurry, distorted, low quality...",
            styleLabel: "Art Style",
            modelLabel: "Model Selection",
            styles: {
                default: "Cinematic (Default)",
                realistic: "Photorealistic",
                anime: "Anime",
                render3d: "3D Render",
                cyberpunk: "Cyberpunk",
                watercolor: "Watercolor"
            },
            generateBtn: "Generate Video"
        },
        image: {
            title: "Image to Video",
            dropText: "Drop image here or click to upload",
            promptLabel: "Motion Prompt",
            promptPlaceholder: "Describe how the image should move...",
            negativePromptLabel: "Negative Prompt (Optional)",
            negativePromptPlaceholder: "E.g., blurry, distorted, low quality...",
            generateBtn: "Animate"
        },
        preview: {
            empty: "Your creation will appear here",
            download: "Download",
            share: "Share"
        },
        common: {
            cancel: "Cancel",
            confirm: "Confirm",
            close: "Close",
            save: "Save"
        },
        notifications: {
            welcome: "Welcome to VeoMuse Studio",
            genSuccess: "Video generated successfully!",
            genError: "Generation failed, please try again",
            inputError: "Please enter a prompt",
            uploadError: "Please upload an image first"
        },
        history: {
            title: "History",
            subtitle: "Your creations",
            clearAll: "Clear All",
            empty: "No creation history yet",
            textType: "Text Generation",
            imageType: "Image Generation"
        },
        templates: {
            title: "Prompt Templates",
            useTemplate: "Use Template",
            random: "Random",
            categories: "Categories",
            apply: "Apply"
        },
        optimize: {
            button: "Optimize Prompt",
            optimizing: "Optimizing...",
            success: "Optimized successfully",
            error: "Optimization failed"
        },
        videoProcessor: {
            title: "Video Processing",
            download: "Download to Server",
            transcode: "Transcode",
            toGif: "Generate GIF",
            thumbnail: "Extract Thumbnail",
            format: "Format",
            resolution: "Resolution",
            fps: "FPS",
            processing: "Processing...",
            success: "Processed successfully",
            error: "Processing failed"
        },
        batch: {
            title: "Batch Generation",
            create: "New Task",
            templateLabel: "Select Category",
            selectCategory: "Select a category...",
            countLabel: "Generation Count",
            submit: "Start Generation",
            empty: "No batch tasks yet",
            errorCategory: "Please select a category",
            createSuccess: "Batch task created successfully",
            createError: "Failed to create task",
            videos: "videos",
            viewResults: "View Results",
            status: {
                pending: "Pending",
                preparing: "Preparing",
                processing: "Processing",
                completed: "Completed",
                completed_with_errors: "Completed (With Errors)",
                failed: "Failed",
                cancelled: "Cancelled"
            },
            stats: {
                active: "Active Tasks",
                jobs: "Total Jobs",
                completed: "Completed Jobs",
                total: "Total Batches"
            }
        }
    }
};

export class I18n {
    constructor() {
        this.lang = localStorage.getItem('veo_lang') || 'zh';
        this.observers = [];
    }

    get(key) {
        const keys = key.split('.');
        let value = translations[this.lang];
        for (const k of keys) {
            value = value[k];
            if (!value) return key;
        }
        return value;
    }

    setLang(lang) {
        this.lang = lang;
        localStorage.setItem('veo_lang', lang);
        this.notify();
    }

    toggle() {
        this.setLang(this.lang === 'zh' ? 'en' : 'zh');
    }

    subscribe(callback) {
        this.observers.push(callback);
        callback(); // Initial call
    }

    notify() {
        this.observers.forEach(cb => cb());
    }
}
