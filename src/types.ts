export type WorkoutType = 'run' | 'ride' | 'strength' | 'walk' | 'mobility' | 'other';

export interface Workout {
  id: string;
  startedAt: string;
  timezone: string;
  title: string;
  type: WorkoutType;
  durationMinutes: number;
  distanceKm?: number;
  load?: number;
  notes: string;
  source: string;
  sourceId?: string;
  sourceUrl?: string;
  importedAt: string;
  fingerprint: string;
}

export interface ImportCandidate extends Workout {
  duplicate?: boolean;
  fileName?: string;
}
