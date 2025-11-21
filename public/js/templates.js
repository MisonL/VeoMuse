// public/js/templates.js - 提示词模板管理模块
import { API } from './api.js';

export class TemplateManager {
    constructor(i18n) {
        this.i18n = i18n;
        this.templates = [];
        this.categories = [];
        this.currentCategory = null;
    }

    async init() {
        try {
            const response = await API.getPromptTemplates();
            if (response.success) {
                this.templates = response.templates || [];
                this.extractCategories();
            }
        } catch (error) {
            console.error('Failed to load templates:', error);
        }
    }

    extractCategories() {
        const categorySet = new Set();
        this.templates.forEach(template => {
            if (template.category) {
                categorySet.add(template.category);
            }
        });
        this.categories = Array.from(categorySet);
    }

    async getRandomTemplate() {
        try {
            const response = await API.getRandomTemplate();
            return response.template;
        } catch (error) {
            console.error('Failed to get random template:', error);
            return null;
        }
    }

    async getRandomImageTemplate() {
        try {
            const response = await API.getRandomImageTemplate();
            return response.template;
        } catch (error) {
            console.error('Failed to get random image template:', error);
            return null;
        }
    }

    async getTemplatesByCategory(category) {
        try {
            const response = await API.getTemplatesByCategory(category);
            return response.templates || [];
        } catch (error) {
            console.error('Failed to get templates by category:', error);
            return [];
        }
    }

    // 创建模板选择器UI
    createTemplateSelector(targetInputId, type = 'text') {
        const container = document.createElement('div');
        container.className = 'template-selector';
        container.innerHTML = `
            <button class="template-btn glass-panel" id="templateBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <span>${this.i18n.get('templates.useTemplate')}</span>
            </button>
            <button class="template-btn glass-panel random-btn" id="randomBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"></path>
                    <path d="m18 2 4 4-4 4"></path>
                    <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"></path>
                    <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"></path>
                    <path d="m18 14 4 4-4 4"></path>
                </svg>
                <span>${this.i18n.get('templates.random')}</span>
            </button>
        `;

        const templateBtn = container.querySelector('#templateBtn');
        const randomBtn = container.querySelector('#randomBtn');

        // 随机模板按钮
        randomBtn.addEventListener('click', async () => {
            randomBtn.disabled = true;
            randomBtn.classList.add('loading');

            try {
                const template = type === 'image'
                    ? await this.getRandomImageTemplate()
                    : await this.getRandomTemplate();

                if (template) {
                    const input = document.getElementById(targetInputId);
                    if (input) {
                        input.value = template.prompt || template.text || '';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            } catch (err) {
                console.error('Error in random button click:', err);
            } finally {
                randomBtn.disabled = false;
                randomBtn.classList.remove('loading');
            }
        });

        // 模板列表按钮
        templateBtn.addEventListener('click', () => {
            this.showTemplateModal(targetInputId, type);
        });

        return container;
    }

    // 显示模板选择模态框
    showTemplateModal(targetInputId, type) {
        const modal = document.createElement('div');
        modal.className = 'template-modal';
        modal.innerHTML = `
            <div class="template-modal-overlay"></div>
            <div class="template-modal-content glass-panel">
                <div class="template-modal-header">
                    <h3>${this.i18n.get('templates.title')}</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="template-categories" id="templateCategories"></div>
                <div class="template-list" id="templateList"></div>
            </div>
        `;

        document.body.appendChild(modal);

        // 渲染分类
        this.renderCategories(modal.querySelector('#templateCategories'));

        // 渲染所有模板
        this.renderTemplates(modal.querySelector('#templateList'), this.templates, targetInputId);

        // 关闭按钮
        modal.querySelector('.close-btn').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('.template-modal-overlay').addEventListener('click', () => {
            modal.remove();
        });
    }

    renderCategories(container) {
        container.innerHTML = `
            <button class="category-chip active" data-category="all">
                ${this.i18n.get('templates.categories')}
            </button>
            ${this.categories.map(cat => `
                <button class="category-chip" data-category="${cat}">${cat}</button>
            `).join('')}
        `;

        container.querySelectorAll('.category-chip').forEach(chip => {
            chip.addEventListener('click', async (e) => {
                container.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');

                const category = e.target.dataset.category;
                const templates = category === 'all'
                    ? this.templates
                    : await this.getTemplatesByCategory(category);

                const listContainer = document.querySelector('#templateList');
                this.renderTemplates(listContainer, templates, null);
            });
        });
    }

    renderTemplates(container, templates, targetInputId) {
        container.innerHTML = templates.map(template => `
            <div class="template-card glass-panel" data-prompt="${this.escapeHtml(template.prompt || template.text)}">
                <h4>${template.name || template.title || '未命名'}</h4>
                <p>${template.description || template.prompt || template.text || ''}</p>
                ${template.category ? `<span class="template-tag">${template.category}</span>` : ''}
            </div>
        `).join('');

        if (targetInputId) {
            container.querySelectorAll('.template-card').forEach(card => {
                card.addEventListener('click', () => {
                    const prompt = card.dataset.prompt;
                    const input = document.getElementById(targetInputId);
                    input.value = prompt;
                    input.dispatchEvent(new Event('input', { bubbles: true }));

                    // 关闭模态框
                    document.querySelector('.template-modal')?.remove();
                });
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
