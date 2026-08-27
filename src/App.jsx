import { useMemo, useState } from 'react'
import { LOCATIONS, ONSET_OPTIONS } from './lib/abdominal/abdominal-findings.js'
import { normalizeAbdominalInput } from './lib/abdominal/abdominal-input-adapter.js'
import { evaluateDifferential } from './lib/abdominal/abdominal-differential-engine.js'
import { selectAdaptiveQuestions } from './lib/abdominal/abdominal-question-selector.js'
import { evaluateStopCondition } from './lib/abdominal/abdominal-stop-evaluator.js'
import { buildPresentationModel } from './lib/abdominal/abdominal-presentation-model.js'

const VITALS = [['SBP', '収縮期血圧', 'mmHg'], ['DBP', '拡張期血圧', 'mmHg'], ['HR', '心拍数', '/min'], ['RR', '呼吸数', '/min'], ['SpO2', 'SpO₂', '%'], ['BT', '体温', '℃']]
const ANSWERS = [['present', 'あり'], ['absent', 'なし'], ['unknown', '不明'], ['not_assessed', '未評価'], ['indeterminate', '判定困難']]
const STRENGTH = { STRONG_COMBINATION: '複数所見で強く支持', MODERATE: '中等度の支持', WEAK: '弱い支持', CONTEXT: '関連context' }
const STOP = { testing_required: '問診での追加分離より、検査による評価が必要です。', physical_exam_required: '次に身体診察による確認が必要です。', candidate_supported: '現在の情報で候補を整理しました。', conflicting_information: '矛盾する情報があり、無理に一つへ絞っていません。', insufficient_information: '候補整理に必要な情報が不足しています。' }
const makeVitals = () => Object.fromEntries(VITALS.map(([key]) => [key, { value: '', status: 'not_assessed' }]))
const makeForm = () => ({ age: '', primaryLocation: '', onsetSpeed: '', vitals: makeVitals() })

