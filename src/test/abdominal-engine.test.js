import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAbdominalInput } from '../lib/abdominal/abdominal-input-adapter.js'
import { evaluateDifferential } from '../lib/abdominal/abdominal-differential-engine.js'
import { selectAdaptiveQuestions } from '../lib/abdominal/abdominal-question-selector.js'
import { evaluateStopCondition } from '../lib/abdominal/abdominal-stop-evaluator.js'
import { buildPresentationModel } from '../lib/abdominal/abdominal-presentation-model.js'

const stableVitalValues = { SBP: 120, DBP: 70, HR: 80, RR: 16, SpO2: 98, BT: 36.8 }
const vitals = Object.fromEntries(Object.entries(stableVitalValues).map(([key, value]) => [key, { value }]))
const raw = (location, answers = {}, options = {}) => ({ age: 42, primaryLocation: location, onsetSpeed: 'gradual', vitals, answers, ...options })
const evaluate = (input) => evaluateDifferential(normalizeAbdominalInput(input))
const ids = (evaluation) => evaluation.candidates.map((candidate) => candidate.id)

const FIXTURES = [
  ['典型的虫垂炎', raw('RLQ', { migration: 'present', initialPeriumbilical: 'present', nauseaVomiting: 'present' }, { age: 24 }), 'acute_appendicitis'],
  ['胆石関連', raw('RUQ', { mealRelation: 'present', fattyMeal: 'present', feverChills: 'absent', jaundice: 'absent' }), 'biliary_colic'],
  ['急性膵炎', raw('epigastric', { backRadiation: 'present', nauseaVomiting: 'present' }), 'acute_pancreatitis'],
  ['soft abdomenと穿孔', raw('epigastric', { severePain: 'present', softAbdomen: 'present', peritonealSigns: 'absent' }, { onsetSpeed: 'sudden' }), 'GI_perforation'],
  ['大動脈疾患', raw('generalized', { severePain: 'present', backRadiation: 'present', vascularContext: 'present' }, { age: 76, onsetSpeed: 'sudden' }), 'aortic_disease'],
  ['腸間膜虚血', raw('periumbilical', { severePain: 'present', painExamMismatch: 'present', atrialFibrillation: 'present' }, { age: 78, onsetSpeed: 'sudden' }), 'mesenteric_ischemia'],
  ['尿管結石', raw('flank', { groinRadiation: 'present', hematuria: 'present' }), 'ureteral_stone'],
  ['腸閉塞', raw('generalized', { distension: 'present', vomiting: 'present', obstipation: 'present', priorSurgery: 'present' }), 'bowel_obstruction'],
  ['閉鎖孔ヘルニアcontext', raw('generalized', { distension: 'present', obstipation: 'present' }, { age: 83 }), 'obturator_hernia'],
  ['妊娠可能性不明', raw('suprapubic', { pregnancyPossible: 'unknown', vaginalBleeding: 'present' }, { age: 28 }), 'ectopic_pregnancy'],
  ['月経中の下腹部痛', raw('LLQ', { pregnancyPossible: 'unknown', menstruating: 'present' }, { age: 30 }), 'ectopic_pregnancy'],
  ['卵巣捻転', raw('RLQ', { unilateralPain: 'present', nauseaVomiting: 'present' }, { age: 26, onsetSpeed: 'sudden' }), 'ovarian_torsion'],
  ['卵巣出血timing', raw('LLQ', { unilateralPain: 'present', cycleDay15to28: 'present' }, { age: 31 }), 'ovarian_bleeding'],
  ['心窩部痛と頻呼吸', raw('epigastric', { dyspnea: 'present' }, { vitals: { ...vitals, RR: { value: 28 } } }), 'thoracic_disease'],
  ['胸痛なしのACS', raw('epigastric', { chestSymptoms: 'absent', dyspnea: 'present', vascularContext: 'present' }, { age: 68 }), 'acute_coronary_syndrome'],
  ['DKA', raw('generalized', { deepBreathing: 'present', diabetesContext: 'present', nauseaVomiting: 'present' }, { vitals: { ...vitals, RR: { value: 30 } } }), 'DKA'],
  ['尿閉', raw('suprapubic', { urinarySymptoms: 'present', distension: 'present' }), 'urinary_retention'],
  ['腹水', raw('generalized', { distension: 'present' }), 'ascites'],
  ['反復性腹痛', raw('generalized', { recurrentCourse: 'present' }), 'functional_recurrent_pain'],
  ['食事関連腹痛', raw('RUQ', { mealRelation: 'present', fattyMeal: 'present' }), 'biliary_colic'],
  ['Vital未測定', { age: 44, primaryLocation: 'RLQ', onsetSpeed: 'rapid', vitals: {}, answers: {} }, 'acute_appendicitis'],
  ['矛盾した部位', raw('RLQ', {}, { conflicts: ['主な部位と移動情報が矛盾'] }), 'acute_appendicitis'],
  ['胆管炎', raw('RUQ', { feverChills: 'present', jaundice: 'present' }), 'acute_cholangitis'],
  ['胆嚢炎', raw('RUQ', { feverChills: 'present', jaundice: 'absent', nauseaVomiting: 'present' }), 'acute_cholecystitis'],
  ['側腹部痛と発熱', raw('flank', { feverChills: 'present', urinarySymptoms: 'present' }), 'pyelonephritis_or_systemic_UTI'],
  ['高齢stone-like pain', raw('flank', { groinRadiation: 'present', hematuria: 'present', vascularContext: 'present', severePain: 'present' }, { age: 81, onsetSpeed: 'sudden' }), 'aortic_disease'],
  ['妊娠反応陽性', raw('suprapubic', { pregnancyPossible: 'present', pregnancyTestPositive: 'present', vaginalBleeding: 'present' }, { age: 29 }), 'ectopic_pregnancy'],
  ['妊娠反応陰性で時期不明', raw('LLQ', { pregnancyPossible: 'unknown', pregnancyTestPositive: 'absent', pregnancyTestTimingKnown: 'unknown', vaginalBleeding: 'present' }, { age: 27 }), 'ectopic_pregnancy'],
  ['強い腹痛で腹膜刺激なし', raw('generalized', { severePain: 'present', painExamMismatch: 'present', atrialFibrillation: 'present', peritonealSigns: 'absent' }, { age: 79, onsetSpeed: 'sudden' }), 'mesenteric_ischemia'],
  ['情報不足', { age: null, primaryLocation: 'indeterminate', onsetSpeed: 'unknown', vitals: {}, answers: {} }, null],
]

