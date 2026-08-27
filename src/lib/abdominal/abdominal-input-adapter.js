import { findingState } from './abdominal-findings.js'
const VITAL_KEYS = ['SBP', 'DBP', 'HR', 'RR', 'SpO2', 'BT']
function normalizeVital(rawVital) {
  if (rawVital?.status === 'not_assessed' || rawVital?.value === '') return { value: null, state: 'not_assessed' }
  const value = Number(rawVital?.value)
  return Number.isFinite(value) ? { value, state: 'present' } : { value: null, state: 'not_assessed' }
}
export function normalizeAbdominalInput(raw = {}) {
  const answers = raw.answers ?? {}
  return {
    demographics: { age: raw.age === '' || raw.age == null ? null : Number(raw.age), anatomicContext: raw.anatomicContext ?? 'unknown' },
    pain: { primaryLocation: raw.primaryLocation ?? 'indeterminate', additionalLocations: raw.additionalLocations ?? [], onsetSpeed: raw.onsetSpeed ?? 'unknown', initialLocation: raw.initialLocation ?? null },
    vitals: Object.fromEntries(VITAL_KEYS.map((key) => [key, normalizeVital(raw.vitals?.[key])])),
    findings: Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, findingState(value)])),
    conflicts: raw.conflicts ?? [],
  }
}
export function getMissingVitals(context) { return Object.entries(context.vitals).filter(([, vital]) => vital.state === 'not_assessed').map(([key]) => key) }
