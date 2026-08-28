import { QUESTIONS, PRIORITY_ORDER } from './abdominal-questions.js'
import { isPresent, isUnknown } from './abdominal-findings.js'
import { DISEASE_REGISTRY } from './abdominal-disease-registry.js'

const UTILITY_ORDER = Object.freeze({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 })
const LOWER_ABDOMINAL = new Set(['RLQ', 'LLQ', 'suprapubic'])
const UPPER_ABDOMINAL = new Set(['epigastric', 'RUQ', 'LUQ'])
const FLANK_LOCATIONS = new Set(['flank', 'right_flank', 'left_flank'])
const VASCULAR_LOCATIONS = new Set(['generalized', 'periumbilical', 'epigastric', ...FLANK_LOCATIONS, 'back'])
const CONFLICT_QUESTIONS = Object.freeze([
  { id: 'clarifyCurrentLocation', label: '現在もっとも痛い場所をもう一度確認してください。', priority: 'P1', priorityClass: 'CRITICAL', contextRelevance: 'CRITICAL', selectionReason: 'clarify conflicting pain location', sourceCandidates: [], candidateIds: [], activePatterns: ['conflict_clarification'] },
  { id: 'clarifyPainMigration', label: '痛みが移動した場合、発症時の場所から現在の場所までを順に確認してください。', priority: 'P1', priorityClass: 'CRITICAL', contextRelevance: 'CRITICAL', selectionReason: 'clarify conflicting migration history', sourceCandidates: [], candidateIds: [], activePatterns: ['conflict_clarification'] },
])

const PATTERNS = Object.freeze([
  { id: 'appendiceal_pattern', when: (c) => c.pain.primaryLocation === 'RLQ', high: ['initialPeriumbilical', 'migration', 'nauseaVomiting'] },
  { id: 'biliary_pattern', when: (c) => c.pain.primaryLocation === 'RUQ', high: ['feverChills', 'jaundice', 'mealRelation'] },
  { id: 'pancreatic_pattern', when: (c) => c.pain.primaryLocation === 'epigastric' && !cardiopulmonaryContext(c), high: ['backRadiation', 'nauseaVomiting', 'severePain'] },
  { id: 'urinary_stone_pattern', when: (c) => FLANK_LOCATIONS.has(c.pain.primaryLocation) || c.pain.primaryLocation === 'back', high: ['groinRadiation', 'hematuria', 'feverChills'] },
  { id: 'urinary_retention_pattern', when: (c) => c.pain.primaryLocation === 'suprapubic', high: ['urinarySymptoms', 'distension'] },
  { id: 'obstruction_pattern', when: (c) => ['generalized', 'periumbilical'].includes(c.pain.primaryLocation) && !vascularContext(c) && !metabolicContext(c), high: ['obstipation', 'distension', 'vomiting'] },
  { id: 'gynecologic_pattern', when: (c) => LOWER_ABDOMINAL.has(c.pain.primaryLocation), high: ['pregnancyPossible', 'unilateralPain', 'vaginalBleeding'] },
  { id: 'cardiopulmonary_pattern', when: cardiopulmonaryContext, high: ['chestSymptoms', 'dyspnea', 'vascularContext'] },
  { id: 'metabolic_pattern', when: metabolicContext, high: ['deepBreathing', 'diabetesContext', 'nauseaVomiting'] },
  { id: 'vascular_pattern', when: vascularContext, high: ['severePain', 'painExamMismatch', 'atrialFibrillation', 'vascularContext', 'backRadiation'] },
])

function measured(context, key) {
  return context.vitals[key]?.state === 'present' ? context.vitals[key].value : null
}

function cardiopulmonaryContext(context) {
  return UPPER_ABDOMINAL.has(context.pain.primaryLocation) && (
    (measured(context, 'RR') ?? 0) >= 22 ||
    (measured(context, 'SpO2') ?? 100) < 94 ||
    isPresent(context, 'dyspnea') ||
    isPresent(context, 'chestSymptoms') ||
    (context.demographics.age ?? 0) >= 65
  )
}

function metabolicContext(context) {
  return ['generalized', 'epigastric'].includes(context.pain.primaryLocation) && (
    (measured(context, 'RR') ?? 0) >= 22 ||
    isPresent(context, 'deepBreathing') ||
    isPresent(context, 'diabetesContext')
  )
}

function vascularContext(context) {
  return VASCULAR_LOCATIONS.has(context.pain.primaryLocation) && (
    isPresent(context, 'vascularContext') ||
    isPresent(context, 'atrialFibrillation') ||
    isPresent(context, 'painExamMismatch') ||
    ((context.demographics.age ?? 0) >= 65 && ['sudden', 'rapid'].includes(context.pain.onsetSpeed))
  )
}

export function deriveClinicalPatterns(context) {
  return PATTERNS.filter((pattern) => pattern.when(context)).map(({ id }) => id)
}

