"use client";

import {
  fileToDataUrlIfUnder,
  formatWelcomeDisplayName,
  parseOnboardingProfile,
  readOnboardingProfileRaw,
} from "@/lib/skanaSession";
import {
  appendTeamMessage,
  getThreadMessages,
  readTeamMessagesRaw,
  seedDemoUnreadBadgeMessage,
  subscribeTeamMessages,
  type TeamMessageAttachment,
} from "@/lib/teamMessagesSession";
import {
  countUnreadPeerMessages,
  getThreadLastReadAt,
  markTeamThreadRead,
  parseTeamMessagesReadState,
  readTeamMessagesReadRaw,
  subscribeTeamMessagesRead,
} from "@/lib/teamMessagesReadSession";
import { Paperclip, Send, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const MAX_ATTACH_BYTES = 450_000;
const MAX_FILES_PER_MESSAGE = 5;

const DEMO_TEAM = [
  {
    threadId: "demo_alex_chen",
    initial: "A",
    avatarClass: "bg-red-400/90 text-white",
    name: "Alex Chen",
    email: "alex@startup.com",
  },
  {
    threadId: "demo_jordan_lee",
    initial: "J",
    avatarClass: "bg-teal-400/80 text-crm-bg",
    name: "Jordan Lee",
    email: "jordan@startup.com",
  },
  {
    threadId: "demo_chris_bailey",
    initial: "C",
    avatarClass: "bg-violet-500/85 text-white",
    name: "Chris Bailey",
    email: "chris@startup.com",
  },
] as const;

const controlClass =
  "w-full rounded-xl border border-crm-border bg-crm-bg/40 px-3.5 py-2.5 text-sm text-crm-cream placeholder:text-crm-muted/70 outline-none transition focus:border-crm-cream/45 focus:ring-2 focus:ring-crm-cream/15";

function senderDisplayName(
  profile: ReturnType<typeof parseOnboardingProfile>,
): string {
  if (!profile) return "You";
  const w = formatWelcomeDisplayName(profile);
  if (w !== "there") return w;
  return profile.email.trim() || profile.username.trim() || "You";
}

export function TeamMessagesPanel() {
  const profileRaw = useSyncExternalStore(
    () => () => {},
    readOnboardingProfileRaw,
    () => null,
  );
  const profile = parseOnboardingProfile(profileRaw);

  const messagesRaw = useSyncExternalStore(
    subscribeTeamMessages,
    readTeamMessagesRaw,
    () => null,
  );

  const readRaw = useSyncExternalStore(
    subscribeTeamMessagesRead,
    readTeamMessagesReadRaw,
    () => null,
  );

  const readState = parseTeamMessagesReadState(readRaw);

  const [activeThread, setActiveThread] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const messages =
    !activeThread ? [] : getThreadMessages(activeThread.id);
  void messagesRaw;
  void readRaw;

  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const pendingFilesRef = useRef<File[]>([]);
  pendingFilesRef.current = pendingFiles;

  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myName = senderDisplayName(profile);

  useEffect(() => {
    seedDemoUnreadBadgeMessage();
  }, []);

  useEffect(() => {
    setDraft("");
    setPendingFiles([]);
    setSendError(null);
  }, [activeThread?.id]);

  useEffect(() => {
    if (!activeThread) return;
    markTeamThreadRead(activeThread.id);
  }, [activeThread, messagesRaw]);

  useEffect(() => {
    if (!activeThread) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setActiveThread(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeThread]);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onPickFiles = useCallback((list: FileList | null) => {
    if (!list?.length) return;
    setSendError(null);
    const picked = Array.from(list);
    setPendingFiles((prev) => {
      const next = [...prev];
      for (const f of picked) {
        if (f && next.length < MAX_FILES_PER_MESSAGE) next.push(f);
      }
      return next;
    });
  }, []);

  const sendMessage = useCallback(async () => {
    if (!activeThread) return;
    setSendError(null);
    const body = draft.trim();
    const files = pendingFilesRef.current;
    if (!body && files.length === 0) return;

    const attachments: TeamMessageAttachment[] = [];
    for (const file of files) {
      if (file.size === 0) {
        setSendError(`"${file.name}" is empty. Choose a different file.`);
        return;
      }
      if (file.size > MAX_ATTACH_BYTES) {
        setSendError(
          `"${file.name}" is too large (max ~${Math.round(MAX_ATTACH_BYTES / 1000)}KB per file).`,
        );
        return;
      }
      const dataUrl = await fileToDataUrlIfUnder(file, MAX_ATTACH_BYTES);
      if (!dataUrl) {
        setSendError(
          `Could not read "${file.name}". Try another format or smaller file.`,
        );
        return;
      }
      attachments.push({
        id: crypto.randomUUID(),
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        dataUrl,
      });
    }

    setSending(true);
    try {
      const saved = appendTeamMessage(activeThread.id, {
        authorName: myName,
        body,
        attachments,
      });
      if (!saved) {
        setSendError(
          "Could not save the message (browser storage may be full). Try a smaller attachment or remove older chats.",
        );
        return;
      }
      setDraft("");
      setPendingFiles([]);
    } finally {
      setSending(false);
    }
  }, [activeThread, draft, myName]);

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <UsersIcon />
        <h3 className="text-sm font-semibold text-crm-cream">Team Overview</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_TEAM.map((member) => {
          const threadMessages = getThreadMessages(member.threadId);
          const unread = countUnreadPeerMessages(
            threadMessages,
            myName,
            getThreadLastReadAt(member.threadId, readState),
          );
          return (
            <TeamMemberCard
              key={member.threadId}
              initial={member.initial}
              avatarClass={member.avatarClass}
              name={member.name}
              email={member.email}
              threadId={member.threadId}
              unreadCount={unread}
              chatOpen={activeThread?.id === member.threadId}
              onOpenMessages={() =>
                setActiveThread({ id: member.threadId, name: member.name })
              }
            />
          );
        })}
      </div>

      {activeThread ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Close messages"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setActiveThread(null)}
          />
          <div
            id={`team-chat-${activeThread.id}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-chat-title"
            className="relative z-10 flex max-h-[min(85vh,560px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-crm-border bg-crm-main shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-crm-border/50 bg-crm-bg/30 px-4 py-3">
              <h4
                id="team-chat-title"
                className="text-sm font-semibold text-crm-cream"
              >
                Messages · {activeThread.name}
              </h4>
              <button
                type="button"
                onClick={() => setActiveThread(null)}
                className="rounded-lg p-2 text-crm-muted transition hover:bg-white/10 hover:text-crm-cream"
                aria-label="Close messages"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-crm-muted">
                    No messages yet. Say hello to {activeThread.name} — text and
                    attachments are saved in this browser only.
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = m.authorName === myName;
                    return (
                      <div
                        key={m.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[min(100%,26rem)] rounded-2xl border px-3 py-2.5 text-sm shadow-sm ${
                            mine
                              ? "border-crm-active/50 bg-crm-active/25 text-crm-cream"
                              : "border-crm-border/60 bg-crm-elevated/40 text-crm-cream/95"
                          }`}
                        >
                          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted">
                            {m.authorName}
                            <span className="ml-2 font-normal normal-case text-crm-muted/80">
                              {new Date(m.createdAt).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </span>
                          </p>
                          {m.body ? (
                            <p className="mt-1.5 whitespace-pre-wrap break-words">
                              {m.body}
                            </p>
                          ) : null}
                          {m.attachments.length > 0 ? (
                            <ul className="mt-2 space-y-2">
                              {m.attachments.map((a) => (
                                <li key={a.id}>
                                  {a.mimeType.startsWith("image/") ? (
                                    <a
                                      href={a.dataUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
                                      <img
                                        src={a.dataUrl}
                                        alt=""
                                        className="max-h-40 max-w-full rounded-lg object-contain ring-1 ring-crm-border/60"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      href={a.dataUrl}
                                      download={a.fileName}
                                      className="inline-flex rounded-lg border border-crm-border/70 px-2.5 py-1 text-xs font-medium text-crm-cream underline-offset-2 hover:underline"
                                    >
                                      {a.fileName}
                                    </a>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="shrink-0 border-t border-crm-border/40 bg-crm-bg/25 p-3">
                {sendError ? (
                  <p className="mb-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-crm-cream/95">
                    {sendError}
                  </p>
                ) : null}
                {pendingFiles.length > 0 ? (
                  <ul className="mb-2 flex flex-wrap gap-2">
                    {pendingFiles.map((f, idx) => (
                      <li
                        key={`${f.name}-${idx}`}
                        className="inline-flex max-w-full items-center gap-1 rounded-lg border border-crm-border/60 bg-crm-bg/40 px-2 py-1 text-xs text-crm-cream"
                      >
                        <span className="truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removePendingFile(idx)}
                          className="shrink-0 rounded p-0.5 text-crm-muted hover:bg-white/10 hover:text-crm-cream"
                          aria-label={`Remove ${f.name}`}
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setSendError(null);
                  }}
                  rows={2}
                  placeholder="Write a message…"
                  className={`${controlClass} mb-2 resize-none`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    id={fileInputId}
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.pdf"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(e) => {
                      onPickFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-controls={fileInputId}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-crm-border/70 px-3 py-2 text-xs font-medium text-crm-cream transition hover:bg-white/5"
                  >
                    <Paperclip className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    Attach
                  </button>
                  <button
                    type="button"
                    disabled={
                      sending ||
                      (!draft.trim() && pendingFiles.length === 0)
                    }
                    onClick={() => void sendMessage()}
                    className="ml-auto inline-flex items-center gap-2 rounded-xl border border-crm-border/80 bg-crm-active/90 px-4 py-2 text-sm font-medium text-crm-cream shadow-sm transition hover:bg-crm-active disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" strokeWidth={2} aria-hidden />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function UsersIcon() {
  return (
    <svg
      className="h-4 w-4 text-crm-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function TeamMemberCard({
  threadId,
  initial,
  avatarClass,
  name,
  email,
  unreadCount,
  chatOpen,
  onOpenMessages,
}: {
  threadId: string;
  initial: string;
  avatarClass: string;
  name: string;
  email: string;
  unreadCount: number;
  chatOpen: boolean;
  onOpenMessages: () => void;
}) {
  const hasUnread = unreadCount > 0;

  return (
    <div className="rounded-2xl border border-crm-border bg-crm-elevated/30 p-5 text-center shadow-sm">
      <div
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold ${avatarClass}`}
      >
        {initial}
      </div>
      <p className="mt-3 text-sm font-semibold text-crm-cream">{name}</p>
      <p className="text-xs text-crm-muted">{email}</p>
      <div className="relative mt-3">
        <button
          type="button"
          onClick={onOpenMessages}
          aria-expanded={chatOpen}
          aria-haspopup="dialog"
          aria-controls={chatOpen ? `team-chat-${threadId}` : undefined}
          aria-label={
            hasUnread
              ? `Messages, ${unreadCount} unread from ${name}`
              : `Messages with ${name}`
          }
          className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
            chatOpen
              ? "border-crm-active/60 bg-crm-active/20 text-crm-cream"
              : "border-crm-border/80 text-crm-cream hover:border-crm-cream/35 hover:bg-white/5"
          }`}
        >
          Messages
        </button>
        {hasUnread ? (
          unreadCount === 1 ? (
            <span
              className="pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-crm-elevated/30 bg-red-500 shadow-md"
              aria-hidden
            />
          ) : (
            <span
              className="pointer-events-none absolute -right-1 -top-1 flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[0.65rem] font-bold leading-none text-white shadow-md ring-2 ring-crm-elevated/30"
              aria-hidden
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-crm-border/50 pt-4 text-center text-[0.65rem] uppercase tracking-wide text-crm-muted">
        <div>
          <p className="font-semibold text-crm-cream">0</p>
          <p>Tasks</p>
        </div>
        <div>
          <p className="font-semibold text-crm-cream">0</p>
          <p>Deals</p>
        </div>
        <div>
          <p className="font-semibold text-crm-cream">£0</p>
          <p>Pipeline</p>
        </div>
      </div>
    </div>
  );
}
