import type { UserRole, SurveyStatus } from '../types';

// ─── Roles ───────────────────────────────────────────────
export const ROLES: Record<
  UserRole,
  { value: UserRole; label: string; hierarchy: number }
> = {
  admin: { value: 'admin', label: 'Administrator', hierarchy: 4 },
  supervisor: { value: 'supervisor', label: 'Supervisor', hierarchy: 3 },
  'iffs-member': { value: 'iffs-member', label: 'IFFS Member', hierarchy: 2 },
  user: { value: 'user', label: 'User', hierarchy: 1 },
};

// ─── Survey ──────────────────────────────────────────────
export const SURVEY = {
  TOTAL_SECTIONS: 20,
  AUTOSAVE_INTERVAL_MS: 3000,
  LS_PREFIX: 'iffs_survey_progress_',
  LS_WA_KEY: 'iffs_wa_api_key',
  LS_WA_ACCOUNT_ID: 'iffs_wa_account_id',
  LS_MAPBOX_TOKEN: 'iffs_mapbox_token',
} as const;

// ─── Routes ──────────────────────────────────────────────
export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  DASHBOARD: '/dashboard',
} as const;

// ─── Status Labels ───────────────────────────────────────
export const STATUS_LABELS: Record<SurveyStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
};

// ─── Section Names ───────────────────────────────────────
export const SECTION_NAMES: string[] = [
  "Participant's Info",
  'ART Infrastructure',
  'ART Regulation',
  'ART Licensing',
  'ART Monitoring',
  'ART Finances',
  'ART Insurance',
  'Medical Tourism',
  'ART Laws',
  'Embryo Transfer',
  'ART Technology',
  'Cryopreservation',
  'Genetic Testing',
  'Fetal Reduction',
  'Experimentation',
  'Human Development',
  'Child Welfare',
  'Posthumous Reproduction',
  'Third Party Reproduction',
  'Anonymity',
];

// ─── Section Descriptions ────────────────────────────────
export const SECTION_DESCRIPTIONS: string[] = [
  "Basic information about the survey participant, including contact details, professional role, and the country or region they represent.",
  "Questions relating to the availability, distribution, and capacity of assisted reproductive technology (ART) clinics and facilities within the country.",
  "Overview of national policies, governmental oversight bodies, and regulatory frameworks that govern ART practices.",
  "Details on the licensing requirements for ART clinics and practitioners, including renewal processes, inspections, and compliance standards.",
  "Information on how ART outcomes, clinic performance, and patient safety are tracked, reported, and monitored at a national or regional level.",
  "Financial aspects of ART, including public funding, insurance coverage, out-of-pocket costs for patients, and subsidies available.",
  "Scope of insurance policies covering ART treatments, mandatory or voluntary insurance schemes, and patient financial protections.",
  "Cross-border reproductive care trends, regulations governing foreign patients seeking ART treatment, and ethical considerations.",
  "Specific national laws or statutes that directly address ART, including legislation on parental rights, donor anonymity, and surrogacy.",
  "Policies and guidelines on the number of embryos transferred per cycle, single embryo transfer recommendations, and related practices.",
  "Availability and use of advanced ART technologies such as time-lapse imaging, artificial intelligence in embryo selection, and micromanipulation.",
  "Regulations and practices around the cryopreservation of gametes and embryos, storage time limits, and ownership rights.",
  "Use of preimplantation genetic testing (PGT) for aneuploidy screening, monogenic disorders, and structural rearrangements.",
  "Laws, ethical guidelines, and clinical practices regarding multifetal pregnancy reduction procedures.",
  "Oversight of research involving human embryos, gametes, and reproductive technologies, including permitted and prohibited activities.",
  "Policies related to fetal development research, stem cell research derived from ART procedures, and related ethical frameworks.",
  "Protections and rights afforded to children born through ART, including rights to identity, donor information, and family law considerations.",
  "Legal and ethical frameworks governing the use of gametes or embryos after the death of a contributor.",
  "Regulation of egg, sperm, and embryo donation; surrogacy arrangements (altruistic and commercial); and related consent requirements.",
  "Policies on donor anonymity, identity disclosure to donor-conceived individuals, and national donor registries.",
];

// ─── Map ─────────────────────────────────────────────────
export const MAP = {
  DEFAULT_VIEWPORT: {
    longitude: 0,
    latitude: 20,
    zoom: 1.5,
  },
  STYLE_URL: 'mapbox://styles/mapbox/light-v11',
  LAYER_ID: 'country-fills',
} as const;

// ─── Color Scale ─────────────────────────────────────────
export const COLOR_SCALE: Record<'submitted' | 'draft' | 'reviewed' | 'none', string> = {
  submitted: '#1d7733',
  draft: '#f59e0b',
  reviewed: '#3b82f6',
  none: '#e2ebe4',
};
