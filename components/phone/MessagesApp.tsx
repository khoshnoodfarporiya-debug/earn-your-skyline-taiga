"use client";

import type { RunState } from "@/lib/game/types";
import { phoneOf, roleLabel } from "@/lib/ui/phoneAccess";
import { Avatar } from "../ui/Avatar";
import { EndOfList } from "./EndOfList";

/**
 * Messages: private conversations that react to the run.
 *
 * Some carry decisions with real consequences, and those stay open until
 * answered — an unanswered message from a regulator is supposed to sit there
 * making you uncomfortable.
 */
export function MessagesApp({
  state,
  dispatch,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const phone = phoneOf(state);
  const messages = phone?.messages ?? [];

  if (messages.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-[14px] leading-relaxed text-ink-soft">
        No messages. People get in touch when something is going unusually well
        or unusually badly.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-rule/40">
      {messages.map((msg) => {
        const pending = msg.choices && msg.answered === undefined;
        return (
          <li
            key={msg.id}
            className={`px-4 py-3.5 ${!msg.read ? "bg-clinical-tint/40" : ""}`}
          >
            <div className="flex items-start gap-2.5">
              {/* Larger than a feed row: a message is a conversation with
                  one person, and the header is the only place their face is
                  the subject rather than a label. Unknown senders fall through
                  to initials — the handle is the only key, so a display name
                  cannot collide its way into somebody's portrait. */}
              <Avatar name={msg.from} handle={msg.handle} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[14.5px] font-semibold text-ink">
                    {msg.from}
                  </span>
                  <span className="sign rounded-sm bg-card px-1.5 py-0.5 text-[11.5px] text-ink-faint">
                    {roleLabel(state.careerId, msg.role)}
                  </span>
                  <span className="num text-[12px] text-ink-faint">
                    wk {msg.week}
                  </span>
                  {!msg.read && (
                    <span className="sign text-[11.5px] text-clinical">
                      New
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">
                  {msg.body}
                </p>

                {pending && (
                  <div className="mt-3 space-y-2">
                    {msg.choices!.map((choice, i) => (
                      <button
                        key={i}
                        onClick={() =>
                          dispatch("answerMessage", `${msg.id}|${i}`)
                        }
                        className="min-h-[48px] w-full rounded-form border border-rule bg-card px-3 py-2 text-left transition hover:border-clinical hover:bg-clinical-tint"
                      >
                        <span className="block text-[14px] font-semibold text-ink">
                          {choice.label}
                        </span>
                        <span className="num block text-[12.5px] text-ink-soft">
                          {choice.detail}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/*
                  Guarded even though the save validator now bounds
                  `answered`: this component renders whatever storage handed
                  it, and a validator and a component disagreeing about whose
                  job safety is ends with both wrong. A missing choice renders
                  nothing rather than crashing the thread.
                */}
                {msg.choices &&
                  msg.answered !== undefined &&
                  msg.choices[msg.answered] && (
                    <p className="mt-2 border-l-2 border-clinical/60 pl-2.5 text-[13.5px] italic leading-snug text-ink-soft">
                      {msg.choices[msg.answered].reply}
                    </p>
                  )}
              </div>
            </div>
          </li>
        );
      })}
      <li>
        <EndOfList>Nothing else in your inbox</EndOfList>
      </li>
    </ul>
  );
}
