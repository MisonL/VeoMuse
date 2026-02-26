// apps/backend/src/services/ApiKeyService.ts

export class ApiKeyService {
  private static keys: string[] = [];
  private static currentIndex: number = 0;

  static init(keys: string | string[]) {
    if (typeof keys === 'string') {
      this.keys = keys.split(',').map(k => k.trim()).filter(Boolean);
    } else {
      this.keys = keys.filter(Boolean);
    }
    console.log(`🔑 ApiKeyService: 加载了 ${this.keys.length} 个 API 密钥`);
  }

  static getNextKey(): string {
    const key = this.keys[this.currentIndex];
    if (!key) {
      throw new Error('未配置 Gemini API 密钥，请在环境变量中设置 GEMINI_API_KEYS');
    }
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }

  static getAvailableKeys(): string[] {
    return [...this.keys];
  }
}
