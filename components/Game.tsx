"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CareerDef,
  GameEventDef,
  LedgerLine,
  RunState,
} from "@/lib/game/types";
import {
  advanceWeek,
  resolveEventChoice,
  runCommand,
  timeSpent,
  type Allocation,
} from "@/lib/game/engine";
import { med, weeklyCosts } from "@/lib/game/careers/doctor";
import {
  loadLastPlan,
  loadTaught,
  saveLastPlan,
  saveTaught,
} from "@/lib/game/save";
import { lessonFor, lessonStatus } from "@/lib/ui/onboarding";
import { glossaryFor } from "@/lib/ui/glossary";
import { LessonCard } from "./onboarding/LessonCard";
import { Glossary } from "./onboarding/Glossary";
import { money } from "@/lib/game/format";
import { SectionBanner } from "./visuals/SectionBanner";
import { titleFor } from "@/lib/game/medical/progression";
import { deriveAlerts } from "@/lib/ui/alerts";
import { nextStep } from "@/lib/ui/guidance";
import { sectionOf, type ScreenId, type SectionId } from "@/lib/ui/navigation";
import { CareerIcon } from "./Icons";
import { MedIcon } from "./visuals/MedIcon";
import { PrimaryNav } from "./nav/PrimaryNav";
import { SectionNav } from "./nav/SectionNav";
import { ScreenHeader } from "./nav/ScreenHeader";
import { whatChanged, type WeekChanges } from "@/lib/ui/whatChanged";

/** Screens whose illustrated banner already states section, title and purpose. */
const BANNERED = new Set<ScreenId>([
  "staff",
  "caseload",
  "career",
  "life",
  "growth",
]);
import { Overview } from "./overview/Overview";
import { WeeklyPlanRail } from "./plan/WeeklyPlanRail";
import {
  WeeklyPlanSheet,
  WeeklyPlanTrigger,
} from "./plan/WeeklyPlanSheet";
import { WeekReview } from "./WeekReview";
import { Outcome } from "./Outcome";
import { BuildPanel } from "./medical/BuildPanel";
import { StaffPanel } from "./medical/StaffPanel";
import { SuppliesPanel } from "./medical/SuppliesPanel";
import { CasesPanel } from "./medical/CasesPanel";
import { CitiesPanel } from "./medical/CitiesPanel";
import { OutbreakPanel } from "./medical/OutbreakPanel";
import { CareerPanel } from "./medical/CareerPanel";
import { StandingPanel } from "./medical/StandingPanel";
import { PeoplePanel } from "./medical/PeoplePanel";
import { TimelinePanel } from "./medical/TimelinePanel";
import { ContractsPanel } from "./medical/ContractsPanel";
import { TeamPanel } from "./medical/TeamPanel";
import { MoneyPanel } from "./medical/MoneyPanel";
import { RivalsPanel } from "./medical/RivalsPanel";
import { CrisisPanel } from "./medical/CrisisPanel";
import { SetbackPanel } from "./medical/SetbackPanel";
import { OperationPanel } from "./careers/OperationPanel";
import { FounderScreens } from "./careers/FounderScreens";
import { PoliticianScreens } from "./careers/PoliticianScreens";
import { ArchitectScreens } from "./careers/ArchitectScreens";
import { EngineerScreens } from "./careers/EngineerScreens";
import { ChefScreens } from "./careers/ChefScreens";
import { LawyerScreens } from "./careers/LawyerScreens";
import { HomeMap } from "./careers/HomeMap";
import { CharacterPanel } from "./medical/CharacterPanel";
import { RetirementDialog } from "./RetirementDialog";
import {
  retire,
  retirementSummary,
  type RetirementSummary,
} from "@/lib/game/retirement";
import { archiveCharacter } from "@/lib/game/save";
import { backgroundOf } from "@/lib/game/backgrounds";
import { netWorth } from "@/lib/game/careers/doctor";
import { cityOf } from "@/lib/game/medical/cities";
import { GrowthPanel } from "./medical/GrowthPanel";
import { LifePanel } from "./medical/LifePanel";
import { phoneOf, unreadTotalIn } from "@/lib/ui/phoneAccess";
import { Phone } from "./phone/Phone";

