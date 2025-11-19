import { useEffect, useRef, useState } from 'react'

// Simple top-down Pragia (tricycle) taxi game
// Drive, pick passengers, drop at stops, earn points.

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

export default function Game() {
  const canvasRef = useRef(null)
  const requestRef = useRef(null)
  const keysRef = useRef({})

  const [score, setScore] = useState(0)
  const [fuel, setFuel] = useState(100)
  const [timeLeft, setTimeLeft] = useState(120) // seconds
  const [picked, setPicked] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [level, setLevel] = useState(1)

  const world = useRef({
    width: 900,
    height: 520,
    roads: [],
    obstacles: [],
    stops: [],
    passengers: [],
  })

  const player = useRef({
    x: 120,
    y: 120,
    w: 28,
    h: 18,
    angle: 0,
    speed: 0,
    maxSpeed: 3.2,
    accel: 0.12,
    friction: 0.06,
    turnSpeed: 0.05,
  })

  const camera = useRef({ x: 0, y: 0 })

  // Initialize world: some rectangular roads, stops and obstacles
  const initWorld = (lvl = 1) => {
    const roads = [
      { x: 60, y: 80, w: 780, h: 80 },
      { x: 60, y: 260, w: 780, h: 80 },
      { x: 60, y: 440, w: 780, h: 80 },
      { x: 60, y: 80, w: 80, h: 440 },
      { x: 380, y: 80, w: 80, h: 440 },
      { x: 760, y: 80, w: 80, h: 440 },
    ]

    const obstacles = [
      { x: 240, y: 160, w: 80, h: 60 },
      { x: 560, y: 340, w: 80, h: 60 },
      { x: 240, y: 420, w: 80, h: 60 },
    ]

    // Stops are green pads along roads
    const stops = [
      { x: 110, y: 110, r: 18 },
      { x: 430, y: 150, r: 18 },
      { x: 790, y: 300, r: 18 },
      { x: 430, y: 470, r: 18 },
      { x: 110, y: 300, r: 18 },
      { x: 790, y: 110, r: 18 },
    ]

    // Passengers spawn near stops
    const passengers = spawnPassengers(stops, 3 + lvl)

    world.current = { width: 900, height: 520, roads, obstacles, stops, passengers }
  }

  const spawnPassengers = (stops, count) => {
    const arr = []
    for (let i = 0; i < count; i++) {
      const s = stops[Math.floor(Math.random() * stops.length)]
      const dest = stops[Math.floor(Math.random() * stops.length)]
      // Ensure dest different
      const destination = dest === s ? stops[(stops.indexOf(dest) + 1) % stops.length] : dest
      arr.push({ x: s.x + rand(-12, 12), y: s.y + rand(-12, 12), r: 8, picked: false, destination })
    }
    return arr
  }

  const rand = (a, b) => Math.random() * (b - a) + a

  // Input handlers
  useEffect(() => {
    const down = (e) => {
      keysRef.current[e.key.toLowerCase()] = true
      if (e.key === ' ') keysRef.current['space'] = true
    }
    const up = (e) => {
      keysRef.current[e.key.toLowerCase()] = false
      if (e.key === ' ') keysRef.current['space'] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // Timer
  useEffect(() => {
    if (gameOver) return
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setGameOver(true)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [gameOver])

  // Game loop
  useEffect(() => {
    initWorld(level)
    setScore(0)
    setFuel(100)
    setTimeLeft(120)
    setPicked(false)
    setGameOver(false)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const loop = () => {
      update()
      render(ctx, canvas)
      requestRef.current = requestAnimationFrame(loop)
    }

    requestRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(requestRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  const onRestart = () => {
    setLevel(1)
    initWorld(1)
    setGameOver(false)
    setScore(0)
    setFuel(100)
    setTimeLeft(120)
    setPicked(false)
    player.current = { ...player.current, x: 120, y: 120, angle: 0, speed: 0 }
  }

  const update = () => {
    if (gameOver) return

    const p = player.current

    const up = keysRef.current['arrowup'] || keysRef.current['w']
    const left = keysRef.current['arrowleft'] || keysRef.current['a']
    const down = keysRef.current['arrowdown'] || keysRef.current['s']
    const right = keysRef.current['arrowright'] || keysRef.current['d']

    if (up) p.speed = clamp(p.speed + p.accel, -p.maxSpeed, p.maxSpeed)
    if (down) p.speed = clamp(p.speed - p.accel * 0.9, -p.maxSpeed * 0.6, p.maxSpeed)

    if (!up && !down) {
      if (Math.abs(p.speed) < p.friction) p.speed = 0
      p.speed += p.speed > 0 ? -p.friction : p.friction
    }

    if (left) p.angle -= p.turnSpeed * (1 + Math.abs(p.speed) * 0.2)
    if (right) p.angle += p.turnSpeed * (1 + Math.abs(p.speed) * 0.2)

    const nx = p.x + Math.cos(p.angle) * p.speed
    const ny = p.y + Math.sin(p.angle) * p.speed

    // Collisions: keep on roads; hitting obstacles slows you and costs fuel
    if (isOnRoad(nx, ny, p.w, p.h)) {
      p.x = nx
      p.y = ny
    } else {
      p.speed *= -0.2
      setFuel((f) => Math.max(0, f - 1))
    }

    if (hitObstacle(p.x, p.y, p.w, p.h)) {
      p.speed *= 0.6
      setFuel((f) => Math.max(0, f - 0.4))
    }

    // Fuel consumption
    setFuel((f) => Math.max(0, f - Math.abs(p.speed) * 0.01))

    // Passenger pickup/drop
    const passenger = world.current.passengers.find((pa) => !pa.picked && dist(p.x, p.y, pa.x, pa.y) < 24)
    if (passenger && !picked) {
      // Press space to pick
      if (keysRef.current['space']) {
        passenger.picked = true
        setPicked(true)
      }
    }

    if (picked) {
      const carrying = world.current.passengers.find((pa) => pa.picked)
      if (carrying) {
        // Drop at destination stop
        const dstop = carrying.destination
        if (dist(p.x, p.y, dstop.x, dstop.y) < 26 && keysRef.current['space']) {
          carrying.done = true
          setPicked(false)
          setScore((s) => s + 10)
          setFuel((f) => clamp(f + 8, 0, 100))
        }
      }
    }

    // Remove completed passengers and respawn new when needed
    const remaining = world.current.passengers.filter((pa) => !pa.done)
    world.current.passengers = remaining
    if (remaining.length < 2) {
      const extra = spawnPassengers(world.current.stops, 2)
      world.current.passengers.push(...extra)
    }

    // Win/lose conditions
    if (fuel <= 0) setGameOver(true)

    camera.current.x = clamp(p.x - 450, 0, world.current.width - 900)
    camera.current.y = clamp(p.y - 260, 0, world.current.height - 520)
  }

  const render = (ctx, canvas) => {
    canvas.width = 900
    canvas.height = 520

    // Clear
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Background pattern
    drawCity(ctx)

    // Roads
    for (const r of world.current.roads) {
      ctx.fillStyle = '#2b364d'
      ctx.fillRect(r.x - camera.current.x, r.y - camera.current.y, r.w, r.h)
      // Lane lines
      ctx.strokeStyle = '#bcd3ff22'
      ctx.setLineDash([12, 10])
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(r.x - camera.current.x, r.y - camera.current.y + r.h / 2)
      ctx.lineTo(r.x - camera.current.x + r.w, r.y - camera.current.y + r.h / 2)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Obstacles
    for (const o of world.current.obstacles) {
      ctx.fillStyle = '#7c3aed'
      ctx.fillRect(o.x - camera.current.x, o.y - camera.current.y, o.w, o.h)
    }

    // Stops
    for (const s of world.current.stops) {
      ctx.fillStyle = '#16a34a'
      ctx.beginPath()
      ctx.arc(s.x - camera.current.x, s.y - camera.current.y, s.r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Passengers
    for (const pa of world.current.passengers) {
      if (pa.done) continue
      ctx.fillStyle = pa.picked ? '#f59e0b' : '#e11d48'
      ctx.beginPath()
      ctx.arc(pa.x - camera.current.x, pa.y - camera.current.y, pa.r, 0, Math.PI * 2)
      ctx.fill()
      if (pa.picked) {
        // Draw destination hint
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(pa.destination.x - camera.current.x, pa.destination.y - camera.current.y, 22, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Player (Pragia)
    drawPragia(ctx, player.current, camera.current)

    // HUD overlay
    drawHUD(ctx)

    if (gameOver) drawGameOver(ctx)
  }

  const drawCity = (ctx) => {
    // Subtle city grid
    ctx.fillStyle = '#0b1224'
    for (let i = 0; i < 900; i += 40) {
      ctx.fillRect(i, 0, 1, 520)
    }
    for (let j = 0; j < 520; j += 40) {
      ctx.fillRect(0, j, 900, 1)
    }
  }

  const drawPragia = (ctx, p, cam) => {
    ctx.save()
    ctx.translate(p.x - cam.x, p.y - cam.y)
    ctx.rotate(p.angle)

    // Body
    ctx.fillStyle = '#22d3ee' // cyan pragia body
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)

    // Cabin cover
    ctx.fillStyle = '#0ea5e9'
    ctx.fillRect(-p.w / 2 + 2, -p.h / 2, p.w - 4, p.h / 2)

    // Wheels
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(-p.w / 2 - 6, -p.h / 2 + 2, 4, 6)
    ctx.fillRect(p.w / 2 + 2, -p.h / 2 + 2, 4, 6)
    ctx.fillRect(-2, p.h / 2 - 3, 4, 6)

    // Headlight glow when moving
    if (Math.abs(p.speed) > 0.2) {
      const grad = ctx.createRadialGradient(18, 0, 0, 18, 0, 40)
      grad.addColorStop(0, 'rgba(250,250,210,0.6)')
      grad.addColorStop(1, 'rgba(250,250,210,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(18, 0, 40, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  const drawHUD = (ctx) => {
    // Score
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '16px Inter, system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText(`Score: ${score}`, 16, 24)
    ctx.fillText(`Fuel: ${fuel.toFixed(0)}%`, 16, 44)
    ctx.fillText(`Time: ${timeLeft}s`, 16, 64)
    ctx.fillText(picked ? 'Passenger: On board – drop at glowing stop! (Space)' : 'Find a passenger ● and press Space to pick', 16, 84)
    ctx.fillText('Drive: Arrow/WASD • Brake: S • Pick/Drop: Space', 16, 104)
  }

  const drawGameOver = (ctx) => {
    ctx.fillStyle = 'rgba(2,6,23,0.7)'
    ctx.fillRect(0, 0, 900, 520)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px Inter, system-ui'
    ctx.fillText('Game Over', 350, 220)
    ctx.font = '16px Inter, system-ui'
    ctx.fillText(`Final score: ${score}`, 380, 250)
    ctx.fillText('Press R to restart', 370, 280)
  }

  const isOnRoad = (x, y, w, h) => {
    const r = { x: x - w / 2, y: y - h / 2, w, h }
    return world.current.roads.some((road) => rectIntersects(r, road))
  }

  const hitObstacle = (x, y, w, h) => {
    const r = { x: x - w / 2, y: y - h / 2, w, h }
    return world.current.obstacles.some((o) => rectIntersects(r, o))
  }

  const rectIntersects = (a, b) => {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  }

  const dist = (x1, y1, x2, y2) => {
    const dx = x1 - x2
    const dy = y1 - y2
    return Math.hypot(dx, dy)
  }

  // Restart with R
  useEffect(() => {
    const handler = (e) => {
      if (e.key.toLowerCase() === 'r') onRestart()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white drop-shadow">Pragia Taxi</h1>
        <p className="text-blue-200/80 text-sm">Pick riders, drop at glowing stops, earn points!</p>
      </div>
      <div className="rounded-xl overflow-hidden border border-blue-500/20 shadow-2xl">
        <canvas ref={canvasRef} width={900} height={520} />
      </div>
      <div className="text-blue-200/70 text-xs">
        Tips: Stay on the road to save fuel. Collisions waste fuel. Press Space to pick and drop.
      </div>
      {gameOver && (
        <button
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
          onClick={onRestart}
        >
          Restart
        </button>
      )}
    </div>
  )
}
