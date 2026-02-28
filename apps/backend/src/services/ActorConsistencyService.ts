// apps/backend/src/services/ActorConsistencyService.ts

export interface ActorProfile {
  id: string;
  name: string;
  refImage: string;
  createdAt: string;
}

export interface MotionSyncPayload {
  pose: Array<{ x: number; y: number; z: number }>;
  face?: { expression?: string; intensity?: number };
  timestamp: number;
}

export class ActorConsistencyService {
  private static actors: ActorProfile[] = [
    { id: 'hero-man', name: '英俊男性', refImage: '/assets/actors/hero.jpg', createdAt: new Date().toISOString() },
    { id: 'smart-girl', name: '智慧少女', refImage: '/assets/actors/girl.jpg', createdAt: new Date().toISOString() }
  ];

  static getActor(id: string): ActorProfile | undefined {
    return this.actors.find(a => a.id === id);
  }

  static getAllActors(): ActorProfile[] { return this.actors; }

  static createActor(name: string, refImage: string): ActorProfile {
    const sanitized = name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
    const actor: ActorProfile = {
      id: `${sanitized || 'actor'}-${Date.now()}`,
      name: name.trim() || '未命名演员',
      refImage: refImage.trim(),
      createdAt: new Date().toISOString()
    };
    this.actors = [actor, ...this.actors];
    return actor;
  }

  static syncMotion(actorId: string, motionData: MotionSyncPayload) {
    const actor = this.getActor(actorId);
    if (!actor) {
      throw new Error(`未找到演员: ${actorId}`);
    }

    return {
      success: true,
      actorId: actor.id,
      actorName: actor.name,
      mappedJoints: motionData.pose?.length || 0,
      expression: motionData.face?.expression || 'neutral',
      timestamp: motionData.timestamp || Date.now()
    };
  }

  // 增强型：支持自定义一致性强度
  static buildCharacterParams(actorId: string, prompt: string, strength: number = 1.0) {
    const actor = this.getActor(actorId);
    if (!actor) return { text: prompt };

    return {
      text: prompt,
      character_ref: {
        urls: [actor.refImage],
        strength: Math.min(Math.max(strength, 0), 1.0) // 限制在 0-1 之间
      }
    };
  }
}
