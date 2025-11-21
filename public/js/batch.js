import { API } from './api.js';
import { UI } from './ui.js';
import { I18n } from './i18n.js';

export class BatchManager {
    constructor(i18n) {
        this.i18n = i18n;
        this.pollingInterval = null;
        this.activeBatches = new Set();
    }

    init() {
        this.bindEvents();
        this.loadTemplates();
        this.loadUserBatches();
        this.startPolling();
    }

    bindEvents() {
        const createBtn = document.getElementById('create-batch-btn');
        const cancelBtn = document.getElementById('cancel-batch-btn');
        const submitBtn = document.getElementById('submit-batch-btn');
        const formContainer = document.getElementById('batch-create-form');
        const batchList = document.getElementById('batch-list');
        const countInput = document.getElementById('batch-count');
        const countDisplay = document.getElementById('batch-count-display');
        const statsBtn = document.getElementById('batch-stats-btn');
        const statsPanel = document.getElementById('batch-stats-panel');

        if (createBtn) {
            createBtn.addEventListener('click', () => {
                formContainer.style.display = 'block';
                createBtn.style.display = 'none';
                batchList.style.display = 'none';
                if (statsPanel) statsPanel.style.display = 'none';
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                formContainer.style.display = 'none';
                createBtn.style.display = 'inline-flex';
                batchList.style.display = 'grid';
            });
        }

        if (countInput && countDisplay) {
            countInput.addEventListener('input', (e) => {
                countDisplay.textContent = e.target.value;
            });
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.handleCreateBatch());
        }

