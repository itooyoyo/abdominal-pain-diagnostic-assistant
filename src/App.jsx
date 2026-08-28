import { useEffect, useMemo, useRef, useState } from 'react'
import { LOCATIONS, ONSET_OPTIONS } from './lib/abdominal/abdominal-findings.js'
import { normalizeAbdominalInput } from './lib/abdominal/abdominal-input-adapter.js'
import { evaluateDifferential } from './lib/abdominal/abdominal-differential-engine.js'
import { selectAdaptiveQuestions } from './lib/abdominal/abdominal-question-selector.js'
import { evaluateStopCondition } from './lib/abdominal/abdominal-stop-evaluator.js'
import { buildPresentationModel } from './lib/abdominal/abdominal-presentation-model.js'

const VITALS = [['SBP', '収縮期血圧', 'mmHg'], ['DBP', '拡張期血圧', 'mmHg'], ['HR', '心拍数', '/min'], ['RR', '呼吸数', '/min'], ['SpO2', 'SpO₂', '%'], ['BT', '体温', '℃']]
const ANSWERS = [['present', 'あり'], ['absent', 'なし'], ['unknown', '不明'], ['not_assessed', '未評価'], ['indeterminate', '判定困難']]
const STRENGTH = { STRONG_COMBINATION: '複数所見で強く支持', MODERATE: '中等度の支持', WEAK: '弱い支持', CONTEXT: '関連context' }
const STOP = { testing_required: '問診だけでは絞り切れません。検査で鑑別を進めます', physical_exam_required: '次に身体診察で確認します', candidate_supported: '現在の情報から鑑別候補を整理しました', conflicting_information: '入力情報に矛盾があります。内容を再確認してください', insufficient_information: '判断に必要な情報が不足しています' }
const makeVitals = () => Object.fromEntries(VITALS.map(([key]) => [key, { value: '', status: 'not_assessed' }]))
const makeForm = () => ({ age: '', primaryLocation: '', onsetSpeed: '', vitals: makeVitals() })

function App() {
  const [form, setForm] = useState(makeForm)
  const [answers, setAnswers] = useState({})
  const [round, setRound] = useState(0)
  const [roundQuestions, setRoundQuestions] = useState([])
  const [screen, setScreen] = useState('initial')
  const [result, setResult] = useState(null)
  const resultHeadingRef = useRef(null)
  const evaluation = useMemo(() => evaluateDifferential(normalizeAbdominalInput({ ...form, answers })), [form, answers])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      if (screen === 'result') resultHeadingRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [screen, round])

  const setVital = (key, patch) => setForm((current) => ({ ...current, vitals: { ...current.vitals, [key]: { ...current.vitals[key], ...patch } } }))
  const start = (event) => { event.preventDefault(); setRound(1); setRoundQuestions(selectAdaptiveQuestions(evaluation, { round: 1 })); setScreen('questions') }
  const next = () => {
    const updated = evaluateDifferential(normalizeAbdominalInput({ ...form, answers }))
    const nextQuestions = selectAdaptiveQuestions(updated, { round: round + 1 })
    const stop = evaluateStopCondition(updated, nextQuestions, round)
    if (stop.shouldStop || round >= 2 || nextQuestions.length === 0) {
      setResult(buildPresentationModel(updated, { ...stop, shouldStop: true, stopReason: stop.stopReason ?? 'candidate_supported' }))
      setScreen('result')
    } else { setRoundQuestions(nextQuestions); setRound((value) => value + 1) }
  }
  const reset = () => { setForm(makeForm()); setAnswers({}); setRound(0); setRoundQuestions([]); setResult(null); setScreen('initial') }

  return <main className={`app-shell screen-${screen}`}>
    <header className="app-header"><div><p className="eyebrow">Dr Ito Medical Hub</p><h1>腹痛鑑別支援ツール</h1><p className="subtitle">少ない入力から、次に確認する情報と鑑別候補を整理します。</p></div><span className="badge">Prototype</span></header>
    <div className="scope-note">成人を対象とした検証用プロトタイプです。診断を確定するものではありません。</div>
    <Progress screen={screen} round={round} />

    {screen === 'initial' && <form id="initial-form" className="panel" onSubmit={start}>
      <Heading number="1" title="最初に確認すること" text="年齢、主な痛みの場所、発症とVitalを入力します。" />
      <section className="initial-section patient-section"><label className="field age-field">年齢<span className="input-suffix"><input type="number" min="18" max="120" inputMode="numeric" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} required />歳</span></label></section>
      <fieldset className="initial-section pain-location-section"><legend>主に痛む部位</legend><div className="choice-grid">{LOCATIONS.map(([value, label]) => <Choice key={value} name="location" selected={form.primaryLocation === value} onChange={() => setForm({ ...form, primaryLocation: value })} required>{label}</Choice>)}</div></fieldset>
      <fieldset className="initial-section onset-section"><legend>発症速度</legend><div className="onset-grid">{ONSET_OPTIONS.map(([value, label, help]) => <Choice key={value} name="onset" selected={form.onsetSpeed === value} onChange={() => setForm({ ...form, onsetSpeed: value })} required><strong>{label}</strong><small>{help}</small></Choice>)}</div></fieldset>
      <fieldset className="initial-section vital-section"><legend>Vital signs</legend><p className="field-help">実測値を入力してください。測定していない項目は「未測定」のまま進められます。</p><div className="vital-grid">{VITALS.map(([key, label, unit]) => { const vital = form.vitals[key]; const unmeasured = vital.status === 'not_assessed'; return <div className="vital-card" key={key}><label htmlFor={`v-${key}`}>{label}</label><div className="vital-input"><input id={`v-${key}`} type="number" step={key === 'BT' ? '.1' : '1'} inputMode="decimal" value={vital.value} disabled={unmeasured} onChange={(e) => setVital(key, { value: e.target.value, status: 'present' })} /><span>{unit}</span></div><label className="neutral-check"><input type="checkbox" checked={unmeasured} onChange={(e) => setVital(key, { status: e.target.checked ? 'not_assessed' : 'present', value: '' })} />未測定</label></div> })}</div></fieldset>
    </form>}

    {screen === 'questions' && <section className="panel">
      <Heading number="2" title="次に確認すること" text={`Round ${round}・現在の候補を分ける質問を最大3問表示しています。`} />
      <div className="question-list">{roundQuestions.map((question, index) => { const titleId = `question-${question.id}`; return <fieldset className="question-card" aria-labelledby={titleId} key={question.id}><h3 className="question-title" id={titleId}>{index + 1}. {question.label}</h3>{question.sensitive && <p className="privacy-note question-helper">必要な鑑別のため、この段階でのみ表示しています。</p>}<div className="answer-grid">{ANSWERS.map(([value, label]) => <Choice key={value} name={question.id} selected={answers[question.id] === value} onChange={() => setAnswers((current) => ({ ...current, [question.id]: value }))}>{label}</Choice>)}</div></fieldset> })}</div>
    </section>}

    {screen === 'result' && result && <ResultScreen result={result} reset={reset} headingRef={resultHeadingRef} />}
    <BottomAction screen={screen} round={round} questions={roundQuestions} answers={answers} onBack={() => setScreen('initial')} onNext={next} onReset={reset} />
    <footer>制作：Dr Ito</footer>
  </main>
}

