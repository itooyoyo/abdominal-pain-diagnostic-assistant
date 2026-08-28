import { getMissingVitals } from './abdominal-input-adapter.js'
import { MAJOR_CANDIDATE_IDS } from './abdominal-findings.js'

const labelMap = { migration: '疼痛移動', initialPeriumbilical: '臍周囲から発症', nauseaVomiting: '悪心・嘔吐', feverChills: '発熱・悪寒', jaundice: '黄疸', mealRelation: '食事との関連', fattyMeal: '脂肪食との関連', severePain: '非常に強い痛み', peritonealSigns: '腹膜刺激所見', distension: '腹部膨隆', vomiting: '嘔吐', obstipation: '排便・排ガス停止', priorSurgery: '開腹手術歴', groinRadiation: '鼠径部・性器への放散', hematuria: '血尿', urinarySymptoms: '排尿症状', backRadiation: '背部への放散', vascularContext: '血管疾患・高血圧context', painExamMismatch: '痛みと診察所見の不釣り合い', atrialFibrillation: '心房細動', pregnancyPossible: '妊娠可能性', pregnancyTestPositive: '妊娠反応陽性', vaginalBleeding: '性器出血', unilateralPain: '片側性疼痛', chestSymptoms: '胸部症状', dyspnea: '呼吸困難', diabetesContext: '糖尿病context', deepBreathing: '深く大きな呼吸' }
const humanize = (reason) => reason.split(' ＋ ').map((part) => labelMap[part] ?? part).join(' ＋ ')
const isMajor = (candidate) => MAJOR_CANDIDATE_IDS.includes(candidate.id)
const isLocationOnly = (candidate) => candidate.supportingFindings.length === 0 || candidate.supportingFindings.every(({ reason }) => reason === 'location' || reason.startsWith('疼痛部位：'))

function displayEvidence(candidate) {
  const combined = candidate.supportingFindings.filter(({ reason }) => reason.includes(' ＋ '))
  const covered = new Set(combined.flatMap(({ reason }) => reason.split(' ＋ ')))
  const ordered = [...combined, ...candidate.supportingFindings.filter(({ reason }) => !reason.includes(' ＋ ') && !covered.has(reason))]
  return [...new Set(ordered.map(({ reason }) => humanize(reason)))].slice(0, 3)
}

function mapCandidate(candidate, rawRank) {
  const supporting = candidate.supportingFindings.map(({ reason }) => humanize(reason))
  const unknown = candidate.unknownImportantFindings.map((key) => labelMap[key] ?? key)
  return {
    id: candidate.id,
    rawRank,
    displayName: candidate.displayName,
    category: candidate.category,
    evidenceStrength: candidate.evidenceStrength,
    supporting,
    displayEvidence: displayEvidence(candidate),
    unknown,
    importantUnknown: unknown.slice(0, 1),
    weakContradictions: candidate.weakContradictions.map((key) => labelMap[key] ?? key),
    guards: candidate.doNotExcludeGuards.map((guard) => humanize(guard.reason)),
    tests: candidate.tests,
    examHints: candidate.examHints,
  }
}

function groupByCategory(candidates) {
  return candidates.reduce((groups, candidate) => {
    const existing = groups.find(({ category }) => category === candidate.category)
    if (existing) existing.candidates.push(candidate)
    else groups.push({ category: candidate.category, candidates: [candidate] })
    return groups
  }, [])
}

export function buildPresentationModel(evaluation, stop) {
  const rawCandidates = evaluation.candidates
  const mapped = rawCandidates.map((candidate, index) => mapCandidate(candidate, index + 1))
  const primaryRaw = rawCandidates.length === 0 ? [] : [rawCandidates[0]]
  const primaryIds = new Set(primaryRaw.map(({ id }) => id))
  const importantRaw = rawCandidates.filter((candidate) => !primaryIds.has(candidate.id) && isMajor(candidate))
  const importantIds = new Set(importantRaw.map(({ id }) => id))
  const supportingRaw = rawCandidates.filter((candidate) => !primaryIds.has(candidate.id) && !importantIds.has(candidate.id) && (candidate.evidenceStrength === 'STRONG_COMBINATION' || candidate.evidenceStrength === 'MODERATE' || !isLocationOnly(candidate)))
  const supportingIds = new Set(supportingRaw.map(({ id }) => id))
  const otherRaw = rawCandidates.filter((candidate) => !primaryIds.has(candidate.id) && !importantIds.has(candidate.id) && !supportingIds.has(candidate.id))
  const byId = new Map(mapped.map((candidate) => [candidate.id, candidate]))
  const primaryDifferentials = primaryRaw.map(({ id }) => byId.get(id))
  const importantCompetingDifferentials = importantRaw.map(({ id }) => byId.get(id))
  const supportingDifferentials = supportingRaw.map(({ id }) => byId.get(id))
  const otherDifferentials = otherRaw.map(({ id }) => byId.get(id))
  const actionCandidates = [...primaryRaw, ...importantRaw, ...supportingRaw]
  const examinationHints = [...new Set(actionCandidates.flatMap((candidate) => candidate.examHints))]
  const suggestedTests = [...new Map(actionCandidates.flatMap((candidate) => candidate.tests).map((test) => [test.name, test])).values()]
  const cardUnknown = new Set([...primaryDifferentials, ...importantCompetingDifferentials].flatMap((candidate) => candidate.importantUnknown))
  const commonUnknown = [...new Set(mapped.flatMap((candidate) => candidate.unknown))].filter((item) => !cardUnknown.has(item))
  const missingImportantInformation = [...getMissingVitals(evaluation.context).map((key) => `${key}未測定`), ...evaluation.conflicts, ...(evaluation.insufficientInformation ? ['主な腹痛部位が判定できません'] : []), ...commonUnknown]

  return {
    rawCandidates,
    rawEvidence: rawCandidates.map(({ id, supportingFindings }) => ({ id, supportingFindings })),
    rawUnknown: rawCandidates.map(({ id, unknownImportantFindings }) => ({ id, unknownImportantFindings })),
    rawContradictions: rawCandidates.map(({ id, weakContradictions }) => ({ id, weakContradictions })),
    rawTests: rawCandidates.flatMap(({ tests }) => tests),
    rawExaminationHints: rawCandidates.flatMap(({ examHints }) => examHints),
    primaryDifferentials,
    supportingDifferentials,
    supportingGroups: groupByCategory(supportingDifferentials),
    importantCompetingDifferentials,
    otherDifferentials,
    currentDifferentials: mapped,
    examinationHints,
    suggestedTests,
    missingImportantInformation: [...new Set(missingImportantInformation)],
    conflicts: [...evaluation.conflicts],
    insufficientInformation: evaluation.insufficientInformation,
    stopReason: stop.stopReason,
    summary: {
      diagnoses: primaryDifferentials.map(({ displayName }) => displayName),
      reasons: primaryDifferentials.flatMap(({ displayEvidence }) => displayEvidence).slice(0, 3),
      nextAction: stop.stopReason === 'physical_exam_required' ? examinationHints[0] : suggestedTests[0]?.name ?? examinationHints[0] ?? null,
    },
  }
}