        if (statsBtn) {
            statsBtn.addEventListener('click', () => {
                if (statsPanel.style.display === 'none') {
                    statsPanel.style.display = 'block';
                    this.loadStats();
                } else {
                    statsPanel.style.display = 'none';
                }
            });
        }
    }

    async loadStats() {
        try {
            const response = await API.getBatchStats();
            if (response.success && response.stats) {
                document.getElementById('stat-active').textContent = response.stats.activeBatches || 0;
                document.getElementById('stat-jobs').textContent = response.stats.totalJobs || 0;
                document.getElementById('stat-completed').textContent = response.stats.completedJobs || 0;
                document.getElementById('stat-total').textContent = response.stats.totalBatches || 0;
            }
        } catch (error) {
            console.error('Failed to load batch stats:', error);
        }
    }


    async loadTemplates() {
        try {
            const categorySelect = document.getElementById('batch-category-select');
            if (!categorySelect) return;

            // 获取模板数据
            // 这里我们复用 API.getPromptTemplates，或者如果后端有专门的批量模板API
            // 假设我们使用通用的模板API
            const response = await API.getBatchTemplates();

            if (response.success && response.templates) {
                // 从模板数组中提取唯一的分类
                const categories = [...new Set(response.templates.map(t => t.category))];

                categorySelect.innerHTML = `<option value="">${this.i18n.get('batch.selectCategory')}</option>`;
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat; // 这里应该使用翻译，但暂时直接使用key
                    categorySelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load templates for batch:', error);
        }
    }

    async handleCreateBatch() {
        const categorySelect = document.getElementById('batch-category-select');
        const countInput = document.getElementById('batch-count');
        const modelSelect = document.getElementById('batch-model-select');
        const submitBtn = document.getElementById('submit-batch-btn');

        const category = categorySelect.value;
        const count = parseInt(countInput.value);
        const model = modelSelect.value;

        if (!category) {
            UI.showNotification(this.i18n.get('batch.errorCategory'), 'error');
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.classList.add('loading');

            // 构建批量请求数据
            // 这里我们需要从分类中随机选择模板，或者让后端处理
            // 假设我们发送分类名称，让后端随机生成
            // 或者我们在前端生成输入列表

            // 既然 BatchController 期望 inputs 数组，我们应该在前端生成
            const response = await API.getPromptTemplates();
            // 过滤出所选分类的模板
            const templates = response.templates.filter(t => t.category === category);

            if (!templates || templates.length === 0) {
                throw new Error('No templates found for category');
            }

            const inputs = [];
            for (let i = 0; i < count; i++) {
                const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
                inputs.push({
                    prompt: randomTemplate.prompt || randomTemplate.text,
                    model: model
                });
            }

            const batchData = {
                name: `${category} Batch - ${new Date().toLocaleString()}`,
                inputs: inputs,
                settings: {
                    resolution: '1080p' // 默认设置
                }
            };

            // 调用批量创建 API
            const result = await API.createBatch(batchData);

            if (result.success) {
                UI.showNotification(this.i18n.get('batch.createSuccess'), 'success');

                // 重置表单
                document.getElementById('batch-create-form').style.display = 'none';
                document.getElementById('create-batch-btn').style.display = 'inline-flex';
                document.getElementById('batch-list').style.display = 'grid';

                // 刷新列表
                this.loadUserBatches();
            }

        } catch (error) {
            console.error('Batch creation failed:', error);
            UI.showNotification(error.message || this.i18n.get('batch.createError'), 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
        }
    }



    async loadUserBatches() {
        try {
            const data = await API.getBatches();

            if (data.success) {
                this.renderTaskList(data.batches);

                // 更新活跃任务集合
                data.batches.forEach(batch => {
                    if (['pending', 'processing', 'preparing'].includes(batch.status)) {
                        this.activeBatches.add(batch.id);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to load batches:', error);
        }
    }

    renderTaskList(batches) {
        const listContainer = document.getElementById('batch-list');
        if (!listContainer) return;

        if (batches.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state-small">
                    <p>${this.i18n.get('batch.empty')}</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = batches.map(batch => this.createBatchItemHTML(batch)).join('');
    }

    createBatchItemHTML(batch) {
        // 修复字段名：使用 totalJobs, completedJobs 而不是 total, completed
        const totalJobs = batch.totalJobs || 0;
        const completedJobs = batch.completedJobs || 0;
        const failedJobs = batch.failedJobs || 0;
        const progress = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
        const statusClass = this.getStatusClass(batch.status);
        const statusText = this.getStatusText(batch.status);

        // 修复日期格式化
        const createdDate = batch.createdAt ? new Date(batch.createdAt) : new Date();
        const dateStr = createdDate.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        return `
            <div class="batch-task-item glass-panel" data-id="${batch.id}">
                <div class="batch-item-header">
                    <h4>${batch.name || '未命名任务'}</h4>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="batch-item-meta">
                    <span>${dateStr}</span>
                    <span>${completedJobs}/${totalJobs} ${this.i18n.get('batch.videos') || '视频'}</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progress}%"></div>
                </div>
                ${batch.status === 'completed' ? `
                    <button class="btn btn-sm btn-ghost view-results-btn" onclick="window.open('/batch/${batch.id}', '_blank')">
                        ${this.i18n.get('batch.viewResults') || '查看结果'}
                    </button>
                ` : ''}
            </div>
        `;
    }

    getStatusClass(status) {
        switch (status) {
            case 'completed': return 'status-success';
            case 'processing': return 'status-processing';
            case 'failed': return 'status-error';
            default: return 'status-pending';
        }
    }

    getStatusText(status) {
        // 使用 i18n 翻译
        const translationKey = `batch.status.${status}`;
        const translated = this.i18n.get(translationKey);
        // 如果翻译键不存在，返回原始状态值
        return translated !== translationKey ? translated : status;
    }

    startPolling() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);

        this.pollingInterval = setInterval(async () => {
            if (this.activeBatches.size === 0) return;

            for (const batchId of this.activeBatches) {
                try {
                    const data = await API.getBatchStatus(batchId);

                    if (data.success) {
                        this.updateBatchItem(data.batch);

                        if (['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(data.batch.status)) {
                            this.activeBatches.delete(batchId);
                        }
                    }
                } catch (error) {
                    console.error(`Polling failed for batch ${batchId}:`, error);
                }
            }
        }, 3000); // 每3秒轮询一次
    }

    updateBatchItem(batch) {
        const item = document.querySelector(`.batch-task-item[data-id="${batch.id}"]`);
        if (item) {
            // 简单起见，重新渲染整个列表或者只更新部分
            // 这里我们重新加载整个列表以保持一致性
            this.loadUserBatches();
        }
    }
}
