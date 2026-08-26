function App() {
  return (
    <main className="app-shell">
      <section className="card" aria-labelledby="page-title">
        <p className="eyebrow">Dr Ito Medical Hub</p>
        <h1 id="page-title">腹痛鑑別支援ツール</h1>
        <p className="description">
          腹痛の部位と臨床所見から<br className="mobile-break" />
          鑑別を整理する診療支援ツールです。
        </p>
        <div className="status" role="status">医学ロジック準備中</div>
        <p className="credit">制作：Dr Ito</p>
      </section>
    </main>
  )
}

export default App
