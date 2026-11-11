"use client";

import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import { kitchen } from "@/lib/game/careers/chef";
import { practice } from "@/lib/game/careers/lawyer";
import {
  MAX_FEED,
  canPostThisWeek,
  postContext,
} from "@/lib/game/medical/phone";
import { POSTS } from "@/lib/game/medical/posts";
import {
  followerCount,
  identityOf,
  standingWord,
} from "@/lib/game/medical/social";
import {
  CHEF_POSTS,
  canPostChefWeek,
  chefExpectationLine,
  chefIdentityOf,
  chefPostContext,
  chefReachLine,
} from "@/lib/game/careers/chefPhone";
import {
  LEGAL_POSTS,
  canPostLawyerWeek,
  lawyerEchoLine,
  lawyerIdentityOf,
  lawyerPostContext,
  lawyerPressureLine,
} from "@/lib/game/careers/lawyerPhone";
import { engagementOf, interestOf } from "@/lib/game/careers/buzz";
import {
  composerEmptyLine,
  phoneOf,
  scrutinyLine,
} from "@/lib/ui/phoneAccess";
import { Avatar } from "../ui/Avatar";
import { EndOfList } from "./EndOfList";
import { PostComposer } from "./PostComposer";
import { packFor } from "@/lib/game/phone/packs";

/**
 * Pulse: your standing, the composer, and the feed.
 *
 * The three metrics are shown as separate figures with a word beside each,
 * because "trust 68" means nothing on its own and because a bare colour would
 * be the only signal otherwise.
 */
