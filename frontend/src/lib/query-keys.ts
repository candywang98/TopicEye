export const queryKeys = {
  contents: {
    all: ['contents'] as const,
    list: (filters: object) => ['contents', 'list', filters] as const,
    viral: (filters: object) => ['contents', 'low-follower-viral', filters] as const,
  },
  picks: {
    all: ['picks'] as const,
    list: (filters: object) => ['picks', 'list', filters] as const,
    evidence: (ids: number[]) => ['picks', 'evidence', ids] as const,
  },
  favorites: {
    all: ['favorites'] as const,
    list: (filters: object) => ['favorites', 'list', filters] as const,
  },
  motherTopics: {
    all: ['my-topics'] as const,
    list: (activeOnly: boolean) => ['my-topics', 'list', activeOnly] as const,
    candidates: (filters: object) => ['my-topics', 'candidates', filters] as const,
  },
  daily: {
    all: ['daily-reports'] as const,
    report: (date: string | null) => ['daily-reports', 'report', date] as const,
  },
} as const;
