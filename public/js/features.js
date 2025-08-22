// js/features.js - 功能扩展模块

// 功能管理器类
class FeatureManager {
    constructor(app) {
        this.app = app;
        this.selectedTemplate = null;
        this.batchProcessor = new BatchProcessingManager();
        
        this.init();
    }

    init() {
        this.initTemplateFeatures();
        this.initHistoryFeatures();
        this.initStyleFeatures();
        // initBatchFeatures方法暂未实现，先注释掉
        // this.initBatchFeatures();
    }

    // 初始化提示词模板功能
    initTemplateFeatures() {
        // 初始化文字生成页面的模板快速选择
        this.initTextTemplateQuickSelect();
        
        // 初始化图片生成页面的模板快速选择
        this.initImageTemplateQuickSelect();
        
        // 初始化模板弹窗
        this.initTemplateModal();
    }

    // 初始化文字生成的模板快速选择
    initTextTemplateQuickSelect() {
        const container = document.getElementById('template-categories-compact');
        const randomBtn = document.getElementById('random-template-text-btn');
        const showAllBtn = document.getElementById('show-all-templates-btn');
        
        // 渲染紧凑版模板分类（只显示几个常用的）
        this.renderCompactTemplateCategories(container, 'text');
        
        // 随机获取模板并直接应用
        randomBtn.addEventListener('click', () => {
            const randomTemplate = PromptTemplateManager.getRandomTemplate();
            this.applyTemplateToInput(randomTemplate, 'text-input');
        });
        
        // 显示所有模板弹窗
        showAllBtn.addEventListener('click', () => {
            this.showTemplateModal('text');
        });
    }

    // 初始化图片生成的模板快速选择
    initImageTemplateQuickSelect() {
        const container = document.getElementById('template-categories-image');
        const randomBtn = document.getElementById('random-template-image-btn');
        
        // 渲染适合图片生成的模板
        this.renderImageTemplateCategories(container);
        
        // 随机获取图片相关模板并直接应用
        randomBtn.addEventListener('click', () => {
            const imageTemplates = PromptTemplateManager.getImageVideoTemplates();
            const randomTemplate = imageTemplates[Math.floor(Math.random() * imageTemplates.length)];
            this.applyTemplateToInput(randomTemplate, 'image-prompt');
        });
    }

