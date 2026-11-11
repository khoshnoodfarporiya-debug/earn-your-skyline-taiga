import type {
  Condition,
  Equipment,
  FacilityType,
  Specialty,
  SpecialtyId,
  StaffRole,
} from "./types";

/**
 * The content layer. Everything here is data, so the sim stays small and
 * adding medicine is a matter of adding rows rather than writing code.
 */

// ------------------------------------------------------------- specialties

export const SPECIALTIES: Specialty[] = [
  {
    id: "general",
    label: "General Practice",
    blurb: "The front door. Low fees, endless volume, and where reputation is really built.",
    unlockCost: 0,
    upkeep: 0,
    prestige: 1,
  },
  {
    id: "paediatrics",
    label: "Paediatrics",
    blurb: "Children's medicine. Parents talk to each other, so outcomes travel fast.",
    unlockCost: 9_000,
    upkeep: 320,
    prestige: 1.6,
  },
  {
    id: "dermatology",
    label: "Dermatology",
    blurb: "High volume, low acuity, unusually good margins. The reliable earner.",
    unlockCost: 12_000,
    upkeep: 300,
    prestige: 1.2,
  },
  {
    id: "psychiatry",
    label: "Psychiatry",
    blurb: "Long appointments, modest fees, and patients who stay with you for years.",
    unlockCost: 15_000,
    upkeep: 380,
    prestige: 1.5,
  },
  {
    id: "radiology",
    label: "Radiology",
    blurb: "Diagnostics as a service. Pure equipment leverage — no imaging, no department.",
    unlockCost: 22_000,
    upkeep: 620,
    prestige: 1.3,
  },
  {
    id: "neurology",
    label: "Neurology",
    blurb: "Complex, slow, and unforgiving of a thin skill bench.",
    unlockCost: 48_000,
    upkeep: 780,
    prestige: 2.2,
  },
  {
    id: "orthopaedics",
    label: "Orthopaedics",
    blurb: "Bones and joints. Scales beautifully once you have a theatre.",
    unlockCost: 52_000,
    upkeep: 840,
    prestige: 2,
  },
  {
    id: "cardiology",
    label: "Cardiology",
    blurb: "The heart unit. Expensive to run, and the cases that make a hospital's name.",
    unlockCost: 66_000,
    upkeep: 1_150,
    prestige: 2.4,
  },
  {
    id: "maternity",
    label: "Maternity",
    blurb: "Round-the-clock by nature. Nothing builds community standing faster.",
    unlockCost: 72_000,
    upkeep: 1_300,
    prestige: 2.5,
  },
  {
    id: "emergency",
    label: "Emergency",
    blurb: "You do not choose what arrives. Brutal on capacity, superb for reputation.",
    unlockCost: 88_000,
    upkeep: 1_800,
    prestige: 3,
  },
  {
    id: "surgery",
    label: "General Surgery",
    blurb: "The highest fees in the building, and the highest cost of getting it wrong.",
    unlockCost: 95_000,
    upkeep: 1_600,
    prestige: 2.8,
  },
  {
    id: "oncology",
    label: "Oncology",
    blurb: "The hardest medicine you can practise. Long courses, enormous stakes.",
    unlockCost: 120_000,
    upkeep: 2_200,
    prestige: 3.4,
  },
];

// --------------------------------------------------------------- equipment

