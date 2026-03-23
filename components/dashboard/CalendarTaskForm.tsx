"use client";

import {
  decodeAlert,
  AlertRow,
  AssignBlock,
  alertSelectOptions,
  CALENDAR_FORM_CONTROL_CLASS,
} from "@/components/dashboard/calendarFormShared";
import {
  newCalendarEntryId,
  type CalendarTaskEntry,
  upsertCalendarEntry,
} from "@/lib/calendarSession";
import type { CompanyPerson } from "@/lib/skanaSession";
import { type FormEvent, useEffect, useMemo, useState } from "react";

export function CalendarTaskForm({
  dateYmd,
  teamMembers,
  controlClass = CALENDAR_FORM_CONTROL_CLASS,
  onCancel,
  onSaved,
  heading = "New task",
  cancelLabel = "Cancel",
  /** When true (e.g. Tasks page), user must pick due date and time so the calendar can place the task. */
  requireDueDateAndTime = false,
}: {
  dateYmd: string;
  teamMembers: CompanyPerson[];
  controlClass?: string;
  onCancel: () => void;
  onSaved: () => void;
  heading?: string;
  cancelLabel?: string;
  requireDueDateAndTime?: boolean;
}) {
  const alertOpts = useMemo(() => alertSelectOptions(), []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskDateYmd, setTaskDateYmd] = useState(dateYmd);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineTime, setDeadlineTime] = useState("17:00");
  const [assignAll, setAssignAll] = useState(true);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [alert1, setAlert1] = useState("none");
  const [alert2, setAlert2] = useState("none");

  useEffect(() => {
    setTaskDateYmd(dateYmd);
  }, [dateYmd]);

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (requireDueDateAndTime) {
      if (!taskDateYmd || taskDateYmd.length < 10) {
        window.alert("Choose a due date for this task.");
        return;
      }
      if (!deadlineTime || !deadlineTime.trim()) {
        window.alert("Set a due time so the task can be placed on the calendar.");
        return;
      }
    }
    if (!assignAll && teamMembers.length > 0 && assigneeIds.length === 0) {
      window.alert(
        "Select at least one team member, or enable “All team members”.",
      );
      return;
    }
    const resolvedDate = requireDueDateAndTime ? taskDateYmd : dateYmd;
    const resolvedDeadline =
      requireDueDateAndTime || hasDeadline ? deadlineTime : null;
    const base = {
      id: newCalendarEntryId(),
      date: resolvedDate,
      assignAll,
      assigneeIds: assignAll ? [] : assigneeIds,
      alert1: decodeAlert(alert1),
      alert2: decodeAlert(alert2),
      completed: false,
      completedAt: null as string | null,
      createdAt: new Date().toISOString(),
    };
    const row: CalendarTaskEntry = {
      ...base,
      kind: "task",
      title: title.trim(),
      description: description.trim(),
      deadlineTime: resolvedDeadline,
    };
    upsertCalendarEntry(row);
    onSaved();
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={submit}>
      <p className="text-sm font-medium text-crm-cream">{heading}</p>
      <label className="block">
        <span className="mb-1 block text-xs text-crm-muted">Title</span>
        <input
          className={controlClass}
          value={title}
          onChange={(ev) => setTitle(ev.target.value)}
          required
        />
      </label>
      {requireDueDateAndTime ? (
        <>
          <label className="block">
            <span className="mb-1 block text-xs text-crm-muted">Due date</span>
            <input
              type="date"
              className={controlClass}
              value={taskDateYmd}
              onChange={(ev) => setTaskDateYmd(ev.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-crm-muted">Due time</span>
            <input
              type="time"
              className={controlClass}
              value={deadlineTime}
              onChange={(ev) => setDeadlineTime(ev.target.value)}
              required
            />
          </label>
        </>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-xs text-crm-muted">Description</span>
        <textarea
          className={`${controlClass} min-h-[88px] resize-y`}
          value={description}
          onChange={(ev) => setDescription(ev.target.value)}
          rows={4}
        />
      </label>
      {!requireDueDateAndTime ? (
        <>
          <label className="flex items-center gap-2 text-sm text-crm-cream">
            <input
              type="checkbox"
              checked={hasDeadline}
              onChange={(ev) => setHasDeadline(ev.target.checked)}
            />
            Time deadline (this day)
          </label>
          {hasDeadline ? (
            <label className="block">
              <span className="mb-1 block text-xs text-crm-muted">
                Deadline time
              </span>
              <input
                type="time"
                className={controlClass}
                value={deadlineTime}
                onChange={(ev) => setDeadlineTime(ev.target.value)}
              />
            </label>
          ) : null}
        </>
      ) : null}
      <AssignBlock
        teamMembers={teamMembers}
        assignAll={assignAll}
        setAssignAll={setAssignAll}
        assigneeIds={assigneeIds}
        toggleAssignee={toggleAssignee}
      />
      <AlertRow
        label="Alert"
        value={alert1}
        onChange={setAlert1}
        alertOpts={alertOpts}
        controlClass={controlClass}
      />
      <AlertRow
        label="Second alert"
        value={alert2}
        onChange={setAlert2}
        alertOpts={alertOpts}
        controlClass={controlClass}
      />
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-crm-border/80 px-4 py-2.5 text-sm font-medium text-crm-muted transition hover:bg-white/5"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          className="rounded-xl border border-crm-cream/40 bg-crm-active/90 px-4 py-2.5 text-sm font-medium text-crm-cream shadow-sm"
        >
          Save
        </button>
      </div>
    </form>
  );
}
