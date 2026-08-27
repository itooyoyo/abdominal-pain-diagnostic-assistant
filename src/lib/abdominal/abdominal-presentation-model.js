import { getMissingVitals } from './abdominal-input-adapter.js'
import { MAJOR_CANDIDATE_IDS } from './abdominal-findings.js'

const labelMap = { migration: '疼痛移動', initialPeriumbilical: '臍周囲から発症', nauseaVomiting: '悪心・嘔吐', feverChills: '発熱・悪寒', jaundice: '黄疸', mealRelation: '食事との関連', fattyMeal: '脂肪食との関連', severePain: '非常に強い痛み', peritonealSigns: '腹膜刺激所見', distension: '腹部膨隆', vomiting: '嘔吐', obstipation: '排便・排ガス停止', priorSurgery: '開腹手術歴', groinRadiation: '鼠径部・性器への放散', hematuria: '血尿', urinarySymptoms: '排尿症状', backRadiation: '背部への放散', vascularContext: '血管疾患・高血圧context', painExamMismatch: '痛みと診察所見の不釣り合い', atrialFibrillation: '心房細動', pregnancyPossible: '妊娠可能性', pregnancyTestPositive: '妊娠反応陽性', vaginalBleeding: '性器出血', unilateralPain: '片側性疼痛', chestSymptoms: '胸部症状', dyspnea: '呼吸困難', diabetesContext: '糖尿病context', deepBreathing: '深く大きな呼吸' }
const humanize = (reason) => reason.split(' ＋ ').map((part) => labelMap[part] ?? part).join(' ＋ ')

export function buildPresentationModel(evaluation, stop) {
  const primary = evaluation.candidates.slice(0, 5)
  const retainedMajor = evaluation.candidates.filter((candidate) => MAJOR_CANDIDATE_IDS.includes(candidate.id) && !primary.some((item) => item.id === candidate.id))
  const displayed = [...primary, ...retainedMajor]
  const mapCandidate = (candidate) => ({
    id: candidate.id,
    displayName: candidate.displayName,
    category: candidate.category,
    evidenceStrength: candidate.evidenceStrength,
    supporting: candidate.supportingFindings.map((item) => humanize(item.reason)),
    unknown: candidate.unknownImportantFindings.map((key) => labelMap[key] ?? key),
    weakContradictions: candidate.weakContradictions.map((key) => labelMap[key] ?? key),
    guards: candidate.doNotExcludeGuards.map((guard) => humanize(guard.reason)),
  })
  return {
    currentDifferentials: displayed.map(mapCandidate),
    examinationHints: [...new Set(displayed.flatMap((candidate) => candidate.examHints))],
    suggestedTests: [...new Map(displayed.flatMap((candidate) => candidate.tests).map((test) => [test.name, test])).values()],
    otherDifferentials: evaluation.candidates.filter((candidate) => !displayed.some((item) => item.id === candidate.id)).slice(0, 5).map(mapCandidate),
    missingImportantInformation: [...getMissingVitals(evaluation.context).map((key) => `${key}未測定`), ...evaluation.conflicts, ...(evaluation.insufficientInformation ? ['主な腹痛部位が判定できません'] : [])],
    stopReason: stop.stopReason,
  }
}