    // 渲染紧凑版模板分类（用于快速选择区域）
    renderCompactTemplateCategories(container, type) {
        const categories = PromptTemplateManager.getAllCategories();
        
        // 只显示前3个分类，每个分类只显示2个模板
        const limitedCategories = categories.slice(0, 3);
        
        container.innerHTML = limitedCategories.map(category => {
            const templates = PromptTemplateManager.getTemplatesByCategory(category).slice(0, 2);
            return `
                <div class="template-category-compact">
                    <h4>${category}</h4>
                    <div class="template-items-compact">
                        ${templates.map(template => `
                            <button class="template-btn-compact" data-template="${template}" data-target="${type === 'text' ? 'text-input' : 'image-prompt'}">
                                ${template.length > 50 ? template.substring(0, 50) + '...' : template}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');

        // 添加模板点击事件 - 直接应用
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('template-btn-compact')) {
                const template = e.target.dataset.template;
                const targetInput = e.target.dataset.target;
                this.applyTemplateToInput(template, targetInput);
            }
        });
    }

    // 渲染图片生成专用模板
    renderImageTemplateCategories(container) {
        const imageTemplates = PromptTemplateManager.getImageVideoTemplates();
        
        container.innerHTML = `
            <div class="template-category-compact">
                <h4>图片视频模板</h4>
                <div class="template-items-compact">
                    ${imageTemplates.slice(0, 4).map(template => `
                        <button class="template-btn-compact" data-template="${template}" data-target="image-prompt">
                            ${template.length > 50 ? template.substring(0, 50) + '...' : template}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // 添加模板点击事件 - 直接应用
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('template-btn-compact')) {
                const template = e.target.dataset.template;
                const targetInput = e.target.dataset.target;
                this.applyTemplateToInput(template, targetInput);
            }
        });
    }

    // 应用模板到指定输入框
    applyTemplateToInput(template, targetInputId) {
        const input = document.getElementById(targetInputId);
        if (input) {
            input.value = template;
            input.focus();
            NotificationManager.show('✨ 模板已应用，您可以直接开始生成视频！', 'success');
            
            // 滚动到输入框位置
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // 初始化模板弹窗
    initTemplateModal() {
        const modal = document.getElementById('template-modal');
        const closeBtn = document.getElementById('close-template-modal');
        const categoriesContainer = document.getElementById('template-categories-modal');
        
        // 渲染完整的模板分类
        this.renderFullTemplateCategories(categoriesContainer);
        
        // 关闭弹窗
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // 点击弹窗外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // 显示模板弹窗
    showTemplateModal(type) {
        const modal = document.getElementById('template-modal');
        modal.dataset.targetType = type; // 记录目标类型
        modal.style.display = 'block';
    }

    // 渲染完整的模板分类（用于弹窗）
    renderFullTemplateCategories(container) {
        const categories = PromptTemplateManager.getAllCategories();
        
        container.innerHTML = categories.map(category => {
            const templates = PromptTemplateManager.getTemplatesByCategory(category);
            return `
                <div class="template-category">
                    <h3>${category}</h3>
                    <div class="template-items">
                        ${templates.map(template => `
                            <div class="template-item" data-template="${template}">
                                <p>${template}</p>
                                <button class="btn btn-sm template-apply-btn">立即使用</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');

        // 添加模板应用事件
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('template-apply-btn')) {
                const templateItem = e.target.closest('.template-item');
                const template = templateItem.dataset.template;
                const modal = document.getElementById('template-modal');
                const targetType = modal.dataset.targetType || 'text';
                const targetInputId = targetType === 'text' ? 'text-input' : 'image-prompt';
                
                this.applyTemplateToInput(template, targetInputId);
                modal.style.display = 'none'; // 关闭弹窗
            }
        });
    }

    // 这个方法已经不需要了，因为我们改为直接应用模板
    // selectTemplate(template) {
    //     // 旧的选择逻辑，已被直接应用替代
    // }

    // 初始化历史记录功能
    initHistoryFeatures() {
        const historyList = document.getElementById('history-list');
        const clearBtn = document.getElementById('clear-history-btn');
        const emptyDiv = document.getElementById('history-empty');

        // 渲染历史记录
        this.renderHistory();

        // 清空历史
        clearBtn.addEventListener('click', () => {
            if (confirm('确定要清空所有生成历史吗？')) {
                GenerationHistoryManager.clearHistory();
                this.renderHistory();
                NotificationManager.show('历史记录已清空');
            }
        });

        // 定期更新历史显示
        setInterval(() => {
            this.renderHistory();
        }, 30000); // 每30秒更新一次
    }

    renderHistory() {
        const history = GenerationHistoryManager.getHistory();
        const historyList = document.getElementById('history-list');
        const emptyDiv = document.getElementById('history-empty');

        if (history.length === 0) {
            historyList.style.display = 'none';
            emptyDiv.style.display = 'block';
            return;
        }

        historyList.style.display = 'block';
        emptyDiv.style.display = 'none';

        historyList.innerHTML = history.map(item => `
            <div class="history-item" data-id="${item.id}">
                <div class="history-content">
                    <div class="history-meta">
                        <span class="history-type">${item.type === 'text' ? '文字生成' : '图片生成'}</span>
                        <span class="history-date">${item.date}</span>
                    </div>
                    <div class="history-prompt">${item.prompt}</div>
                    <div class="history-actions">
                        <button class="btn btn-sm reuse-btn">重新使用</button>
                        <a href="${item.videoPath}" class="btn btn-sm btn-info" download>下载视频</a>
                        <button class="btn btn-sm btn-danger remove-btn">删除</button>
                    </div>
                </div>
            </div>
        `).join('');

        // 添加历史记录事件
        historyList.addEventListener('click', (e) => {
            const historyItem = e.target.closest('.history-item');
            const itemId = parseInt(historyItem.dataset.id);
            const item = GenerationHistoryManager.getHistoryItem(itemId);

            if (e.target.classList.contains('reuse-btn')) {
                this.reuseHistoryItem(item);
            } else if (e.target.classList.contains('remove-btn')) {
                GenerationHistoryManager.removeHistoryItem(itemId);
                this.renderHistory();
                NotificationManager.show('历史记录已删除');
            }
        });
    }

    reuseHistoryItem(item) {
        if (item.type === 'text') {
            document.getElementById('text-input').value = item.prompt;
            document.querySelector('.tab[data-tab="text"]').click();
        } else {
            document.getElementById('image-prompt').value = item.prompt;
            document.querySelector('.tab[data-tab="image"]').click();
        }
        NotificationManager.show('历史提示词已应用');
    }

    // 初始化风格选择功能
    initStyleFeatures() {
        const textStyleSelect = document.getElementById('style-select-text');
        const imageStyleSelect = document.getElementById('style-select-image');

        // 监听风格选择变化
        textStyleSelect.addEventListener('change', (e) => {
            this.applyStyleToInput('text', e.target.value);
        });

        imageStyleSelect.addEventListener('change', (e) => {
            this.applyStyleToInput('image', e.target.value);
        });
    }

    applyStyleToInput(inputType, styleName) {
        if (!styleName) return;

        const inputId = inputType === 'text' ? 'text-input' : 'image-prompt';
        const input = document.getElementById(inputId);
        const currentText = input.value.trim();

        if (currentText) {
            // 应用风格到现有文本
            const styledText = VideoStyleManager.applyStyleToPrompt(currentText, styleName);
            input.value = styledText;
            NotificationManager.show(`已应用${styleName}到提示词`);
        } else {
            NotificationManager.show('请先输入基础描述再选择风格', 'warning');
        }
    }

    // 初始化批量处理功能
    initBatchFeatures() {
        // 这里可以添加批量处理的UI和逻辑
        // 暂时保留为扩展接口
    }

    // 保存生成记录
    saveGenerationToHistory(prompt, videoPath, type = 'text') {
        GenerationHistoryManager.saveGeneration(prompt, videoPath, type);
        this.renderHistory();
    }
}

// 扩展CSS样式
const additionalStyles = `
    /* 模板相关样式 */
    .template-category {
        margin-bottom: 30px;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 10px;
    }
    
    body.dark .template-category {
        background: #2d2d3a;
    }
    
    .template-category h3 {
        color: #333;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid #4b6cb7;
    }
    
    body.dark .template-category h3 {
        color: #ddd;
    }
    
    .template-items {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 15px;
    }
    
    .template-item {
        background: white;
        padding: 15px;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        transition: all 0.3s ease;
        cursor: pointer;
    }
    
    body.dark .template-item {
        background: #3a3a4a;
        border: 1px solid #444;
    }
    
    .template-item:hover {
        border-color: #4b6cb7;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(75, 108, 183, 0.2);
    }
    
    .template-item p {
        color: #666;
        margin-bottom: 10px;
        line-height: 1.5;
    }
    
    body.dark .template-item p {
        color: #ccc;
    }
    
    .template-actions {
        margin-top: 20px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
    }
    
    .selected-template {
        background: #d4edda;
        padding: 15px;
        border-radius: 10px;
        margin: 15px 0;
        border: 1px solid #c3e6cb;
    }
    
    body.dark .selected-template {
        background: #2d483d;
        border: 1px solid #3d5a47;
    }
    
    .selected-template h4 {
        color: #155724;
        margin-bottom: 10px;
    }
    
    body.dark .selected-template h4 {
        color: #b3d9c1;
    }
    
    .selected-template p {
        color: #0c5460;
        line-height: 1.5;
    }
    
    body.dark .selected-template p {
        color: #a8c8d1;
    }
    
    /* 历史记录样式 */
    .history-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #e0e0e0;
    }
    
    body.dark .history-header {
        border-bottom-color: #444;
    }
    
    .history-header h2 {
        color: #333;
        margin: 0;
    }
    
    body.dark .history-header h2 {
        color: #ddd;
    }
    
    .history-item {
        background: #f8f9fa;
        border-radius: 10px;
        padding: 15px;
        margin-bottom: 15px;
        border: 1px solid #e0e0e0;
        transition: all 0.3s ease;
    }
    
    body.dark .history-item {
        background: #2d2d3a;
        border: 1px solid #444;
    }
    
    .history-item:hover {
        border-color: #4b6cb7;
        box-shadow: 0 2px 8px rgba(75, 108, 183, 0.1);
    }
    
    .history-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }
    
    .history-type {
        background: #4b6cb7;
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 500;
    }
    
    .history-date {
        color: #666;
        font-size: 0.9rem;
    }
    
    body.dark .history-date {
        color: #aaa;
    }
    
    .history-prompt {
        color: #333;
        line-height: 1.5;
        margin-bottom: 15px;
        padding: 10px;
        background: white;
        border-radius: 6px;
        border-left: 3px solid #4b6cb7;
    }
    
    body.dark .history-prompt {
        color: #ddd;
        background: #3a3a4a;
    }
    
    .history-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }
    
    .history-actions .btn {
        padding: 6px 12px;
        font-size: 0.85rem;
    }
    
    .history-empty {
        text-align: center;
        padding: 40px 20px;
        color: #666;
        font-style: italic;
    }
    
    body.dark .history-empty {
        color: #aaa;
    }
    
    /* 按钮尺寸变体 */
    .btn-sm {
        padding: 6px 12px;
        font-size: 0.875rem;
        border-radius: 20px;
    }
    
    /* 响应式调整 */
    @media (max-width: 768px) {
        .template-items {
            grid-template-columns: 1fr;
        }
        
        .history-header {
            flex-direction: column;
            gap: 15px;
            align-items: stretch;
        }
        
        .history-meta {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
        }
        
        .history-actions {
            justify-content: center;
        }
    }
`;

// 注入额外样式
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// 扩展应用类
let featureManager;

// 等待应用初始化完成后再初始化功能管理器
document.addEventListener('DOMContentLoaded', () => {
    // 等待主应用初始化
    setTimeout(() => {
        if (window.app) {
            featureManager = new FeatureManager(window.app);
            
            // 扩展应用类方法
            const originalShowResult = window.app.showResult.bind(window.app);
            window.app.showResult = function(videoPath) {
                originalShowResult(videoPath);
                
                // 保存到历史记录
                const currentTab = document.querySelector('.tab.active').dataset.tab;
                let prompt = '';
                
                if (currentTab === 'text') {
                    prompt = this.optimizedTextPrompt || document.getElementById('text-input').value;
                } else if (currentTab === 'image') {
                    prompt = this.optimizedImagePrompt || document.getElementById('image-prompt').value;
                }
                
                if (prompt) {
                    featureManager.saveGenerationToHistory(prompt, videoPath, currentTab);
                }
            };
            
            console.log('Feature Manager initialized');
        }
    }, 1000);
});