for (const [name, input, expected] of FIXTURES) {
  test(`fixture: ${name}`, () => {
    const evaluation = evaluate(input)
    if (expected) assert.ok(ids(evaluation).includes(expected), `${expected} should be retained`)
    else assert.equal(evaluation.insufficientInformation, true)
    const questions = selectAdaptiveQuestions(evaluation, { round: 1 })
    assert.ok(questions.length <= 3)
    assert.equal(new Set(questions.map((question) => question.id)).size, questions.length)
  })
}

test('soft abdomen does not remove perforation', () => {
  const evaluation = evaluate(raw('epigastric', { severePain: 'present', softAbdomen: 'present', peritonealSigns: 'absent' }, { onsetSpeed: 'sudden' }))
  const candidate = evaluation.candidates.find(({ id }) => id === 'GI_perforation')
  assert.ok(candidate)
  assert.ok(candidate.doNotExcludeGuards.some(({ finding }) => finding === 'peritonealSigns'))
})

test('absent peritoneal signs do not remove mesenteric ischemia', () => {
  const evaluation = evaluate(raw('generalized', { severePain: 'present', painExamMismatch: 'present', atrialFibrillation: 'present', peritonealSigns: 'absent' }, { onsetSpeed: 'sudden' }))
  assert.ok(ids(evaluation).includes('mesenteric_ischemia'))
})

test('menstruation does not remove ectopic pregnancy', () => {
  assert.ok(ids(evaluate(raw('LLQ', { pregnancyPossible: 'unknown', menstruating: 'present' }))).includes('ectopic_pregnancy'))
})

