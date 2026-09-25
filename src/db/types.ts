export type Exercise = {
  id: string;
  name: string;
  /** Raw name without brand. Present on rows from list queries. */
  base?: string;
  brand: string;
  /** Grouping label for Moves. Empty = stands alone. */
  movement: string;
  primary_muscle: string;
  secondary_muscles: string;
  equipment: string | null;
  default_rest_seconds: number;
  target_rep_min: number;
  target_rep_max: number;
  increment_kg: number;
  library_id: string;
  progression: Progression;
  load: Load;
  per_side: number;
  notes: string;
};

export type Progression = 'double' | 'linear' | 'greyskull';
export type Load = 'weight' | 'bodyweight' | 'time';
