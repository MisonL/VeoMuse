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
    if (this.keys.length === 0) {
      throw new Error('未配置 Gemini API 密钥。请检查环境变量。');
    }
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }

  static getAvailableKeys(): string[] {
    return [...this.keys];
  }
}