test('negative pregnancy test with unknown timing does not hard-exclude ectopic pregnancy', () => {
  assert.ok(ids(evaluate(raw('LLQ', { pregnancyPossible: 'unknown', pregnancyTestPositive: 'absent', pregnancyTestTimingKnown: 'unknown' }))).includes('ectopic_pregnancy'))
})

test('absent chest pain does not remove ACS when other context supports it', () => {
  assert.ok(ids(evaluate(raw('epigastric', { chestSymptoms: 'absent', dyspnea: 'present', vascularContext: 'present' }))).includes('acute_coronary_syndrome'))
})

test('older stone-like presentation retains aortic disease', () => {
  const evaluation = evaluate(raw('flank', { groinRadiation: 'present', severePain: 'present', vascularContext: 'present' }, { age: 82, onsetSpeed: 'sudden' }))
  assert.ok(ids(evaluation).includes('ureteral_stone'))
  assert.ok(ids(evaluation).includes('aortic_disease'))
})

test('unmeasured vitals are never normalized as normal', () => {
  const context = normalizeAbdominalInput({ primaryLocation: 'RLQ', vitals: {} })
  assert.ok(Object.values(context.vitals).every(({ state, value }) => state === 'not_assessed' && value === null))
})

test('unknown is never converted to absent', () => {
  const context = normalizeAbdominalInput(raw('RLQ', { migration: 'unknown' }))
  assert.equal(context.findings.migration, 'unknown')
})

test('answered unknown finding is retained but not asked again', () => {
  const evaluation = evaluate(raw('LLQ', { pregnancyPossible: 'unknown' }))
  const questions = selectAdaptiveQuestions(evaluation, { round: 2 })
  assert.equal(evaluation.context.findings.pregnancyPossible, 'unknown')
  assert.ok(!questions.some(({ id }) => id === 'pregnancyPossible'))
})

test('conflicting information prevents forced resolution', () => {
  const evaluation = evaluate(raw('RLQ', { migration: 'present' }, { conflicts: ['location conflict'] }))
  const questions = selectAdaptiveQuestions(evaluation, { round: 3 })
  const stop = evaluateStopCondition(evaluation, questions, 3)
  assert.equal(stop.stopReason, 'conflicting_information')
  assert.equal(stop.shouldStop, true)
})

test('major candidate survives presentation limit', () => {
  const evaluation = evaluate(raw('generalized', { severePain: 'present', painExamMismatch: 'present', atrialFibrillation: 'present', distension: 'present', vomiting: 'present', obstipation: 'present', recurrentCourse: 'present' }, { onsetSpeed: 'sudden' }))
  const stop = { shouldStop: true, stopReason: 'testing_required' }
  const presentation = buildPresentationModel(evaluation, stop)
  assert.ok(presentation.currentDifferentials.some(({ id }) => id === 'mesenteric_ischemia'))
})

test('presentation preserves raw candidates evidence unknown contradictions tests and examination hints', () => {
  const evaluation = evaluate(raw('epigastric', { backRadiation: 'present', nauseaVomiting: 'present', chestSymptoms: 'absent' }, { age: 68 }))
  const presentation = buildPresentationModel(evaluation, { shouldStop: true, stopReason: 'testing_required' })
  assert.strictEqual(presentation.rawCandidates, evaluation.candidates)
  assert.deepEqual(presentation.rawEvidence, evaluation.candidates.map(({ id, supportingFindings }) => ({ id, supportingFindings })))
  assert.deepEqual(presentation.rawUnknown, evaluation.candidates.map(({ id, unknownImportantFindings }) => ({ id, unknownImportantFindings })))
  assert.deepEqual(presentation.rawContradictions, evaluation.candidates.map(({ id, weakContradictions }) => ({ id, weakContradictions })))
  assert.deepEqual(presentation.rawTests, evaluation.candidates.flatMap(({ tests }) => tests))
  assert.deepEqual(presentation.rawExaminationHints, evaluation.candidates.flatMap(({ examHints }) => examHints))
})

