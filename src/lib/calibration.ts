import { supabaseAdmin } from "./supabase";

export interface CalibrationPatternRow {
  id: string;
  key: string;
  name: string;
  description: string;
  evidence_signal: string;
  points: number;
  source_note: string;
  active: boolean;
}

export async function fetchActiveCalibrationPatterns(): Promise<
  CalibrationPatternRow[]
> {
  const { data, error } = await supabaseAdmin()
    .from("calibration_patterns")
    .select("*")
    .eq("active", true)
    .order("points", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