export const EQUIPMENT: Equipment[] = [
  {
    id: "ecg",
    label: "ECG machine",
    blurb: "Cheap, fast, and the gateway to any cardiac work at all.",
    cost: 6_500,
    upkeep: 90,
    needsTechnician: false,
    qualityBonus: 0.06,
  },
  {
    id: "lab",
    label: "Pathology lab",
    blurb: "Bloods and biopsies in-house. Half of medicine needs a number first.",
    cost: 24_000,
    upkeep: 460,
    needsTechnician: true,
    qualityBonus: 0.08,
  },
  {
    id: "ultrasound",
    label: "Ultrasound suite",
    blurb: "Safe, quick imaging. Indispensable in maternity and abdominal work.",
    cost: 32_000,
    upkeep: 380,
    needsTechnician: true,
    qualityBonus: 0.08,
  },
  {
    id: "xray",
    label: "X-ray room",
    blurb: "The workhorse. No fracture clinic exists without one.",
    cost: 45_000,
    upkeep: 620,
    needsTechnician: true,
    qualityBonus: 0.09,
  },
  {
    id: "pharmacy",
    label: "Dispensing pharmacy",
    blurb: "Controlled drugs on site. Required for any course-based treatment.",
    cost: 38_000,
    upkeep: 700,
    needsTechnician: false,
    qualityBonus: 0.05,
  },
  {
    id: "physio",
    label: "Rehabilitation suite",
    blurb: "Recovery after the surgery is what patients actually remember.",
    cost: 41_000,
    upkeep: 640,
    needsTechnician: false,
    qualityBonus: 0.07,
  },
  {
    id: "endoscopy",
    label: "Endoscopy unit",
    blurb: "Look inside without opening anyone up.",
    cost: 68_000,
    upkeep: 880,
    needsTechnician: true,
    qualityBonus: 0.1,
  },
  {
    id: "theatre",
    label: "Operating theatre",
    blurb: "The single biggest unlock in the game. Everything surgical runs through it.",
    cost: 145_000,
    upkeep: 2_400,
    needsTechnician: true,
    qualityBonus: 0.12,
  },
  {
    id: "ct",
    label: "CT scanner",
    blurb: "Fast cross-sections. The difference between guessing and knowing in a crisis.",
    cost: 210_000,
    upkeep: 3_100,
    needsTechnician: true,
    qualityBonus: 0.13,
  },
  {
    id: "dialysis",
    label: "Dialysis unit",
    blurb: "Recurring, predictable, unglamorous revenue.",
    cost: 96_000,
    upkeep: 1_500,
    needsTechnician: true,
    qualityBonus: 0.09,
  },
  {
    id: "icu",
    label: "Intensive care beds",
    blurb: "Where the sickest patients survive or don't. Nothing critical runs without it.",
    cost: 260_000,
    upkeep: 4_800,
    needsTechnician: false,
    qualityBonus: 0.15,
  },
  {
    id: "mri",
    label: "MRI scanner",
    blurb: "The most expensive box you will ever buy, and it pays for itself.",
    cost: 340_000,
    upkeep: 4_200,
    needsTechnician: true,
    qualityBonus: 0.15,
  },
];

// -------------------------------------------------------------- facilities

export const FACILITY_TYPES: FacilityType[] = [
  {
    id: "room",
    label: "Rented exam room",
    blurb: "One room above a pharmacy. Where everyone starts.",
    cost: 9_000,
    upkeep: 420,
    slots: 34,
    departmentSlots: 1,
  },
  {
    id: "clinic",
    label: "Community clinic",
    blurb: "A proper front desk, a waiting room, and space for a small team.",
    cost: 34_000,
    upkeep: 1_100,
    slots: 110,
    departmentSlots: 3,
  },
  {
    id: "centre",
    label: "Medical centre",
    blurb: "Multi-department practice with real diagnostic space.",
    cost: 185_000,
    upkeep: 4_200,
    slots: 280,
    departmentSlots: 6,
  },
  {
    id: "hospital",
    label: "Regional hospital",
    blurb: "Wards, theatres, an emergency entrance. The end state.",
    cost: 520_000,
    upkeep: 11_000,
    slots: 620,
    departmentSlots: 12,
  },
];

// ------------------------------------------------------------------- staff

