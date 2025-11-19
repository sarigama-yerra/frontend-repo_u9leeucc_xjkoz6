import Game from './components/Game'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.08),transparent_55%)] pointer-events-none" />

      <div className="relative min-h-screen flex flex-col items-center gap-6 p-6">
        <header className="pt-4 text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/flame-icon.svg" alt="Flames" className="w-14 h-14 drop-shadow-[0_0_20px_rgba(59,130,246,0.45)]" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Pragia Taxi</h1>
          <p className="text-blue-200/80 mt-1">A simple tricycle taxi game — pick riders, drop them, earn points.</p>
        </header>

        <main className="w-full max-w-5xl flex-1 flex items-center justify-center">
          <Game />
        </main>

        <footer className="text-blue-200/60 text-xs pb-4 text-center">
          Controls: Arrow keys or WASD to drive • Space to pick/drop • R to restart
        </footer>
      </div>
    </div>
  )
}

export default App
