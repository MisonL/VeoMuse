// apps/backend/src/services/ActorConsistencyService.ts

export interface ActorProfile {
  id: string
  name: string
  refImage: string
  createdAt: string
}

export interface MotionSyncPayload {
  pose: Array<{ x: number; y: number; z: number }>
  face?: { expression?: string; intensity?: number }
  timestamp: number
}

export class ActorConsistencyService {
  private static actorsByOrganization = new Map<string, ActorProfile[]>()

  private static buildSeedActors(): ActorProfile[] {
    const now = new Date().toISOString()
    return [
      { id: 'hero-man', name: '英俊男性', refImage: '/assets/actors/hero.jpg', createdAt: now },
      { id: 'smart-girl', name: '智慧少女', refImage: '/assets/actors/girl.jpg', createdAt: now }
    ]
  }

  private static normalizeOrganizationId(organizationId?: string): string {
    const normalized = (organizationId || '').trim()
    return normalized || 'org_default'
  }

  private static resolveActors(organizationId?: string): ActorProfile[] {
    const orgId = this.normalizeOrganizationId(organizationId)
    const existing = this.actorsByOrganization.get(orgId)
    if (existing) return existing
    const seed = this.buildSeedActors()
    this.actorsByOrganization.set(orgId, seed)
    return seed
  }

  static getActor(id: string, organizationId?: string): ActorProfile | undefined {
    return this.resolveActors(organizationId).find((a) => a.id === id)
  }

  static getAllActors(organizationId?: string): ActorProfile[] {
    return [...this.resolveActors(organizationId)]
  }

  static createActor(name: string, refImage: string, organizationId?: string): ActorProfile {
    const actors = this.resolveActors(organizationId)
    const sanitized = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    const actor: ActorProfile = {
      id: `${sanitized || 'actor'}-${Date.now()}`,
      name: name.trim() || '未命名演员',
      refImage: refImage.trim(),
      createdAt: new Date().toISOString()
    }
    this.actorsByOrganization.set(this.normalizeOrganizationId(organizationId), [actor, ...actors])
    return actor
  }

  static syncMotion(actorId: string, motionData: MotionSyncPayload, organizationId?: string) {
    const actor = this.getActor(actorId, organizationId)
    if (!actor) {
      throw new Error(`未找到演员: ${actorId}`)
    }

    return {
      success: true,
      actorId: actor.id,
      actorName: actor.name,
      mappedJoints: motionData.pose?.length || 0,
      expression: motionData.face?.expression || 'neutral',
      timestamp: motionData.timestamp || Date.now()
    }
  }

  // 增强型：支持自定义一致性强度
  static buildCharacterParams(
    actorId: string,
    prompt: string,
    strength: number = 1.0,
    organizationId?: string
  ) {
    const actor = this.getActor(actorId, organizationId)
    if (!actor) return { text: prompt }

    return {
      text: prompt,
      character_ref: {
        urls: [actor.refImage],
        strength: Math.min(Math.max(strength, 0), 1.0) // 限制在 0-1 之间
      }
    }
  }
}