function Heading({ number, title, text }) { return <div className="section-heading"><span>{number}</span><div><h2>{title}</h2><p>{text}</p></div></div> }
function Choice({ children, selected, name, onChange, required = false }) { return <label className={`choice ${selected ? 'selected' : ''}`}><input type="radio" name={name} checked={selected} onChange={onChange} required={required} /><span>{children}</span></label> }
function Info({ title, items }) { return <div><h4>{title}</h4><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div> }

function Progress({ screen, round }) {
  const active = screen === 'initial' ? 0 : screen === 'questions' ? 1 : 2
  const labels = ['基本情報', screen === 'questions' ? `追加確認 ${round}/2` : '追加確認', '結果']
  return <nav className="progress" aria-label="診療支援の進行状況">{labels.map((label, index) => <div className={`progress-step ${index === active ? 'active' : ''} ${index < active ? 'complete' : ''}`} aria-current={index === active ? 'step' : undefined} key={label}><span>{index < active ? '✓' : index + 1}</span><strong>{label}</strong></div>)}</nav>
}

function BottomAction({ screen, round, questions, answers, onBack, onNext, onReset }) {
  if (screen === 'initial') return <div className="bottom-action"><button className="primary" type="submit" form="initial-form">次へ</button></div>
  if (screen === 'questions') return <div className="bottom-action two-actions"><button className="secondary" type="button" onClick={onBack}>戻る</button><button className="primary" type="button" onClick={onNext} disabled={questions.some((question) => !answers[question.id])}>{round >= 2 ? '結果を見る' : '回答を反映'}</button></div>
  return <div className="bottom-action"><button className="secondary" type="button" onClick={onReset}>最初から入力</button></div>
}

