export const PIPELINE_STAGES = [
  {
    id: "lead",
    label: "Lead",
    topBarClass: "border-t-4 border-t-blue-500",
  },
  {
    id: "qualified",
    label: "Qualified",
    topBarClass: "border-t-4 border-t-purple-500",
  },
  {
    id: "proposal",
    label: "Proposal",
    topBarClass: "border-t-4 border-t-amber-400",
  },
  {
    id: "negotiation",
    label: "Negotiation",
    topBarClass: "border-t-4 border-t-teal-400",
  },
  {
    id: "closed_won",
    label: "Closed Won",
    topBarClass: "border-t-4 border-t-emerald-500",
  },
  {
    id: "closed_lost",
    label: "Closed Lost",
    topBarClass: "border-t-4 border-t-red-500",
  },
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]["id"];

export const OPEN_PIPELINE_STAGES: PipelineStageId[] = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
];

export function isPipelineStageId(v: string): v is PipelineStageId {
  return PIPELINE_STAGES.some((s) => s.id === v);
}
