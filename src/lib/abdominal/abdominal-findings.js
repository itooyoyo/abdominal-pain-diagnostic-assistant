export const FINDING_STATES = Object.freeze(['present', 'absent', 'unknown', 'not_assessed', 'indeterminate'])
export const EVIDENCE_STRENGTH = Object.freeze({ STRONG_COMBINATION: 'STRONG_COMBINATION', MODERATE: 'MODERATE', WEAK: 'WEAK', CONTEXT: 'CONTEXT', DO_NOT_EXCLUDE: 'DO_NOT_EXCLUDE' })
export const MAJOR_CANDIDATE_IDS = Object.freeze(['aortic_disease', 'mesenteric_ischemia', 'ectopic_pregnancy', 'GI_perforation', 'acute_coronary_syndrome'])
export const LOCATIONS = Object.freeze([['epigastric', '心窩部'], ['RUQ', '右上腹部'], ['LUQ', '左上腹部'], ['periumbilical', '臍周囲'], ['RLQ', '右下腹部'], ['LLQ', '左下腹部'], ['suprapubic', '下腹部正中'], ['generalized', '腹部全体'], ['flank', '側腹部'], ['back', '背部'], ['other', 'その他'], ['indeterminate', '判定困難']])
export const ONSET_OPTIONS = Object.freeze([['sudden', '突然', '発症時点を示せる急な痛み'], ['rapid', '急速', '短時間のうちに強くなった痛み'], ['gradual', '徐々に', '時間をかけて始まった痛み'], ['unknown', '不明', '経過が分からない'], ['indeterminate', '評価不能', '確認しても判断できない']])
export function findingState(value) { return FINDING_STATES.includes(value) ? value : value == null || value === '' ? 'not_assessed' : value }
export function isPresent(context, key) { return context.findings[key] === 'present' || context.findings[key] === true }
export function isAbsent(context, key) { return context.findings[key] === 'absent' || context.findings[key] === false }
export function isUnknown(context, key) { return ['unknown', 'not_assessed', 'indeterminate'].includes(findingState(context.findings[key])) }