export const STAFF_ROLES: StaffRole[] = [
  {
    id: "gp",
    label: "General practitioner",
    blurb: "Sees anything and everything. The backbone of your treatment capacity.",
    hireCost: 6_000,
    salary: 2_100,
    units: 26,
    specialised: false,
  },
  {
    id: "nurse",
    label: "Nurse",
    blurb: "Triage, dressings, follow-ups. Multiplies what every clinician can get through.",
    hireCost: 2_200,
    salary: 900,
    units: 10,
    specialised: false,
  },
  {
    id: "specialist",
    label: "Specialist consultant",
    blurb: "Hired into one department. Without one, that department cannot treat.",
    hireCost: 14_000,
    salary: 3_800,
    units: 22,
    specialised: true,
  },
  {
    id: "surgeon",
    label: "Surgeon",
    blurb: "Operates. Useless without a theatre, decisive with one.",
    hireCost: 22_000,
    salary: 5_200,
    units: 20,
    specialised: true,
  },
  {
    id: "technician",
    label: "Technician",
    blurb: "Runs the imaging and the lab. Machines without technicians are ornaments.",
    hireCost: 3_400,
    salary: 1_250,
    units: 6,
    specialised: false,
  },
  {
    id: "admin",
    label: "Administrator",
    blurb: "Billing, coding, compliance. Quietly the best value hire in the building.",
    hireCost: 2_600,
    salary: 1_100,
    units: 0,
    specialised: false,
  },
  {
    id: "paramedic",
    label: "Paramedic",
    blurb:
      "Rides the ambulance and starts the treatment on the way in. Every vehicle needs a crew before it is anything but a parked expense.",
    hireCost: 3_000,
    salary: 1_300,
    /* Fewer units than a GP: most of the week is spent travelling, and the
       care given on the road is real but narrow. */
    units: 8,
    specialised: false,
  },
  {
    id: "comms",
    label: "Communications manager",
    blurb:
      "Handles the public side: drafts what you publish, checks it before it goes out, and answers the press so you do not have to.",
    hireCost: 5_200,
    salary: 1_450,
    units: 0,
    specialised: false,
  },
];

// -------------------------------------------------------------- conditions

const c = (
  id: string,
  label: string,
  specialty: Condition["specialty"],
  severity: Condition["severity"],
  prevalence: number,
  fee: number,
  units: number,
  minSkill: number,
  equipment?: Condition["equipment"],
): Condition => ({
  id,
  label,
  specialty,
  severity,
  prevalence,
  fee,
  units,
  minSkill,
  equipment,
});

