export type ClinicalOption = {
  id: string;
  label: string;
};

export type DiagnosisAttributeOption = {
  id: string;
  label: string;
};

export type DiagnosisOption = ClinicalOption & {
  diagnosisToken: string;
  availableAttributes?: DiagnosisAttributeOption[];
};

function createDiagnosisOption({
  id,
  baseLabel,
  diagnosisToken,
  availableAttributes = [],
  attributeLabel
}: {
  id: string;
  baseLabel: string;
  diagnosisToken: string;
  availableAttributes?: DiagnosisAttributeOption[];
  attributeLabel?: string;
}): DiagnosisOption {
  return {
    id,
    label: attributeLabel ? `${baseLabel} (${attributeLabel})` : baseLabel,
    diagnosisToken,
    availableAttributes
  };
}

export const diagnoses: DiagnosisOption[] = [
  createDiagnosisOption({
    id: "dx_acute_fatty_liver_pregnancy",
    baseLabel: "Acute Fatty Liver of Pregnancy",
    diagnosisToken: "Dx.AcuteFattyLiverOfPregnancy"
  }),
  createDiagnosisOption({
    id: "dx_asthma",
    baseLabel: "Asthma",
    diagnosisToken: "Dx.Asthma"
  }),
  createDiagnosisOption({
    id: "dx_eclampsia",
    baseLabel: "Eclampsia",
    diagnosisToken: "Dx.Eclampsia"
  }),
  createDiagnosisOption({
    id: "dx_gestational_hypertension",
    baseLabel: "Gestational Hypertension",
    diagnosisToken: "Dx.GestationalHypertension"
  }),
  createDiagnosisOption({
    id: "dx_hellp_syndrome",
    baseLabel: "HELLP Syndrome",
    diagnosisToken: "Dx.HELLPSyndrome"
  }),
  createDiagnosisOption({
    id: "dx_heart_block",
    baseLabel: "Heart Block",
    diagnosisToken: "Dx.HeartBlock"
  }),
  createDiagnosisOption({
    id: "dx_heart_failure",
    baseLabel: "Heart Failure",
    diagnosisToken: "Dx.HeartFailure"
  }),
  createDiagnosisOption({
    id: "dx_placenta_previa",
    baseLabel: "Placenta Previa",
    diagnosisToken: "Dx.PlacentaPrevia"
  }),
  createDiagnosisOption({
    id: "dx_placental_abruption",
    baseLabel: "Placental Abruption",
    diagnosisToken: "Dx.PlacentalAbruption"
  }),
  createDiagnosisOption({
    id: "dx_preeclampsia",
    baseLabel: "Preeclampsia",
    diagnosisToken: "Dx.Preeclampsia",
    availableAttributes: [{ id: "severe_features", label: "Severe" }]
  })
];

export const comorbidities: ClinicalOption[] = [
  { id: "ctx_multiple_gestation", label: "Multiple Gestation" },
  { id: "ctx_prior_cesarean_delivery", label: "Prior Cesarean Delivery" },
  { id: "ctx_family_history_hypertensive_disorders", label: "Family History of Hypertensive Disorders" },
  { id: "ctx_chronic_hypertension", label: "Chronic Hypertension" },
  { id: "ctx_preexisting_diabetes", label: "Preexisting Diabetes" }
];

export const physiologicStates: ClinicalOption[] = [
  { id: "ctx_sbp_160", label: "Systolic BP >= 160 mmHg" },
  { id: "ctx_dbp_110", label: "Diastolic BP >= 110 mmHg" },
  { id: "ctx_proteinuria", label: "Proteinuria" },
  { id: "ctx_platelets_lt_100k", label: "Platelets < 100k" },
  { id: "ctx_ast_alt_elevated", label: "AST/ALT Elevated" },
  { id: "ctx_breastfeeding", label: "Breastfeeding" },
  { id: "ctx_creatinine_elevated", label: "Elevated Creatinine" },
  { id: "ctx_postpartum", label: "Postpartum" },
  { id: "ctx_headache", label: "Headache" },
  { id: "ctx_visual_disturbance", label: "Visual Disturbance" },
  { id: "ctx_ruq_pain", label: "RUQ Pain" }
];

export const gestationalAgeMarks = [20, 28, 34, 37, 42];
export const maternalAgeMarks = [35, 40, 45];
export const bmiMarks = [25, 30, 35, 40];

export const clinicalActions: ClinicalOption[] = [
  { id: "action_expectant_management", label: "Expectant Management" },
  { id: "action_expedited_delivery", label: "Expedited Delivery" },
  { id: "action_immediate_delivery", label: "Immediate Delivery" }
];