test('primary remains the raw top candidate', () => {
  const evaluation = evaluate(raw('epigastric', { backRadiation: 'present', nauseaVomiting: 'present' }))
  const presentation = buildPresentationModel(evaluation, { shouldStop: true, stopReason: 'testing_required' })
  assert.equal(presentation.primaryDifferentials[0].id, evaluation.candidates[0].id)
  assert.equal(presentation.primaryDifferentials[0].rawRank, 1)
})

test('major candidates are individually visible above other differentials', () => {
  const scenarios = [
    raw('flank', { groinRadiation: 'present', severePain: 'present', vascularContext: 'present' }, { age: 82, onsetSpeed: 'sudden' }),
    raw('epigastric', { backRadiation: 'present', nauseaVomiting: 'present' }),
    raw('RLQ', { unilateralPain: 'present', nauseaVomiting: 'present' }, { age: 26, onsetSpeed: 'sudden' }),
    raw('epigastric', { chestSymptoms: 'absent', dyspnea: 'present', vascularContext: 'present' }, { age: 68 }),
  ]
  for (const input of scenarios) {
    const evaluation = evaluate(input)
    const presentation = buildPresentationModel(evaluation, { shouldStop: true, stopReason: 'testing_required' })
    const visible = new Set([...presentation.primaryDifferentials, ...presentation.importantCompetingDifferentials].map(({ id }) => id))
    for (const candidate of evaluation.candidates.filter(({ id }) => ['aortic_disease', 'mesenteric_ischemia', 'ectopic_pregnancy', 'GI_perforation', 'acute_coronary_syndrome'].includes(id))) assert.ok(visible.has(candidate.id))
  }
})

test('display evidence deduplicates atomic findings covered by a combination', () => {
  const evaluation = evaluate(FIXTURES[0][1])
  const presentation = buildPresentationModel(evaluation, { shouldStop: true, stopReason: 'testing_required' })
  const appendicitis = presentation.primaryDifferentials[0]
  assert.ok(appendicitis.displayEvidence.some((item) => item.includes('疼痛移動') && item.includes('臍周囲から発症')))
  assert.ok(!appendicitis.displayEvidence.includes('疼痛移動'))
  assert.ok(!appendicitis.displayEvidence.includes('臍周囲から発症'))
  assert.ok(appendicitis.supporting.includes('疼痛移動'))
})

test('candidate cards expose at most one important unknown while raw unknowns remain intact', () => {
  const evaluation = evaluate(raw('LLQ', { pregnancyPossible: 'unknown', vaginalBleeding: 'present' }, { age: 28 }))
  const presentation = buildPresentationModel(evaluation, { shouldStop: true, stopReason: 'testing_required' })
  for (const candidate of [...presentation.primaryDifferentials, ...presentation.importantCompetingDifferentials]) assert.ok(candidate.importantUnknown.length <= 1)
  assert.deepEqual(presentation.rawUnknown, evaluation.candidates.map(({ id, unknownImportantFindings }) => ({ id, unknownImportantFindings })))
})

test('suggested tests use exact-name deduplication only', () => {
  const evaluation = evaluate(raw('epigastric', { backRadiation: 'present', nauseaVomiting: 'present' }))
  const presentation = buildPresentationModel(evaluation, { shouldStop: true, stopReason: 'testing_required' })
  assert.equal(new Set(presentation.suggestedTests.map(({ name }) => name)).size, presentation.suggestedTests.length)
  for (const test of presentation.suggestedTests) assert.ok(evaluation.candidates.some((candidate) => candidate.tests.some(({ name }) => name === test.name)))
})

test('stop evaluator requests testing after strong combination', () => {
  const evaluation = evaluate(FIXTURES[0][1])
  const stop = evaluateStopCondition(evaluation, [], 2)
  assert.equal(stop.shouldStop, true)
  assert.equal(stop.stopReason, 'testing_required')
})

test('question selector never returns more than three questions', () => {
  const questions = selectAdaptiveQuestions(evaluate(raw('generalized')), { round: 1, limit: 99 })
  assert.ok(questions.length <= 3)
})

test('pregnancy context stays within the three-question cap', () => {
  const questions = selectAdaptiveQuestions(evaluate(raw('suprapubic', {}, { age: 28 })), { round: 1 })
  assert.ok(questions.length <= 3)
  assert.ok(questions.some(({ id }) => id === 'pregnancyPossible'))
})

