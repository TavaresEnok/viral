export interface QuotaPlan {
  maxProjects: number;
  maxMinutes: number;
  maxRenders: number;
  maxClips: number;
}

export const QUOTA_PLANS: Record<string, QuotaPlan> = {
  free: {
    maxProjects: 5,
    maxMinutes: 60,
    maxRenders: 20,
    maxClips: 10,
  },
  pro: {
    maxProjects: 50,
    maxMinutes: 600,
    maxRenders: 200,
    maxClips: 100,
  },
  studio: {
    maxProjects: 500,
    maxMinutes: 6000,
    maxRenders: 2000,
    maxClips: 500,
  },
  /** Plano interno sem restrições — para contas de demo e da equipe. */
  master: {
    maxProjects: 999999,
    maxMinutes: 999999,
    maxRenders: 999999,
    maxClips: 999999,
  },
};

export function getPlanLimits(planName: string): QuotaPlan {
  return QUOTA_PLANS[planName?.toLowerCase()] || QUOTA_PLANS.free;
}