export function PulseApp({
  state,
  dispatch,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  /*
   * One screen, three vocabularies. The metrics, the feed and the composer's
   * mechanics are identical between careers; the catalogue of things worth
   * saying, and the words your standing reads as, are each career's own.
   */
  const isChef = state.careerId === "chef";
  const isLawyer = state.careerId === "lawyer";
  /*
   * The four careers whose phone is built from a voice pack. Their posts are
   * a table rather than a hand-written catalogue, and the composer is generic
   * over the context type, so the whole thing drops straight in.
   */
  const pack = packFor(state.careerId);
  const phone = phoneOf(state);
  const social = phone?.social ?? {
    followers: 0,
    trust: 50,
    sentiment: 50,
    scrutiny: 0,
  };
  const feed = phone?.feed ?? [];
  const identity = pack
    ? pack.identity(social)
    : isChef
      ? chefIdentityOf(social)
      : isLawyer
        ? lawyerIdentityOf(social)
        : identityOf(social);

  /* A packed career's posts, gated on the run exactly like the others. */
  const packPosts = pack
    ? pack.posts.filter(
        (x) =>
          x.available(state) &&
          !(x.once && (phone?.postsMade ?? []).includes(x.id)),
      )
    : [];

  /* The doctor's composer inputs. Only computed for a doctor — `med(state)`
     would throw on anyone else's save. */
  const m = isChef || isLawyer || pack ? null : med(state);
  const ctx = m
    ? postContext(m, { week: state.week, panel: state.r.panel })
    : null;
  const doctorPosts =
    m && ctx
      ? POSTS.filter(
          (p) =>
            p.available(ctx) && !(p.once && m.phone.postsMade.includes(p.id)),
        )
      : [];

  /* The chef's. */
  const k = isChef ? kitchen(state) : null;
  const chefCtx = k ? chefPostContext(k, state.week) : null;
  const chefPosts =
    k && chefCtx
      ? CHEF_POSTS.filter(
          (p) =>
            p.available(chefCtx) &&
            !(p.once && (k.phone?.postsMade ?? []).includes(p.id)),
        )
      : [];

  /* And the solicitor's. */
  const p = isLawyer ? practice(state) : null;
  const lawCtx = p ? lawyerPostContext(p, state.week) : null;
  const lawPosts =
    p && lawCtx
      ? LEGAL_POSTS.filter(
          (x) =>
            x.available(lawCtx) &&
            !(x.once && (p.phone?.postsMade ?? []).includes(x.id)),
        )
      : [];

  const canPost = isChef
    ? k !== null && canPostChefWeek(k, state.week)
    : isLawyer
      ? p !== null && canPostLawyerWeek(p, state.week)
      : m !== null && canPostThisWeek(m, state.week);

  /*
   * The third figure is each career's own, and it is always the thing the
   * phone is *for* in that career rather than a second vanity number.
   *
   * A chef's is engagement — how many of the followers are still listening,
   * which falls when you post every week and rises when the room is happy. A
   * solicitor's is leverage: what publicity is currently adding to every
   * settlement offer on the books. Both are read from the simulation, not
   * from the phone.
   */
  const metrics = isChef
    ? [
        {
          label: "Followers",
          value: followerCount(social.followers),
          word: "reach",
        },
        {
          label: "Listening",
          value: followerCount(
            engagementOf(social.followers, social.sentiment, chefCtx?.reach ?? 1),
          ),
          word: "engaged",
        },
        {
          label: "Booking",
          value: k
            ? `+${Math.round((interestOf(k) - 1) * 100)}%`
            : "+0%",
          word: "from what you said",
        },
      ]
    : isLawyer
      ? [
          {
            label: "Followers",
            value: followerCount(social.followers),
            word: "reach",
          },
          {
            label: "Trust",
            value: `${Math.round(social.trust)}`,
            word: standingWord(social.trust),
          },
          {
            label: "Leverage",
            value: `+${Math.round((lawCtx?.pressure ?? 0) * 100)}%`,
            word: "on what they offer",
          },
        ]
      : [
          {
            label: "Followers",
            value: followerCount(social.followers),
            word: "reach",
          },
          {
            label: "Trust",
            value: `${Math.round(social.trust)}`,
            word: standingWord(social.trust),
          },
          {
            label: "Sentiment",
            value: `${Math.round(social.sentiment)}`,
            word: standingWord(social.sentiment),
          },
        ];

  return (
    <div>
      {/* --------------------------------------------------------- profile */}
      <header className="border-b border-rule/60 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <Avatar name="You" handle="@you" you size={44} />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-tight text-ink">
              {identity.label}
            </p>
            <p className="num text-[12.5px] text-ink-faint">@you</p>
          </div>
        </div>
        <p className="mt-2 text-[13.5px] leading-snug text-ink-soft">
          {identity.blurb}
        </p>

        <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-form border border-rule bg-rule-soft">
          {metrics.map((s) => (
            <div key={s.label} className="bg-card px-2.5 py-2">
              <dt className="sign text-[11.5px] text-ink-faint">{s.label}</dt>
              <dd className="num mt-0.5 text-[17px] font-semibold leading-none text-ink">
                {s.value}
              </dd>
              <dd className="mt-1 text-[12px] leading-none text-ink-faint">
                {s.word}
              </dd>
            </div>
          ))}
        </dl>

        {/*
          * The two things a chef's phone costs them, stated where the posting
          * happens rather than on a screen they would have to go and find.
          */}
        {isChef && chefCtx && chefCtx.reach < 0.95 && (
          <p className="mt-2 rounded-form border border-rule px-3 py-1.5 text-[13px] text-ink-soft">
            <span className="sign mr-1.5 text-[11.5px] text-ink-faint">Reach</span>
            {chefReachLine(chefCtx)}
          </p>
        )}
        {isChef && chefCtx && chefExpectationLine(chefCtx) && (
          <p className="mt-2 rounded-form border border-caution/50 bg-caution-tint px-3 py-1.5 text-[13px] text-caution">
            <span className="sign mr-1.5 text-[11.5px]">Expectations</span>
            {chefExpectationLine(chefCtx)}
          </p>
        )}

        {/* And the two a solicitor's buys them, on the same terms: what is
            still working, and for how much longer. */}
        {isLawyer && lawCtx && lawyerPressureLine(lawCtx) && (
          <p className="mt-2 rounded-form border border-rule px-3 py-1.5 text-[13px] text-ink-soft">
            <span className="sign mr-1.5 text-[11.5px] text-ink-faint">
              Leverage
            </span>
            {lawyerPressureLine(lawCtx)}
          </p>
        )}
        {isLawyer && lawCtx && lawyerEchoLine(lawCtx) && (
          <p className="mt-2 rounded-form border border-rule px-3 py-1.5 text-[13px] text-ink-soft">
            <span className="sign mr-1.5 text-[11.5px] text-ink-faint">
              In the door
            </span>
            {lawyerEchoLine(lawCtx)}
          </p>
        )}

        {social.scrutiny >= 25 && (
          <p className="mt-2 rounded-form border border-caution/50 bg-caution-tint px-3 py-1.5 text-[13px] text-caution">
            <span className="sign mr-1.5 text-[11.5px]">Scrutiny</span>
            {scrutinyLine(state.careerId, social.scrutiny)}
          </p>
        )}
      </header>

      {/* Same composer, per-career catalogue. The generic keeps each
          catalogue honest against its own context type. */}
      {pack ? (
        <PostComposer
          posts={packPosts.map((x) => ({ ...x, category: x.category ?? "post" }))}
          context={state}
          canPost={(phone?.lastPostWeek ?? 0) < state.week}
          week={state.week}
          emptyLine={composerEmptyLine(state.careerId)}
          onPublish={(id) => dispatch("post", id)}
        />
      ) : isChef && chefCtx ? (
        <PostComposer
          posts={chefPosts}
          context={chefCtx}
          canPost={canPost}
          week={state.week}
          emptyLine={composerEmptyLine(state.careerId)}
          onPublish={(id) => dispatch("post", id)}
        />
      ) : isLawyer && lawCtx ? (
        <PostComposer
          posts={lawPosts}
          context={lawCtx}
          canPost={canPost}
          week={state.week}
          emptyLine={composerEmptyLine(state.careerId)}
          onPublish={(id) => dispatch("post", id)}
        />
      ) : ctx ? (
        <PostComposer
          posts={doctorPosts}
          context={ctx}
          canPost={canPost}
          week={state.week}
          emptyLine={composerEmptyLine(state.careerId)}
          onPublish={(id) => dispatch("post", id)}
        />
      ) : null}

      {/* ------------------------------------------------------------ feed */}
      {feed.length === 0 ? (
        <p className="px-4 py-8 text-center text-[14px] leading-relaxed text-ink-soft">
          Your feed is empty. Publish something, or wait —{" "}
          {isChef
            ? "the city eats out and talks about it"
            : isLawyer
              ? "the profession talks about who won what"
              : pack
                ? `${pack.world} talks`
                : "the profession talks"}{" "}
          whether or not you join in.
        </p>
      ) : (
        <ul className="divide-y divide-rule/40">
          {feed.map((post) => (
            <li key={post.id} className="px-4 py-3.5">
              <div className="flex items-start gap-2.5">
                <Avatar
                  name={post.author}
                  handle={post.handle}
                  you={post.kind === "player"}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[14.5px] font-semibold text-ink">
                      {post.author}
                    </span>
                    <span className="num text-[12px] text-ink-faint">
                      {post.handle} · wk {post.week}
                    </span>
                    {post.kind === "player" && post.tone === "bad" && (
                      <span className="sign rounded-sm bg-alarm-tint px-1.5 py-0.5 text-[11.5px] text-alarm">
                        Backfired
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-ink-soft">
                    {post.body}
                  </p>
                  <p className="num mt-1.5 text-[12.5px] text-ink-faint">
                    <span aria-hidden>♥</span>{" "}
                    {post.likes.toLocaleString("en-US")}
                    <span className="sr-only"> reactions</span>
                  </p>

                  {post.comments.length > 0 && (
                    <ul className="mt-2 space-y-1.5 border-l border-rule pl-2.5">
                      {post.comments.map((c, i) => (
                        <li key={i} className="text-[13.5px] leading-snug">
                          {/* A comment is one line, so the face is small and
                              sits inline with the name it belongs to. */}
                          <span className="flex items-start gap-2">
                            <Avatar
                              name={c.author}
                              handle={c.handle}
                              size={24}
                              className="mt-0.5"
                            />
                            <span className="min-w-0">
                              <span className="font-semibold text-ink">
                                {c.author}
                              </span>{" "}
                              <span className="text-ink-soft">{c.body}</span>
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
          <li>
            <EndOfList>
              {feed.length >= MAX_FEED
                ? "Older posts have scrolled off"
                : "You have reached the start of your feed"}
            </EndOfList>
          </li>
        </ul>
      )}
    </div>
  );
}
