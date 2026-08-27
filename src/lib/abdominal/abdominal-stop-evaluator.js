export function evaluateStopCondition(evaluation, questions, round) {
  if (evaluation.conflicts.length) return { shouldStop: round >= 1 || questions.length === 0, stopReason: 'conflicting_information' }
  if (evaluation.insufficientInformation) return { shouldStop: questions.length === 0 || round >= 2, stopReason: 'insufficient_information' }
  const examinationCandidate = evaluation.candidates.find((candidate) => candidate.examHints.length > 0 && candidate.supportingFindings.some(({ finding, strength }) => finding !== 'primaryLocation' && ['MODERATE', 'STRONG_COMBINATION'].includes(strength)))
  if (examinationCandidate) return { shouldStop: true, stopReason: 'physical_exam_required' }
  if (questions.length > 0 && round < 2) return { shouldStop: false, stopReason: null }
  const top = evaluation.candidates[0]
  if (!top) return { shouldStop: true, stopReason: 'insufficient_information' }
  if (top.evidenceStrength === 'STRONG_COMBINATION') return { shouldStop: true, stopReason: top.tests.length ? 'testing_required' : 'candidate_supported' }
  if (top.examHints.length) return { shouldStop: true, stopReason: 'physical_exam_required' }
  return { shouldStop: round >= 2 || questions.length === 0, stopReason: top.tests.length ? 'testing_required' : 'candidate_supported' }
}