/** Handset glyph for the shell button. */
function PhoneIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M10.5 5.5h3M11 18.5h2" />
    </svg>
  );
}

interface PendingWeek {
  week: number;
  ledger: LedgerLine[];
  event: { def: GameEventDef; body: string } | null;
  /**
   * What moved this week and why, diffed at commit time.
   *
   * Computed here rather than in the dialog because it needs the state as it
   * was *before* the week resolved, and by the time the dialog renders that
   * state no longer exists anywhere.
   */
  changes: WeekChanges;
}

/**
 * Shell only: routing, the week transaction, and the header. Every screen is
 * its own component so this file stays a map of the game rather than the game
 * itself.
 */
export function Game({
  career,
  state,
  setState,
  onMenu,
  onRestart,
}: {
  career: CareerDef;
  state: RunState;
  setState: (s: RunState) => void;
  onMenu: () => void;
  onRestart: () => void;
}) {
  const [alloc, setAlloc] = useState<Allocation>({});
  /*
   * What was committed last week, so the player can repeat it in one tap.
   *
   * Seeded from its own storage key rather than from the save, because most
   * sessions start by resuming — offering "repeat last week" only after you
   * have already played a week in this sitting would withhold the button
   * exactly when it is most wanted.
   *
   * Read lazily so the server render and the first client render agree; a
   * localStorage read in the initial value would not hydrate.
   */
  const [lastWeek, setLastWeek] = useState<Allocation | null>(null);
  useEffect(() => {
    setLastWeek(loadLastPlan(career.id));
  }, [career.id]);
  const [pending, setPending] = useState<PendingWeek | null>(null);
  const [screen, setScreen] = useState<ScreenId>("overview");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [phoneOpen, setPhoneOpen] = useState(false);
  /* Which app the handset opens on. Screens set it when they "make a call"
     — the larder ringing a supplier, the brigade ringing the agency. */
  const [phoneApp, setPhoneApp] = useState<
    import("./phone/PhoneShell").PhoneApp | undefined
  >(undefined);
  const openPhoneOn = (app?: import("./phone/PhoneShell").PhoneApp) => {
    setPhoneApp(app);
    setPhoneOpen(true);
  };
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  /* The weekly plan sheet — the phone-sized door to the same allocation the
     Week screen edits. Openable from every screen but the Week itself. */
  const [planOpen, setPlanOpen] = useState(false);
  const planButtonRef = useRef<HTMLButtonElement>(null);
  /*
   * Which lessons the player has closed.
   *
   * Read lazily in an effect rather than in the initial value, for the same
   * reason as `lastWeek`: a localStorage read during the first render makes
   * the server and client markup disagree and hydration fails.
   */
  const [taught, setTaught] = useState<string[]>([]);
  useEffect(() => setTaught(loadTaught()), []);
  const teach = (id: string) => {
    const next = [...new Set([...taught, id])];
    setTaught(next);
    saveTaught(next);
  };
  const reopen = (id: string) => {
    const next = taught.filter((x) => x !== id);
    setTaught(next);
    saveTaught(next);
  };
  /* Null until the player asks. Opening it computes a summary and writes
     nothing; only `confirmRetire` touches the run. */
  const [retireSummary, setRetireSummary] = useState<RetirementSummary | null>(
    null,
  );
  const phoneButtonRef = useRef<HTMLButtonElement>(null);
  const glossaryButtonRef = useRef<HTMLButtonElement>(null);
  /**
   * Focus lands here when the weekly review closes. Not the commit button:
   * committing empties the allocation, which disables it, and a disabled
   * element cannot take focus — so focus would fall to <body> and a keyboard
   * user would lose their place entirely.
   */
  const mainRef = useRef<HTMLElement>(null);

  const budget = career.timeBudget(state);
  const spent = timeSpent(career, alloc);
  const briefing = useMemo(
    () => career.briefing(state, alloc),
    [career, state, alloc],
  );
  const alerts = useMemo(() => deriveAlerts(state), [state]);
  /* What a lesson needs to know about the run, beyond the state itself. */
  const teachCtx = useMemo(
    () => ({ allocated: spent, hasReport: state.history.length > 0 }),
    [spent, state.history.length],
  );
  const lesson = useMemo(
    () => lessonFor(screen, state, teachCtx, taught),
    [screen, state, teachCtx, taught],
  );
  const step = useMemo(() => {
    const s = nextStep(state, alloc, spent, budget, state.history.length > 0);
    return s && !dismissed.includes(s.id) ? s : null;
  }, [state, alloc, spent, budget, dismissed]);

  const dispatch = (cmd: string, arg: string) =>
    setState(runCommand(career, state, cmd, arg));

  const commit = () => {
    const result = advanceWeek(career, state, alloc);
    setState(result.state);
    setLastWeek(alloc);
    saveLastPlan(career.id, alloc);
    setAlloc({});
    setPending({
      week: state.week,
      ledger: result.ledger,
      event: result.event,
      changes: whatChanged(state, result.state, result.ledger),
    });
  };

  /**
   * Open the retirement summary. Read-only by construction — `retirementSummary`
   * computes from state and returns; nothing here mutates the run.
   */
  const openRetirement = () => {
    if (!m) return;
    setRetireSummary(
      retirementSummary(state, {
        careerLabel: career.label,
        name: titleFor(m),
        backgroundLabel: backgroundOf(state)?.label ?? "No background",
        path: m.qualifications.length > 1 ? "Specialist" : null,
        netWorth: netWorth(state),
        cities: m.cities.map((c) => cityOf(c).name),
        businesses: m.facilities.length,
      }),
    );
  };

  const confirmRetire = (note: string) => {
    if (!retireSummary) return;
    const next = runCommand(career, state, "noop", "");
    const archived = retire(next, retireSummary, note);
    archiveCharacter(archived);
    setRetireSummary(null);
    setState(next);
  };

  const resolveChoice = (index: number) => {
    if (!pending?.event) return;
    setState(resolveEventChoice(career, state, pending.event.def, index));
    setPending(null);
  };

  // The week review always plays out first — a run that ends on a lawsuit
  // should show you the lawsuit before it shows you the obituary.
  if (state.outcome && !pending) {
    return (
      <Outcome
        career={career}
        state={state}
        onRestart={onRestart}
        onMenu={onMenu}
      />
    );
  }

  const m = state.careerId === "doctor" ? med(state) : null;
  const activeSection = sectionOf(screen, state.careerId).id;
  /* The phone is career-aware now: any career that carries one gets the
     button, the badge and the handset. One without one gets nothing, which
     is absence rather than breakage. */
  const phone = phoneOf(state);
  const unread = phone ? unreadTotalIn(phone) : 0;
  const hasGlossary = glossaryFor(state.careerId).length > 0;

  // Route alerts to the destination that fixes them, so a badge on a nav
  // item always corresponds to something actionable inside it.
  const badges: Partial<
    Record<
      SectionId,
      { severity: "critical" | "warning" | "info"; count: number }
    >
  > = {};
  for (const alert of alerts) {
    const target = sectionOf(alert.destination, state.careerId).id;
    const existing = badges[target];
    if (!existing) {
      badges[target] = { severity: alert.severity, count: 1 };
    } else {
      existing.count += 1;
      if (alert.severity === "critical") existing.severity = "critical";
    }
  }

  return (
    /* Overview carries both the nav bar and the sticky commit bar, so it
       needs more bottom clearance than the other screens. */
    /*
     * The map screen gets a wider container than the rest of the game. Every
     * other screen is a column of text and controls that reads badly past
     * ~1150px; the map is the one thing that wants all the room it can get,
     * and side-by-side with the intelligence panel inside a 6xl column left
     * it about 700px wide — small enough that the cities crowded.
     */
    <div
      /* The career accent: globals.css keys --accent off this attribute, and
         the `clinical` token reads it, so everything active, owned or
         pressable takes this career's colour from here down. */
      data-career={state.careerId}
      className={`mx-auto px-3 pt-3 sm:px-6 sm:pt-6 md:pb-10 ${
        screen === "cities" ? "max-w-[1680px]" : "max-w-6xl"
      } ${screen === "overview" ? "pb-36" : "pb-24"}`}
    >
      {retireSummary && (
        <RetirementDialog
          summary={retireSummary}
          state={state}
          onCancel={() => setRetireSummary(null)}
          onConfirm={confirmRetire}
        />
      )}

      {/* ------------------------------------------------------------ header */}
      <header className="mb-3 flex items-center gap-3">
        <button
          onClick={onMenu}
          className="flex min-h-[44px] items-center gap-2.5 rounded-form px-1 text-left transition hover:opacity-75"
        >
          <span className="text-clinical">
            <CareerIcon name={career.icon} className="h-7 w-7" />
          </span>
          <span className="min-w-0">
            <span className="display block truncate text-[15px] leading-tight">
              {career.label}
            </span>
            {m && (
              <span className="num block truncate text-[12px] text-clinical">
                {titleFor(m)}
              </span>
            )}
          </span>
          <span className="sr-only">Back to career select</span>
        </button>

        <div className="ml-auto hidden lg:block">
          <PrimaryNav
            active={activeSection}
            careerId={state.careerId}
            onNavigate={setScreen}
            badges={badges}
          />
        </div>

        {/* Every career with a vocabulary of its own gets the control that
            explains it. The gate used to be `m &&`, which is why two of the
            three careers had no way to look a word up. */}
        {hasGlossary && (
          <button
            ref={glossaryButtonRef}
            onClick={() => setGlossaryOpen(true)}
            aria-haspopup="dialog"
            className="ml-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-form border border-rule bg-card text-ink-soft transition hover:border-clinical hover:text-clinical lg:ml-3"
          >
            <MedIcon name="certificate" className="h-5 w-5" />
            <span className="sr-only">What the words mean</span>
          </button>
        )}

        {phone && (
          <button
            ref={phoneButtonRef}
            onClick={() => openPhoneOn()}
            aria-haspopup="dialog"
            className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-form border border-rule bg-card text-ink-soft transition hover:border-clinical hover:text-clinical"
          >
            <PhoneIcon />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-alarm px-1 text-[12px] font-bold leading-none text-[#2A0808]">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
            <span className="sr-only">
              {unread > 0 ? `Open phone — ${unread} unread` : "Open phone"}
            </span>
          </button>
        )}
      </header>

      {screen !== "overview" && (
        <SectionNav
          active={screen}
          careerId={state.careerId}
          onNavigate={setScreen}
        />
      )}

      {/*
        * Phase 4: the plan rides beside the decision on desktop. Every screen
        * except two gets the two-column grid — the Week already IS the plan,
        * and the map wants the whole stage (its right rail becomes city
        * intelligence when the World shell lands).
        */}
      <div
        className={
          screen !== "overview" && screen !== "cities"
            ? "lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6"
            : undefined
        }
      >
      <main ref={mainRef} tabIndex={-1} className="min-w-0 outline-none">
        {/*
         * A crisis outranks the screen you happen to be on.
         *
         * Above the switch rather than inside it: a multi-week crisis is the
         * thing that most needs a decision, and a system the player has to go
         * looking for is one they will leave until it escalates — which is
         * precisely the failure mode the escalation rules punish.
         */}
        {/* A setback outranks even a crisis: it is the state most likely to
            be mistaken for a game over, so the way out is the first thing on
            screen. */}
        {(state.setbacks ?? []).length > 0 && (
          <div className="mb-4">
            <SetbackPanel state={state} dispatch={dispatch} />
          </div>
        )}
        {(state.crises ?? []).length > 0 && (
          <div className="mb-4">
            <CrisisPanel state={state} dispatch={dispatch} />
          </div>
        )}
        {/*
         * The lesson for this screen, above everything it describes.
         *
         * Below the setback and crisis panels though — a player being taught
         * what a time block is while their licence is suspended has a more
         * pressing problem than vocabulary.
         */}
        {lesson && (
          <div className="mb-4">
            <LessonCard
              lesson={lesson}
              onDismiss={() => teach(lesson.id)}
              onNavigate={setScreen}
            />
          </div>
        )}
        {screen === "overview" && (
          <Overview
            career={career}
            state={state}
            alloc={alloc}
            budget={budget}
            spent={spent}
            briefing={briefing}
            alerts={alerts}
            step={step}
            onAllocate={setAlloc}
            lastWeek={lastWeek}
            onCommit={commit}
            onNavigate={setScreen}
            onDismissStep={(id) => setDismissed((d) => [...d, id])}
            onPayLoan={() => dispatch("payLoan", "")}
          />
        )}

        {/*
         * The one screen a career that is not the Physician has.
         *
         * Placed here for two reasons found the hard way. It must sit outside
         * the `{m && …}` gate below, because everything in there reads medical
         * state that is null for a Chef — inside it, the panel rendered
         * nothing at all. And it must sit outside the header, because the
         * career name is itself a <button>: nested inside it, every "buy"
         * control was a button within a button, which React flagged as a
         * hydration error and which sent the first click to the back-to-menu
         * handler instead of the kitchen.
         */}
        {screen === "operation" && (
          <OperationPanel state={state} onCommand={dispatch} />
        )}
        {/* The Founder's three, on the same terms as the two careers below:
            venture state rather than medical state, and outside the header's
            button. */}
        <FounderScreens screen={screen} state={state} onCommand={dispatch} />
        <PoliticianScreens screen={screen} state={state} onCommand={dispatch} />
        <ArchitectScreens screen={screen} state={state} onCommand={dispatch} />
        <EngineerScreens screen={screen} state={state} onCommand={dispatch} />
        {/* The Chef's five screens, for the same two reasons: they read
            kitchen state, not medical state, and they must not be nested
            inside the header's button. */}
        <ChefScreens
          screen={screen}
          state={state}
          onCommand={dispatch}
          onCall={openPhoneOn}
        />
        {/* And the Solicitor's four, on the same terms — practice state, and
            outside the header's button. */}
        <LawyerScreens
          screen={screen}
          state={state}
          onCommand={dispatch}
          onCall={openPhoneOn}
        />
        {screen === "home" && <HomeMap state={state} />}

        {m && (
          <>
            {/*
             * One banner at the entrance to a screen, never per subsection.
             * Only screens with registered artwork get one; the rest keep
             * their existing headers, which is why this is a lookup and not a
             * wrapper around every panel.
             */}
            {screen === "staff" && (
              <SectionBanner
                section="staff"
                kicker="Work"
                title="Your people"
                status={`${m.staff.length} on the payroll · ${money(weeklyCosts(state))}/wk in fixed costs`}
              />
            )}
            {screen === "caseload" && (
              <SectionBanner
                section="caseload"
                kicker="Work"
                title="The caseload"
                status={`${m.lastCases.reduce((n, c) => n + c.arrived, 0)} cases arrived last week`}
              />
            )}
            {screen === "career" && (
              <SectionBanner
                section="career"
                kicker="Career"
                title="Your credentials"
                status={`${m.qualifications.length} held · ${Math.round(state.r.cpd)} learning points banked`}
              />
            )}
            {screen === "life" && (
              <SectionBanner
                section="life"
                kicker="Life"
                title="What it is all for"
                status={`${m.lifestyle.length} thing${m.lifestyle.length === 1 ? "" : "s"} bought · burnout ${Math.round(state.r.burnout)}`}
              />
            )}
            {screen === "growth" && (
              <SectionBanner
                section="growth"
                kicker="World"
                title="Growth"
                status={`${m.campaigns.length} campaign${m.campaigns.length === 1 ? "" : "s"} running`}
              />
            )}

            {/*
             * Where you are, what is true here, and the one thing worth doing
             * about it. Computed per screen from the actual run — see
             * `lib/ui/orientation.ts`. The five bannered screens above already
             * carry a title and purpose, so those get the status alone.
             */}
            {screen !== "overview" && (
              <ScreenHeader
                state={state}
                screen={screen}
                onNavigate={setScreen}
                compact={BANNERED.has(screen)}
              />
            )}

            {screen === "build" && (
              <BuildPanel state={state} dispatch={dispatch} />
            )}
            {screen === "staff" && (
              <StaffPanel state={state} dispatch={dispatch} />
            )}
            {screen === "supplies" && (
              <SuppliesPanel state={state} dispatch={dispatch} />
            )}
            {screen === "caseload" && (
              <CasesPanel
                state={state}
                dispatch={dispatch}
                onNavigate={setScreen}
                clinicBlocks={alloc.clinic ?? 0}
              />
            )}
            {screen === "cities" && (
              <CitiesPanel state={state} dispatch={dispatch} />
            )}
            {screen === "outbreaks" && (
              <OutbreakPanel
                state={state}
                dispatch={dispatch}
                onNavigate={setScreen}
              />
            )}
            {screen === "growth" && (
              <GrowthPanel state={state} dispatch={dispatch} />
            )}
            {screen === "career" && (
              <CareerPanel state={state} dispatch={dispatch} />
            )}
            {screen === "contracts" && (
              <ContractsPanel
                state={state}
                dispatch={dispatch}
                onNavigate={setScreen}
              />
            )}
            {screen === "team" && (
              <TeamPanel
                state={state}
                dispatch={dispatch}
                onNavigate={setScreen}
              />
            )}
            {screen === "money" && (
              <MoneyPanel
                state={state}
                dispatch={dispatch}
                onNavigate={setScreen}
              />
            )}
            {screen === "rivals" && <RivalsPanel state={state} />}
            {screen === "character" && (
              <CharacterPanel
                state={state}
                dispatch={dispatch}
                onRetire={openRetirement}
              />
            )}
            {screen === "standing" && (
              <StandingPanel state={state} onNavigate={setScreen} />
            )}
            {screen === "people" && <PeoplePanel state={state} />}
            {screen === "timeline" && <TimelinePanel state={state} />}
            {screen === "life" && (
              <LifePanel
                state={state}
                dispatch={dispatch}
                onNavigate={setScreen}
              />
            )}
          </>
        )}
      </main>

      {screen !== "overview" && screen !== "cities" && (
        <WeeklyPlanRail
          career={career}
          state={state}
          alloc={alloc}
          budget={budget}
          spent={spent}
          alerts={alerts}
          onAllocate={setAlloc}
          onCommit={commit}
          onNavigate={setScreen}
        />
      )}
      </div>

      {/* Mobile: the week plan one tap away on every screen but the Week,
          which already ends in the sticky commit bar. */}
      {screen !== "overview" && (
        <WeeklyPlanTrigger
          state={state}
          spent={spent}
          budget={budget}
          buttonRef={planButtonRef}
          onOpen={() => setPlanOpen(true)}
        />
      )}
      {planOpen && (
        <WeeklyPlanSheet
          career={career}
          state={state}
          alloc={alloc}
          budget={budget}
          spent={spent}
          lastWeek={lastWeek}
          onAllocate={setAlloc}
          onCommit={commit}
          onClose={() => setPlanOpen(false)}
          returnFocusTo={planButtonRef}
        />
      )}

      {/* Mobile: the same five destinations, within thumb reach. */}
      <div className="lg:hidden">
        <PrimaryNav
          active={activeSection}
          careerId={state.careerId}
          onNavigate={setScreen}
          badges={badges}
        />
      </div>

      {phoneOpen && phone && (
        <Phone
          key={phoneApp ?? "default"}
          state={state}
          dispatch={dispatch}
          initialApp={phoneApp}
          onClose={() => {
            setPhoneOpen(false);
            setPhoneApp(undefined);
          }}
          returnFocusTo={phoneButtonRef}
        />
      )}

      {glossaryOpen && (
        <Glossary
          careerId={state.careerId}
          lessons={lessonStatus(state, teachCtx, taught)}
          onReopen={reopen}
          onClose={() => setGlossaryOpen(false)}
          onNavigate={setScreen}
          returnFocusTo={glossaryButtonRef}
        />
      )}

      {pending && (
        <WeekReview
          week={pending.week}
          ledger={pending.ledger}
          event={pending.event}
          changes={pending.changes}
          onNavigate={setScreen}
          state={state}
          onChoose={resolveChoice}
          onClose={() => setPending(null)}
          returnFocusTo={mainRef}
        />
      )}
    </div>
  );
}