test('multiple major candidates stay within the three-question cap', () => {
  const questions = selectAdaptiveQuestions(evaluate(raw('generalized', {}, { age: 78, onsetSpeed: 'sudden' })), { round: 1 })
  assert.ok(questions.length <= 3)
})

test('many general candidates stay within the three-question cap', () => {
  const questions = selectAdaptiveQuestions(evaluate(raw('RLQ')), { round: 1 })
  assert.ok(questions.length <= 3)
})

test('round two stays within the three-question cap', () => {
  const questions = selectAdaptiveQuestions(evaluate(raw('epigastric', { severePain: 'absent' })), { round: 2 })
  assert.ok(questions.length <= 3)
})

test('answered question is excluded from later selection', () => {
  const questions = selectAdaptiveQuestions(evaluate(raw('RLQ', { migration: 'present' })), { round: 2 })
  assert.ok(!questions.some(({ id }) => id === 'migration'))
})

test('answered unknown question is excluded from later selection', () => {
  const questions = selectAdaptiveQuestions(evaluate(raw('RLQ', { migration: 'unknown' })), { round: 2 })
  assert.ok(!questions.some(({ id }) => id === 'migration'))
})

test('answered not-assessed question is excluded from later selection', () => {
  const evaluation = evaluate(raw('RLQ', { migration: 'not_assessed' }))
  const firstRound = selectAdaptiveQuestions(evaluation, { round: 1 })
  const secondRound = selectAdaptiveQuestions(evaluation, { round: 2 })
  assert.ok(!firstRound.some(({ id }) => id === 'migration'))
  assert.ok(!secondRound.some(({ id }) => id === 'migration'))
})

const selectedIds = (input, round = 1) => selectAdaptiveQuestions(evaluate(input), { round }).map(({ id }) => id)

test('mesenteric ischemia context prioritizes mismatch and atrial fibrillation', () => {
  const selected = selectedIds(raw('periumbilical', {}, { age: 81, onsetSpeed: 'sudden' }))
  assert.deepEqual(selected, ['severePain', 'painExamMismatch', 'atrialFibrillation'])
})

test('appendiceal pattern prioritizes migration questions', () => {
  const selected = selectedIds(raw('RLQ', {}, { age: 24, onsetSpeed: 'rapid' }))
  assert.ok(selected.includes('initialPeriumbilical'))
  assert.ok(selected.includes('migration'))
})

test('biliary pattern prioritizes fever and jaundice over thoracic questions', () => {
  assert.deepEqual(selectedIds(raw('RUQ')), ['feverChills', 'jaundice', 'mealRelation'])
})

test('pancreatic pattern prioritizes back radiation and nausea over vascular questions', () => {
  const selected = selectedIds(raw('epigastric', {}, { age: 48, onsetSpeed: 'rapid' }))
  assert.deepEqual(selected.slice(0, 2), ['backRadiation', 'nauseaVomiting'])
})

test('obstruction pattern prioritizes bowel questions over metabolic questions', () => {
  assert.deepEqual(selectedIds(raw('generalized')), ['obstipation', 'distension', 'vomiting'])
})

test('stone pattern prioritizes radiation hematuria and fever', () => {
  assert.deepEqual(selectedIds(raw('flank', {}, { onsetSpeed: 'rapid' })), ['groinRadiation', 'hematuria', 'feverChills'])
})

test('right flank sudden pain in an older adult retains stone and aortic safety with a stone discriminator', () => {
  const evaluation = evaluate(raw('right_flank', {}, { age: 76, onsetSpeed: 'sudden' }))
  const questions = selectAdaptiveQuestions(evaluation, { round: 1 })
  assert.ok(ids(evaluation).includes('ureteral_stone'))
  assert.ok(ids(evaluation).includes('aortic_disease'))
  assert.ok(questions.some(({ id }) => ['groinRadiation', 'hematuria'].includes(id)))
  assert.ok(questions.length <= 3)
})