function App() {
  const [form, setForm] = useState(makeForm)
  const [answers, setAnswers] = useState({})
  const [round, setRound] = useState(0)
  const [roundQuestions, setRoundQuestions] = useState([])
  const [screen, setScreen] = useState('initial')
  const [result, setResult] = useState(null)
  const evaluation = useMemo(() => evaluateDifferential(normalizeAbdominalInput({ ...form, answers })), [form, answers])

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

  return <main className="app-shell">
    <header className="app-header"><div><p className="eyebrow">Dr Ito Medical Hub</p><h1>腹痛鑑別支援ツール</h1><p className="subtitle">少ない入力から、次に確認する情報と鑑別候補を整理します。</p></div><span className="badge">Prototype</span></header>
    <div className="scope-note">成人を対象とした検証用プロトタイプです。診断を確定するものではありません。</div>

    {screen === 'initial' && <form className="panel" onSubmit={start}>
      <Heading number="1" title="最初に確認すること" text="年齢、主な痛みの場所、発症とVitalを入力します。" />
      <label className="field age-field">年齢<span className="input-suffix"><input type="number" min="18" max="120" inputMode="numeric" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} required />歳</span></label>
      <fieldset><legend>主に痛む部位</legend><div className="choice-grid">{LOCATIONS.map(([value, label]) => <Choice key={value} name="location" selected={form.primaryLocation === value} onChange={() => setForm({ ...form, primaryLocation: value })} required>{label}</Choice>)}</div></fieldset>
      <fieldset><legend>発症速度</legend><div className="onset-grid">{ONSET_OPTIONS.map(([value, label, help]) => <Choice key={value} name="onset" selected={form.onsetSpeed === value} onChange={() => setForm({ ...form, onsetSpeed: value })} required><strong>{label}</strong><small>{help}</small></Choice>)}</div></fieldset>
      <fieldset><legend>Vital signs</legend><p className="field-help">実測値を入力してください。測定していない項目は「未測定」のまま進められます。</p><div className="vital-grid">{VITALS.map(([key, label, unit]) => { const vital = form.vitals[key]; const unmeasured = vital.status === 'not_assessed'; return <div className="vital-card" key={key}><label htmlFor={`v-${key}`}>{label}</label><div className="vital-input"><input id={`v-${key}`} type="number" step={key === 'BT' ? '.1' : '1'} inputMode="decimal" value={vital.value} disabled={unmeasured} onChange={(e) => setVital(key, { value: e.target.value, status: 'present' })} /><span>{unit}</span></div><label className="neutral-check"><input type="checkbox" checked={unmeasured} onChange={(e) => setVital(key, { status: e.target.checked ? 'not_assessed' : 'present', value: '' })} />未測定</label></div> })}</div></fieldset>
      <button className="primary" type="submit">次に確認することへ</button>
    </form>}

    {screen === 'questions' && <section className="panel">
      <Heading number="2" title="次に確認すること" text={`Round ${round}・現在の候補を分ける質問を最大3問表示しています。`} />
      <div className="question-list">{roundQuestions.map((question, index) => <fieldset className="question-card" key={question.id}><legend>{index + 1}. {question.label}</legend>{question.sensitive && <p className="privacy-note">必要な鑑別のため、この段階でのみ表示しています。</p>}<div className="answer-grid">{ANSWERS.map(([value, label]) => <Choice key={value} name={question.id} selected={answers[question.id] === value} onChange={() => setAnswers((current) => ({ ...current, [question.id]: value }))}>{label}</Choice>)}</div></fieldset>)}</div>
      <div className="button-row"><button className="secondary" onClick={() => setScreen('initial')}>戻る</button><button className="primary" onClick={next} disabled={roundQuestions.some((q) => !answers[q.id])}>{round >= 2 ? '結果を整理する' : '回答を反映する'}</button></div>
    </section>}

    {screen === 'result' && result && <section className="results-stack">
      <section className="panel"><Heading number="3" title="鑑別の整理" text={STOP[result.stopReason] ?? '現在の情報から候補を整理しました。'} /></section>
      <section className="panel"><h2>現在考えやすい鑑別</h2><div className="candidate-list">{result.currentDifferentials.length ? result.currentDifferentials.map((candidate, index) => <article className="candidate-card" key={candidate.id}><div className="candidate-title"><span>{index + 1}</span><div><h3>{candidate.displayName}</h3><p>{candidate.category}・{STRENGTH[candidate.evidenceStrength]}</p></div></div>{candidate.supporting.length > 0 && <Info title="支持する所見" items={candidate.supporting} />}{candidate.unknown.length > 0 && <Info title="まだ不明な重要所見" items={candidate.unknown.slice(0, 3)} />}{candidate.guards.length > 0 && <div className="guard-note">{candidate.guards.join('。')}</div>}</article>) : <p>現在の情報だけでは候補を十分に整理できません。</p>}</div></section>
      {(result.examinationHints.length > 0 || result.suggestedTests.length > 0) && <section className="panel next-steps"><h2>次に確認すること</h2>{result.examinationHints.length > 0 && <Info title="身体診察" items={result.examinationHints} />}{result.suggestedTests.length > 0 && <div><h3>鑑別を進める検査</h3><ul>{result.suggestedTests.map((test) => <li key={test.name}><strong>{test.name}</strong><span>{test.level}</span></li>)}</ul></div>}</section>}
      {result.missingImportantInformation.length > 0 && <section className="panel missing"><h2>不足している重要情報</h2><ul>{result.missingImportantInformation.map((item) => <li key={item}>{item}</li>)}</ul></section>}
      {result.otherDifferentials.length > 0 && <details className="panel"><summary>その他に考える鑑別</summary><ul>{result.otherDifferentials.map((candidate) => <li key={candidate.id}>{candidate.displayName}</li>)}</ul></details>}
      <button className="secondary restart" onClick={reset}>最初から入力する</button>
    </section>}
    <footer>制作：Dr Ito</footer>
  </main>
}

function Heading({ number, title, text }) { return <div className="section-heading"><span>{number}</span><div><h2>{title}</h2><p>{text}</p></div></div> }
function Choice({ children, selected, name, onChange, required = false }) { return <label className={`choice ${selected ? 'selected' : ''}`}><input type="radio" name={name} checked={selected} onChange={onChange} required={required} /><span>{children}</span></label> }
function Info({ title, items }) { return <div><h4>{title}</h4><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div> }
export default App
