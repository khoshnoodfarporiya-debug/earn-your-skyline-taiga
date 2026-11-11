import type { RunState } from "../game/types";
import type { PhoneState } from "../game/medical/types";
import { med } from "../game/careers/doctor";
import { kitchen } from "../game/careers/chef";
import { practice } from "../game/careers/lawyer";
import { packFor, packedPhoneOf } from "../game/phone/packs";

/**
 * ONE DOOR TO EVERY CAREER'S PHONE
 *
 * The handset components used to call `med(state)` directly, which is why the
 * phone was a Physician-only feature: the door was medical even though the
 * rooms behind it never were. This module is the career-aware door.
 *
 * A career without a phone returns null and the button never renders —
 * absence, not breakage. No career is in that state today; the next one to be
 * written will be, and it will be playable before it has a handset.
 */
export function phoneOf(state: RunState): PhoneState | null {
  if (state.careerId === "doctor") return med(state).phone;
  if (state.careerId === "chef") return kitchen(state).phone ?? null;
  if (state.careerId === "lawyer") return practice(state).phone ?? null;
  /* The four careers whose phones are built from a voice pack rather than
     hand-written. Same shape, same door. */
  if (packFor(state.careerId)) return packedPhoneOf(state) ?? null;
  return null;
}

/* Unread counts, on the shape rather than on a career. */
export const unreadMessagesIn = (p: PhoneState): number =>
  p.messages.filter((x) => !x.read).length;

export const unreadNewsIn = (p: PhoneState): number =>
  p.news.filter((x) => !x.read).length;

export const unreadTotalIn = (p: PhoneState): number =>
  unreadMessagesIn(p) + unreadNewsIn(p);

/**
 * The scrutiny warning, in the career's own terms.
 *
 * The number means a different thing in each life: to a doctor it feeds
 * malpractice risk; to a chef it amplifies how far a bad night travels. The
 * same sentence for both would be false for one of them.
 */
export function scrutinyLine(careerId: string, scrutiny: number): string {
  const n = Math.round(scrutiny);
  if (packFor(careerId)) {
    return `${n} — you are being watched, and a bad week now travels further than it used to.`;
  }
  if (careerId === "chef") {
    return `${n} — you are being watched. A bad night now travels further than it used to.`;
  }
  if (careerId === "lawyer") {
    return `${n} — you are being read. Anything you say about a live matter will be read by somebody looking for a reason.`;
  }
  return `${n} — you are being watched, and it is adding to your malpractice risk each week.`;
}

/** The composer's empty-state advice, per career. */
export function composerEmptyLine(careerId: string): string {
  if (packFor(careerId)) {
    return "Nothing worth saying yet. Do something the world would notice and there will be.";
  }
  if (careerId === "chef") {
    return "Nothing worth saying yet. Run a good service, get to know a supplier, or take somebody on and there will be.";
  }
  if (careerId === "lawyer") {
    return "Nothing worth saying yet. Take an instruction, win one, or take somebody on and there will be.";
  }
  return "Nothing worth saying yet. Open a department, hire someone, or earn a credential and there will be.";
}

/**
 * What to call the person who sent a message, in the career's own words.
 *
 * The roles themselves are structural — `staff`, `rival`, `peer` mean the
 * same *kind* of relationship in any career — but their names are not. A
 * chef's mentor tagged "Colleague" and their events booker tagged "Recruiter"
 * both read as somebody else's job, which is exactly the leak this file
 * exists to stop.
 */
const CHEF_ROLES: Record<string, string> = {
  staff: "Your brigade",
  recruiter: "Bookings",
  journalist: "Critic",
  regulator: "Inspector",
  rival: "Rival kitchen",
  peer: "Mentor",
};

const LAWYER_ROLES: Record<string, string> = {
  staff: "Your firm",
  recruiter: "Legal recruitment",
  journalist: "Legal press",
  regulator: "The regulator",
  rival: "The other side",
  peer: "Senior solicitor",
};

const DEFAULT_ROLES: Record<string, string> = {
  staff: "Your team",
  recruiter: "Recruiter",
  journalist: "Press",
  regulator: "Regulator",
  rival: "Competitor",
  peer: "Colleague",
};

export function roleLabel(careerId: string, role: string): string {
  const table =
    careerId === "chef"
      ? CHEF_ROLES
      : careerId === "lawyer"
        ? LAWYER_ROLES
        : DEFAULT_ROLES;
  return table[role] ?? DEFAULT_ROLES[role] ?? role;
}