test('right flank radiation and hematuria supports ureteral stone', () => {
  assert.ok(ids(evaluate(raw('right_flank', { groinRadiation: 'present', hematuria: 'present' }))).includes('ureteral_stone'))
})

test('right flank fever retains stone and pyelonephritis differentiation', () => {
  const evaluation = evaluate(raw('right_flank', { feverChills: 'present' }))
  assert.ok(ids(evaluation).includes('ureteral_stone'))
  assert.ok(ids(evaluation).includes('pyelonephritis_or_systemic_UTI'))
  const questions = selectAdaptiveQuestions(evaluation, { round: 1 }).map(({ id }) => id)
  assert.ok(questions.includes('groinRadiation'))
  assert.ok(questions.includes('hematuria'))
  assert.ok(questions.length <= 3)
})

test('right upper quadrant fatty meal keeps biliary flow after flank expansion', () => {
  const evaluation = evaluate(raw('RUQ', { fattyMeal: 'present', mealRelation: 'present' }))
  assert.ok(ids(evaluation).includes('biliary_colic'))
  assert.deepEqual(selectAdaptiveQuestions(evaluation, { round: 1 }).map(({ id }) => id), ['feverChills', 'jaundice', 'nauseaVomiting'])
})

test('right lower quadrant migration keeps appendiceal flow after flank expansion', () => {
  const evaluation = evaluate(raw('RLQ', { migration: 'present', initialPeriumbilical: 'present' }))
  assert.ok(ids(evaluation).includes('acute_appendicitis'))
  assert.ok(selectAdaptiveQuestions(evaluation, { round: 1 }).some(({ id }) => id === 'nauseaVomiting'))
})

test('right upper quadrant sudden pain retains perforation with location and onset evidence trace', () => {
  const candidate = evaluate(raw('RUQ', {}, { onsetSpeed: 'sudden' })).candidates.find(({ id }) => id === 'GI_perforation')
  assert.ok(candidate)
  assert.deepEqual(candidate.supportingFindings.map(({ finding }) => finding), ['primaryLocation', 'onsetSpeed'])
})

test('urinary retention pattern is not occupied by gynecologic questions', () => {
  const selected = selectedIds(raw('suprapubic', {}, { age: 72 }))
  assert.ok(selected.includes('urinarySymptoms'))
  assert.ok(selected.includes('distension'))
  assert.equal(selected.filter((id) => ['pregnancyPossible', 'unilateralPain', 'vaginalBleeding'].includes(id)).length, 1)
})

test('recurrent generalized pain does not prioritize DKA questions', () => {
  const selected = selectedIds(raw('generalized', { recurrentCourse: 'present' }))
  assert.ok(!selected.includes('deepBreathing'))
  assert.ok(!selected.includes('diabetesContext'))
})

test('older flank pain retains aortic disease while selecting stone questions', () => {
  const evaluation = evaluate(raw('flank', { groinRadiation: 'present', vascularContext: 'present', severePain: 'present' }, { age: 82, onsetSpeed: 'sudden' }))
  assert.ok(ids(evaluation).includes('aortic_disease'))
})

test('pregnancy safety question remains early in young lower abdominal pain', () => {
  assert.ok(selectedIds(raw('LLQ', {}, { age: 27 })).includes('pregnancyPossible'))
})

test('epigastric tachypnea activates cardiopulmonary questions', () => {
  const selected = selectedIds(raw('epigastric', {}, { vitals: { ...vitals, RR: { value: 28 } } }))
  assert.ok(selected.includes('chestSymptoms'))
  assert.ok(selected.includes('dyspnea'))
})

test('generalized pain with tachypnea activates DKA questions', () => {
  const selected = selectedIds(raw('generalized', {}, { vitals: { ...vitals, RR: { value: 30 } } }))
  assert.deepEqual(selected, ['deepBreathing', 'diabetesContext', 'nauseaVomiting'])
})

test('question selection exposes an explainable trace', () => {
  const [question] = selectAdaptiveQuestions(evaluate(raw('RUQ')), { round: 1 })
  assert.ok(question.sourceCandidates.length > 0)
  assert.equal(question.priorityClass, 'HIGH')
  assert.equal(question.contextRelevance, 'HIGH')
  assert.match(question.selectionReason, /biliary_pattern/)
})

