export const LOSS_REASONS = [
  { id: "too_expensive", label: "Too expensive" },
  { id: "not_enough_functionality", label: "Not enough functionality" },
  { id: "not_flexible_enough", label: "Not flexible enough" },
  { id: "not_required", label: "Not required" },
  { id: "other_crew_refusal", label: "Other crew refusal" },
  { id: "other", label: "Other" },
] as const;

export type LossReasonId = (typeof LOSS_REASONS)[number]["id"];

export function isLossReasonId(v: string): v is LossReasonId {
  return LOSS_REASONS.some((r) => r.id === v);
}

export function lossReasonLabel(id: LossReasonId | null): string {
  if (!id) return "Uncategorised";
  return LOSS_REASONS.find((r) => r.id === id)?.label ?? id;
}