function classifyUtility(questionId, evaluation, patternMatches) {
  const context = evaluation.context
  if (questionId === 'pregnancyPossible' && LOWER_ABDOMINAL.has(context.pain.primaryLocation) && context.demographics.anatomicContext !== 'not_relevant') return ['CRITICAL', 'lower-abdominal pregnancy safety']
  if (patternMatches.has('vascular_pattern') && ['severePain', 'painExamMismatch', 'atrialFibrillation', 'vascularContext', 'backRadiation'].includes(questionId)) return ['CRITICAL', 'active vascular safety pattern']
  if (patternMatches.has('cardiopulmonary_pattern') && ['chestSymptoms', 'dyspnea'].includes(questionId)) return ['CRITICAL', 'active cardiopulmonary safety pattern']
  const matchingPatterns = PATTERNS.filter(({ id, high }) => patternMatches.has(id) && high.includes(questionId)).map(({ id }) => id)
  if (matchingPatterns.length) return ['HIGH', `high relevance to ${matchingPatterns.join(', ')}`]
  return [PRIORITY_ORDER[QUESTIONS[questionId].priority] <= 2 ? 'MEDIUM' : 'LOW', 'candidate support outside dominant pattern']
}

function tieBreakIndex(questionId, patternMatches) {
  const order = PATTERNS.filter(({ id }) => patternMatches.has(id)).flatMap(({ high }) => high)
  const index = order.indexOf(questionId)
  return index < 0 ? Number.MAX_SAFE_INTEGER : index
}

export function selectAdaptiveQuestions(evaluation, { round = 1, limit = 3 } = {}) {
  if (round > 3 || (round === 3 && evaluation.conflicts.length === 0 && !evaluation.insufficientInformation)) return []
  const roundLimit = Math.min(3, Math.max(0, limit))
  if (evaluation.conflicts.length) {
    return CONFLICT_QUESTIONS.filter(({ id }) => !Object.hasOwn(evaluation.context.findings, id)).slice(0, Math.min(2, roundLimit))
  }
  const activePatterns = deriveClinicalPatterns(evaluation.context)
  const patternMatches = new Set(activePatterns)
  const candidateIdsByQuestion = new Map()

  for (const candidate of evaluation.candidates.slice(0, 8)) {
    for (const finding of candidate.nextUsefulFindings) {
      if (!QUESTIONS[finding] || !isUnknown(evaluation.context, finding) || Object.hasOwn(evaluation.context.findings, finding)) continue
      if (['pregnancyTestPositive', 'pregnancyTestTimingKnown'].includes(finding) && !Object.hasOwn(evaluation.context.findings, 'pregnancyPossible')) continue
      const [utility] = classifyUtility(finding, evaluation, patternMatches)
      const activated = candidate.supportingFindings.some(({ finding: support }) => support !== 'primaryLocation') || utility === 'CRITICAL' || utility === 'HIGH'
      if (!activated) continue
      const ids = candidateIdsByQuestion.get(finding) ?? new Set()
      ids.add(candidate.id)
      candidateIdsByQuestion.set(finding, ids)
    }
  }

  for (const pattern of PATTERNS.filter(({ id }) => patternMatches.has(id))) {
    for (const finding of pattern.high) {
      if (!QUESTIONS[finding] || !isUnknown(evaluation.context, finding) || Object.hasOwn(evaluation.context.findings, finding)) continue
      const sources = candidateIdsByQuestion.get(finding) ?? new Set()
      for (const candidate of DISEASE_REGISTRY.filter(({ questions }) => questions.includes(finding))) sources.add(candidate.id)
      if (sources.size === 0) sources.add(pattern.id)
      candidateIdsByQuestion.set(finding, sources)
    }
  }

  if (LOWER_ABDOMINAL.has(evaluation.context.pain.primaryLocation) && isUnknown(evaluation.context, 'pregnancyPossible') && !Object.hasOwn(evaluation.context.findings, 'pregnancyPossible')) {
    candidateIdsByQuestion.set('pregnancyPossible', new Set(['ectopic_pregnancy']))
  }

  const ranked = [...candidateIdsByQuestion.entries()]
    .map(([id, sourceCandidates]) => {
      const [priorityClass, selectionReason] = classifyUtility(id, evaluation, patternMatches)
      return { ...QUESTIONS[id], sourceCandidates: [...sourceCandidates], candidateIds: [...sourceCandidates], priorityClass, contextRelevance: priorityClass, selectionReason, activePatterns }
    })
    .sort((a, b) => UTILITY_ORDER[a.priorityClass] - UTILITY_ORDER[b.priorityClass] || tieBreakIndex(a.id, patternMatches) - tieBreakIndex(b.id, patternMatches) || b.sourceCandidates.length - a.sourceCandidates.length || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.id.localeCompare(b.id))
  if (activePatterns.length <= 1 || roundLimit < 3) return ranked.slice(0, roundLimit)
  const selected = ranked.slice(0, 2)
  const dominantReason = selected[0]?.selectionReason
  const sameDominantReason = selected.length === 2 && selected.every(({ selectionReason }) => selectionReason === dominantReason)
  if (sameDominantReason) {
    const diverseHigh = ranked.find((question) => !selected.includes(question) && question.priorityClass === 'HIGH' && question.selectionReason !== dominantReason)
    if (diverseHigh) return [...selected, diverseHigh].slice(0, roundLimit)
  }
  return ranked.slice(0, roundLimit)
}