test('conflicting information stops after one confirmation round', () => {
  const evaluation = evaluate(raw('RLQ', {}, { conflicts: ['location conflict'] }))
  const stop = evaluateStopCondition(evaluation, selectAdaptiveQuestions(evaluation, { round: 2 }), 1)
  assert.equal(stop.shouldStop, true)
  assert.equal(stop.stopReason, 'conflicting_information')
})

test('older stone-like pain retains aortic disease and asks a stone discriminator in round one', () => {
  const evaluation = evaluate(raw('flank', { vascularContext: 'present' }, { age: 82, onsetSpeed: 'sudden' }))
  const questions = selectAdaptiveQuestions(evaluation, { round: 1 })
  assert.ok(ids(evaluation).includes('aortic_disease'))
  assert.ok(questions.some(({ id }) => ['groinRadiation', 'hematuria'].includes(id)))
  assert.ok(questions.filter(({ priorityClass }) => priorityClass === 'CRITICAL').length >= 2)
})

test('typical AAA keeps three early vascular safety questions when no pattern competes', () => {
  const questions = selectAdaptiveQuestions(evaluate(raw('generalized', {}, { age: 78, onsetSpeed: 'sudden' })), { round: 1 })
  assert.deepEqual(questions.map(({ id }) => id), ['severePain', 'painExamMismatch', 'atrialFibrillation'])
})

test('mesenteric ischemia keeps mismatch and atrial fibrillation after diversity rule', () => {
  const questions = selectAdaptiveQuestions(evaluate(raw('periumbilical', {}, { age: 81, onsetSpeed: 'sudden' })), { round: 1 })
  assert.ok(questions.some(({ id }) => id === 'painExamMismatch'))
  assert.ok(questions.some(({ id }) => id === 'atrialFibrillation'))
})

test('location conflict selects only conflict-specific clarification questions', () => {
  const evaluation = evaluate(raw('RLQ', {}, { conflicts: ['pain location and migration conflict'] }))
  const questions = selectAdaptiveQuestions(evaluation, { round: 1 })
  assert.deepEqual(questions.map(({ id }) => id), ['clarifyCurrentLocation', 'clarifyPainMigration'])
  assert.ok(questions.every(({ activePatterns }) => activePatterns.includes('conflict_clarification')))
})

test('resolved conflict resumes normal adaptive flow', () => {
  const evaluation = evaluate(raw('RLQ', { clarifyCurrentLocation: 'present', clarifyPainMigration: 'present' }, { conflicts: [] }))
  const questions = selectAdaptiveQuestions(evaluation, { round: 2 })
  assert.ok(questions.length > 0)
  assert.ok(questions.every(({ id }) => !id.startsWith('clarify')))
})

test('unresolved conflict stops after one clarification round', () => {
  const evaluation = evaluate(raw('RLQ', { clarifyCurrentLocation: 'indeterminate', clarifyPainMigration: 'indeterminate' }, { conflicts: ['unresolved location conflict'] }))
  const stop = evaluateStopCondition(evaluation, selectAdaptiveQuestions(evaluation, { round: 2 }), 1)
  assert.equal(stop.shouldStop, true)
  assert.equal(stop.stopReason, 'conflicting_information')
})

test('soft abdomen still retains perforation after stop refinement', () => {
  const evaluation = evaluate(raw('epigastric', { severePain: 'present', softAbdomen: 'present', peritonealSigns: 'absent' }, { onsetSpeed: 'sudden' }))
  assert.ok(ids(evaluation).includes('GI_perforation'))
})

test('perforation concern stops for examination instead of low-value round two', () => {
  const evaluation = evaluate(raw('epigastric', { severePain: 'present', softAbdomen: 'present' }, { onsetSpeed: 'sudden' }))
  const stop = evaluateStopCondition(evaluation, selectAdaptiveQuestions(evaluation, { round: 2 }), 1)
  assert.equal(stop.shouldStop, true)
  assert.equal(stop.stopReason, 'physical_exam_required')
})