export const CONDITIONS: Condition[] = [
  // General practice. Deliberately almost all machine-free: a GP diagnoses
  // this much clinically, and gating it would leave a starting doctor unable
  // to practise the only medicine they have a department for.
  c("common_cold", "Upper respiratory infection", "general", 1, 90, 150, 1, 20),
  c("hypertension", "Hypertension review", "general", 2, 70, 220, 1, 30),
  c("uti", "Urinary tract infection", "general", 1, 52, 185, 1, 25),
  c("back_pain", "Mechanical back pain", "general", 2, 56, 235, 1, 30),
  c("diabetes", "Diabetes management", "general", 2, 60, 280, 2, 35),
  c("minor_injury", "Minor injury review", "general", 1, 44, 195, 1, 26),
  c("anaemia", "Anaemia workup", "general", 2, 34, 310, 2, 36, ["lab"]),
  c("thyroid", "Thyroid disorder", "general", 2, 26, 330, 2, 40, ["lab"]),

  // Paediatrics
  c("vaccination", "Childhood immunisation", "paediatrics", 1, 62, 90, 1, 20),
  c("otitis", "Acute otitis media", "paediatrics", 1, 46, 135, 1, 26),
  c("child_asthma", "Childhood asthma", "paediatrics", 2, 40, 245, 2, 40),
  c("bronchiolitis", "Bronchiolitis", "paediatrics", 3, 20, 660, 3, 52, ["xray"]),
  c("febrile_seizure", "Febrile seizure", "paediatrics", 3, 12, 820, 3, 56),

  // Dermatology
  c("eczema", "Eczema", "dermatology", 1, 46, 165, 1, 28),
  c("psoriasis", "Psoriasis", "dermatology", 2, 26, 270, 2, 42),
  c("mole_check", "Lesion assessment", "dermatology", 1, 38, 195, 1, 34),
  c("skin_excision", "Skin cancer excision", "dermatology", 3, 16, 1_500, 3, 58, ["theatre"]),

  // Psychiatry
  c("anxiety", "Anxiety and depression", "psychiatry", 2, 56, 250, 2, 40),
  c("bipolar", "Bipolar management", "psychiatry", 3, 18, 640, 3, 55, ["pharmacy"]),
  c("psychosis", "Acute psychosis", "psychiatry", 4, 9, 1_950, 5, 66, ["pharmacy"]),

  // Radiology
  c("plain_film", "Plain film reporting", "radiology", 1, 56, 330, 1, 35, ["xray"]),
  c("ct_report", "CT reporting", "radiology", 2, 30, 660, 2, 50, ["ct"]),
  c("mri_report", "MRI reporting", "radiology", 2, 22, 950, 2, 56, ["mri"]),

  // Neurology
  c("migraine", "Migraine", "neurology", 2, 40, 290, 2, 40),
  c("epilepsy", "Epilepsy management", "neurology", 3, 18, 970, 3, 58, ["pharmacy"]),
  c("parkinsons", "Parkinson's disease", "neurology", 3, 14, 740, 3, 60),
  c("stroke", "Acute stroke", "neurology", 5, 11, 7_800, 9, 78, ["ct", "icu"]),

  // Orthopaedics
  c("osteoarthritis", "Osteoarthritis", "orthopaedics", 2, 45, 350, 2, 40),
  c("fracture_simple", "Simple fracture", "orthopaedics", 2, 40, 495, 2, 42, ["xray"]),
  c("fracture_complex", "Complex fracture", "orthopaedics", 3, 15, 2_300, 5, 62, ["xray", "theatre"]),
  c("acl_tear", "ACL reconstruction", "orthopaedics", 3, 12, 3_500, 6, 66, ["mri", "theatre"]),
  c("hip_replacement", "Hip replacement", "orthopaedics", 4, 10, 9_800, 10, 72, ["theatre", "xray", "physio"]),

  // Cardiology
  c("arrhythmia", "Arrhythmia", "cardiology", 3, 25, 980, 3, 56, ["ecg"]),
  c("angina", "Angina", "cardiology", 3, 22, 1_250, 3, 58, ["ecg"]),
  c("heart_failure", "Heart failure", "cardiology", 4, 15, 2_500, 5, 66, ["ecg", "ultrasound"]),
  c("valve_disease", "Valve disease", "cardiology", 4, 9, 3_200, 6, 70, ["ultrasound", "theatre"]),
  c("mi", "Myocardial infarction", "cardiology", 5, 8, 7_000, 8, 76, ["ecg", "icu"]),

  // Maternity
  c("antenatal", "Antenatal check", "maternity", 1, 50, 185, 1, 30, ["ultrasound"]),
  c("delivery", "Normal delivery", "maternity", 3, 26, 3_300, 6, 58),
  c("pre_eclampsia", "Pre-eclampsia", "maternity", 4, 8, 2_700, 5, 68, ["lab"]),
  c("caesarean", "Caesarean section", "maternity", 4, 12, 7_600, 8, 70, ["theatre"]),

  // Emergency
  c("laceration", "Laceration repair", "emergency", 2, 42, 270, 1, 30),
  c("anaphylaxis", "Anaphylaxis", "emergency", 4, 10, 1_450, 3, 60),
  c("poisoning", "Poisoning", "emergency", 3, 12, 1_150, 3, 56, ["lab"]),
  c("sepsis", "Sepsis", "emergency", 5, 9, 5_800, 8, 75, ["lab", "icu"]),
  c("major_trauma", "Major trauma", "emergency", 5, 7, 8_400, 10, 78, ["theatre", "icu", "ct"]),

  // Surgery
  c("hernia", "Hernia repair", "surgery", 3, 20, 3_700, 5, 60, ["theatre"]),
  c("appendectomy", "Appendectomy", "surgery", 3, 18, 4_300, 6, 62, ["theatre"]),
  c("gallbladder", "Cholecystectomy", "surgery", 3, 15, 4_900, 6, 64, ["theatre", "ultrasound"]),
  c("endoscopy_proc", "Diagnostic endoscopy", "surgery", 2, 24, 1_350, 3, 52, ["endoscopy"]),
  c("bowel_resection", "Bowel resection", "surgery", 5, 6, 14_800, 12, 80, ["theatre", "icu"]),

  // Oncology
  c("cancer_screening", "Cancer screening", "oncology", 2, 35, 390, 2, 45, ["lab"]),
  c("palliative", "Palliative care", "oncology", 3, 18, 910, 4, 55, ["pharmacy"]),
  c("chemotherapy", "Chemotherapy cycle", "oncology", 4, 14, 5_300, 6, 70, ["lab", "pharmacy"]),
  c("tumour_resection", "Tumour resection", "oncology", 5, 6, 17_000, 12, 82, ["theatre", "ct", "icu"]),
];

