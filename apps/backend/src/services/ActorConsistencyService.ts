// apps/backend/src/services/ActorConsistencyService.ts

export interface ActorProfile {
  id: string;
  name: string;
  refImage: string;
}

export class ActorConsistencyService {
  private static actors: ActorProfile[] = [
    { id: 'hero-man', name: '英俊男性', refImage: '/assets/actors/hero.jpg' },
    { id: 'smart-girl', name: '智慧少女', refImage: '/assets/actors/girl.jpg' }
  ];

  static getActor(id: string): ActorProfile | undefined {
    return this.actors.find(a => a.id === id);
  }

  static getAllActors(): ActorProfile[] { return this.actors; }

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
