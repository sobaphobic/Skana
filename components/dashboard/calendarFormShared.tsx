"use client";

import { ALERT_BEFORE_OPTIONS, type CalendarAlert } from "@/lib/calendarSession";
import type { CompanyPerson } from "@/lib/skanaSession";

export const CALENDAR_FORM_CONTROL_CLASS =
  "w-full rounded-xl border border-crm-border bg-crm-bg/40 px-3.5 py-2.5 text-sm text-crm-cream outline-none transition placeholder:text-crm-muted/70 focus:border-crm-cream/45 focus:ring-2 focus:ring-crm-cream/15";

export function decodeAlert(s: string): CalendarAlert {
  if (s === "at_time") return { type: "at_time" };
  if (s.startsWith("before:")) {
    const m = Number.parseInt(s.slice(7), 10);
    if (Number.isFinite(m)) return { type: "before", minutes: m };
  }
  return { type: "none" };
}

export function alertSelectOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [
    { value: "none", label: "None" },
    { value: "at_time", label: "At time of event" },
  ];
  for (const o of ALERT_BEFORE_OPTIONS) {
    if (o.minutes === 0) continue;
    out.push({ value: `before:${o.minutes}`, label: o.label });
  }
  return out;
}

export function AssignBlock({
  teamMembers,
  assignAll,
  setAssignAll,
  assigneeIds,
  toggleAssignee,
}: {
  teamMembers: CompanyPerson[];
  assignAll: boolean;
  setAssignAll: (v: boolean) => void;
  assigneeIds: string[];
  toggleAssignee: (id: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-crm-border/50 bg-crm-bg/15 p-3">
      <p className="text-xs font-medium text-crm-muted">Assign</p>
      <label className="flex items-center gap-2 text-sm text-crm-cream">
        <input
          type="checkbox"
          checked={assignAll}
          onChange={(ev) => setAssignAll(ev.target.checked)}
        />
        All team members
      </label>
      {!assignAll && teamMembers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {teamMembers.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-crm-border/60 px-2 py-1 text-xs text-crm-cream"
            >
              <input
                type="checkbox"
                checked={assigneeIds.includes(p.id)}
                onChange={() => toggleAssignee(p.id)}
              />
              {p.name}
            </label>
          ))}
        </div>
      ) : null}
      {!assignAll && teamMembers.length === 0 ? (
        <p className="text-xs text-crm-muted">
          Add team members under Company to assign individually.
        </p>
      ) : null}
    </div>
  );
}

export function AlertRow({
  label,
  value,
  onChange,
  alertOpts,
  controlClass,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  alertOpts: { value: string; label: string }[];
  controlClass: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-crm-muted">{label}</span>
      <select
        className={controlClass}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
      >
        {alertOpts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