// ------------------------------------------------------------------ lookup

/**
 * Department colours, borrowed from hospital wayfinding. Colour means one
 * thing throughout the interface — which medicine this belongs to — so it can
 * be read on a department card, a staff member, or a row of the ward list
 * without a legend.
 */
export const DEPARTMENT_COLOUR: Record<SpecialtyId, string> = {
  general: "#5AA9C7",
  paediatrics: "#F5A623",
  dermatology: "#E8825C",
  psychiatry: "#A78BFA",
  radiology: "#4FC3D9",
  neurology: "#C77DFF",
  orthopaedics: "#6FD08C",
  cardiology: "#FF6B6B",
  maternity: "#F58FC2",
  emergency: "#FF8551",
  surgery: "#4D9DE0",
  oncology: "#8AA4F0",
};

export const colourFor = (id: SpecialtyId) =>
  DEPARTMENT_COLOUR[id] ?? "#8AA0C4";

export const SPECIALTY_BY_ID = new Map(SPECIALTIES.map((s) => [s.id, s]));
export const EQUIPMENT_BY_ID = new Map(EQUIPMENT.map((e) => [e.id, e]));
export const FACILITY_BY_ID = new Map(FACILITY_TYPES.map((f) => [f.id, f]));
export const ROLE_BY_ID = new Map(STAFF_ROLES.map((r) => [r.id, r]));
export const CONDITIONS_BY_ID = new Map(CONDITIONS.map((c) => [c.id, c]));

export const CONDITIONS_BY_SPECIALTY = CONDITIONS.reduce(
  (acc, cond) => {
    (acc[cond.specialty] ??= []).push(cond);
    return acc;
  },
  {} as Record<string, Condition[]>,
);

const FIRST = [
  "Amara", "Idris", "Noor", "Elena", "Tomas", "Priya", "Rafael", "Mei",
  "Hannah", "Yusuf", "Clara", "Dmitri", "Fatima", "Owen", "Sofia", "Kwame",
  "Ines", "Marco", "Leila", "Anders", "Rosa", "Nikhil", "Bea", "Samir",
];
const LAST = [
  "Okafor", "Lindqvist", "Rahimi", "Moreau", "Bianchi", "Nakamura", "Silva",
  "Kovač", "Adeyemi", "Weiss", "Duarte", "Halloran", "Nasser", "Petrov",
  "Ferreira", "Osei", "Marchetti", "Berg", "Kaur", "Novak",
];

export function staffName(seed: number): string {
  return `Dr ${FIRST[seed % FIRST.length]} ${LAST[(seed * 7) % LAST.length]}`;
}

export function nonDoctorName(seed: number): string {
  return `${FIRST[seed % FIRST.length]} ${LAST[(seed * 7) % LAST.length]}`;
}
