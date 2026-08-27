import { DISEASE_REGISTRY } from './abdominal-disease-registry.js'
import { EVIDENCE_STRENGTH, isAbsent, isPresent, isUnknown } from './abdominal-findings.js'

const strengthRank = { STRONG_COMBINATION: 0, MODERATE: 1, WEAK: 2, CONTEXT: 3 }
const locationLabel = (value) => `疼痛部位：${value}`

function hasRelevantLocation(disease, context) {
  const locations = [context.pain.primaryLocation, ...context.pain.additionalLocations]
  return disease.locations.some((location) => locations.includes(location))
}

function derivedPresent(context, key) {
  if (key === 'suddenOnset') return context.pain.onsetSpeed === 'sudden'
  return isPresent(context, key)
}

function evaluateDisease(disease, context) {
  const locationMatch = hasRelevantLocation(disease, context)
  const support = []
  const weakContradictions = []
  const doNotExcludeGuards = []
  const unknownImportantFindings = []

  if (locationMatch) support.push({ finding: 'primaryLocation', strength: EVIDENCE_STRENGTH.WEAK, reason: locationLabel(context.pain.primaryLocation) })
  if (['sudden', 'rapid'].includes(context.pain.onsetSpeed) && ['aortic_disease', 'GI_perforation', 'ovarian_torsion'].includes(disease.id)) {
    support.push({ finding: 'onsetSpeed', strength: EVIDENCE_STRENGTH.MODERATE, reason: '突然・急速な発症' })
  }
  for (const key of disease.weak) if (derivedPresent(context, key)) support.push({ finding: key, strength: EVIDENCE_STRENGTH.WEAK, reason: key })
  for (const key of disease.moderate) if (derivedPresent(context, key)) support.push({ finding: key, strength: EVIDENCE_STRENGTH.MODERATE, reason: key })
  for (const key of disease.contextual) if (derivedPresent(context, key)) support.push({ finding: key, strength: EVIDENCE_STRENGTH.CONTEXT, reason: key })
  for (const combination of disease.strong) {
    if (combination.every((key) => derivedPresent(context, key))) support.push({ finding: combination.join('+'), strength: EVIDENCE_STRENGTH.STRONG_COMBINATION, reason: combination.join(' ＋ ') })
  }
  for (const key of disease.guards) {
    if (isAbsent(context, key)) doNotExcludeGuards.push({ finding: key, strength: EVIDENCE_STRENGTH.DO_NOT_EXCLUDE, reason: `${key}が陰性でも除外しません` })
  }
  for (const key of disease.questions) if (isUnknown(context, key)) unknownImportantFindings.push(key)
  for (const key of disease.moderate) if (isAbsent(context, key) && !disease.guards.includes(key)) weakContradictions.push(key)

  const nonLocationSupport = support.filter((item) => item.finding !== 'primaryLocation')
  const explicitPregnancyUnknown = disease.id === 'ectopic_pregnancy' && Object.hasOwn(context.findings, 'pregnancyPossible')
  const suddenMajorActivation = ['aortic_disease', 'GI_perforation'].includes(disease.id)
    && ['sudden', 'rapid'].includes(context.pain.onsetSpeed)
  const majorActivation = !disease.major || nonLocationSupport.length > 0 || explicitPregnancyUnknown || (
    locationMatch && suddenMajorActivation
  )
  const tier2Activation = disease.tier !== 2 || nonLocationSupport.length > 0
  const active = locationMatch && majorActivation && tier2Activation
  const strongest = support.map((item) => item.strength).sort((a, b) => strengthRank[a] - strengthRank[b])[0] ?? EVIDENCE_STRENGTH.CONTEXT

  return { ...disease, active, supportingFindings: support, weakContradictions, unknownImportantFindings, doNotExcludeGuards, evidenceStrength: strongest, nextUsefulFindings: disease.questions.filter((key) => isUnknown(context, key)) }
}

function rankCandidates(a, b) {
  if (strengthRank[a.evidenceStrength] !== strengthRank[b.evidenceStrength]) return strengthRank[a.evidenceStrength] - strengthRank[b.evidenceStrength]
  if (a.supportingFindings.length !== b.supportingFindings.length) return b.supportingFindings.length - a.supportingFindings.length
  if (a.tier !== b.tier) return a.tier - b.tier
  return a.displayName.localeCompare(b.displayName, 'ja')
}

export function evaluateDifferential(context) {
  const candidates = DISEASE_REGISTRY.filter((disease) => disease.tier < 3).map((disease) => evaluateDisease(disease, context)).filter((candidate) => candidate.active).sort(rankCandidates)
  return { context, candidates, conflicts: context.conflicts, insufficientInformation: context.pain.primaryLocation === 'indeterminate' }
}