function CandidateCard({ candidate, compact = false }) {
  return <article className={`candidate-card ${compact ? 'compact' : ''}`}>
    <div className="candidate-title"><span>{candidate.rawRank}</span><div><h3>{candidate.displayName}</h3><p>{candidate.category}・{STRENGTH[candidate.evidenceStrength]}</p></div></div>
    {candidate.displayEvidence.length > 0 && <Info title="根拠" items={candidate.displayEvidence} />}
    {candidate.importantUnknown.length > 0 && <p className="important-unknown"><strong>重要な未確認情報：</strong>{candidate.importantUnknown[0]}</p>}
    {(candidate.supporting.length > candidate.displayEvidence.length || candidate.weakContradictions.length > 0 || candidate.guards.length > 0) && <details className="candidate-details"><summary>詳細を確認</summary>{candidate.supporting.length > 0 && <Info title="保持している根拠" items={candidate.supporting} />}{candidate.weakContradictions.length > 0 && <Info title="典型的でない点" items={candidate.weakContradictions} />}{candidate.guards.length > 0 && <div className="guard-note">{candidate.guards.join('。')}</div>}</details>}
  </article>
}

function NextSteps({ result }) {
  if (result.examinationHints.length === 0 && result.suggestedTests.length === 0) return null
  const examFirst = result.stopReason === 'physical_exam_required'
  const exam = result.examinationHints.length > 0 && <Info title={examFirst ? '次に確認する身体所見' : '身体診察'} items={result.examinationHints} />
  const tests = result.suggestedTests.length > 0 && <div><h3>鑑別を進める検査</h3><ul>{result.suggestedTests.map((test) => <li key={test.name}><strong>{test.name}</strong><span>{test.level}</span></li>)}</ul></div>
  return <section className="panel next-steps"><h2>次に確認すること</h2>{examFirst ? <>{exam}{tests}</> : <>{tests}{exam}</>}</section>
}

function ResultScreen({ result, headingRef }) {
  const statusFirst = ['insufficient_information', 'conflicting_information'].includes(result.stopReason)
  const hasCandidates = result.primaryDifferentials.length > 0
  const candidateSections = <>
    {hasCandidates && <section className="panel primary-results"><h2>現在もっとも考えやすい鑑別</h2><div className="candidate-list">{result.primaryDifferentials.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} />)}</div></section>}
    {result.importantCompetingDifferentials.length > 0 && <section className="panel important-competitors"><h2>重要な競合候補</h2><div className="candidate-list">{result.importantCompetingDifferentials.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} compact />)}</div></section>}
    {result.supportingGroups.length > 0 && <section className="panel supporting-results"><h2>併せて考える鑑別</h2>{result.supportingGroups.map((group) => <div className="supporting-group" key={group.category}><h3>{group.category}</h3>{group.candidates.map((candidate) => <details key={candidate.id} className="supporting-candidate"><summary><span>{candidate.displayName}</span><small>{STRENGTH[candidate.evidenceStrength]}</small></summary><CandidateCard candidate={candidate} compact /></details>)}</div>)}</section>}
  </>
  return <section className="results-stack">
    <section className={`panel result-summary ${statusFirst ? 'status-alert' : ''}`}><p className="result-status">{STOP[result.stopReason] ?? '現在の情報から候補を整理しました'}</p>{statusFirst ? <><h2 ref={headingRef} tabIndex="-1">{result.stopReason === 'conflicting_information' ? '入力情報に矛盾があります' : '判断に必要な情報が不足しています'}</h2>{result.missingImportantInformation.length > 0 && <Info title={result.stopReason === 'conflicting_information' ? '矛盾内容・再確認項目' : '不足情報・再確認すべき入力'} items={result.missingImportantInformation} />}</> : <><h2 ref={headingRef} tabIndex="-1">現在もっとも考えやすい鑑別</h2><p className="summary-diagnoses">{result.summary.diagnoses.join('、') || '候補を十分に整理できません'}</p>{result.summary.reasons.length > 0 && <Info title="主な根拠" items={result.summary.reasons} />}{result.summary.nextAction && <p className="summary-action"><strong>次の確認：</strong>{result.summary.nextAction}</p>}</>}</section>
    {statusFirst ? <details className="panel reference-candidates"><summary>参考となる鑑別候補（{result.currentDifferentials.length}）</summary>{candidateSections}</details> : candidateSections}
    {!statusFirst && <NextSteps result={result} />}
    {!statusFirst && result.missingImportantInformation.length > 0 && <details className="panel missing"><summary>不足している重要情報（{result.missingImportantInformation.length}）</summary><ul>{result.missingImportantInformation.map((item) => <li key={item}>{item}</li>)}</ul></details>}
    {result.otherDifferentials.length > 0 && <details className="panel other-results"><summary>その他に考える鑑別（{result.otherDifferentials.length}）</summary><ul>{result.otherDifferentials.map((candidate) => <li key={candidate.id}>{candidate.displayName}</li>)}</ul></details>}
  </section>
}
export default App
