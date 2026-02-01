import { useState, useEffect, useRef } from 'react';
import './App.css';

interface PlayerState {
  id: number;
  position: [number, number] | { x: number, y: number };
  health: number;
  max_health: number;
}

interface ProjectileState {
  id: number;
  position: [number, number] | { x: number, y: number };
}

interface ServerEvent {
  Snapshot?: {
    tick: number;
    players: PlayerState[];
    projectiles: ProjectileState[];
  };
  PlayerJoined?: { id: number, position: [number, number] };
  PlayerLeft?: { id: number };
}

interface SnapshotWrapper {
  time: number;
  data: NonNullable<ServerEvent['Snapshot']>;
}

function App() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const snapshots = useRef<SnapshotWrapper[]>([]);
  const renderTimeOffset = 100; // ms

  // Game State for Render
  const renderState = useRef<{
    players: Map<number, { x: number, y: number, hp: number, max: number }>;
    projectiles: { x: number, y: number }[];
  }>({ players: new Map(), projectiles: [] });

  // Connect
  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  const connect = () => {
    if (wsRef.current) return;
    const ws = new WebSocket('ws://127.0.0.1:3000/ws');

    ws.onopen = () => {
      setConnected(true);
      log("Connected to server");
      // Send a Join command? Server generates ID on connection.
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (e) {
        log(`RX (Raw): ${event.data}`);
      }
    };

    ws.onclose = () => setConnected(false);
    wsRef.current = ws;
  };

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
    snapshots.current = [];
  };

  const handleServerMessage = (msg: any) => {
    if (msg.Snapshot) {
      snapshots.current.push({
        time: Date.now(),
        data: msg.Snapshot
      });
      // Prune old snapshots (keep last 1 sec)
      if (snapshots.current.length > 30) {
        snapshots.current.shift();
      }
    } else if (msg.PlayerJoined) {
      log(`Player ${msg.PlayerJoined.id} joined`);
    } else if (msg.PlayerLeft) {
      log(`Player ${msg.PlayerLeft.id} left`);
    }
  };

  // Interpolation Loop
  useEffect(() => {
    let animId: number;
    const loop = () => {
      updateRenderState();
      draw();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const getPos = (p: any) => { // Helper for Vec2
    if (Array.isArray(p.position)) return { x: p.position[0], y: p.position[1] };
    return { x: p.position.x, y: p.position.y };
  };

  const updateRenderState = () => {
    const now = Date.now();
    const renderTime = now - renderTimeOffset;

    const buffer = snapshots.current;
    if (buffer.length < 2) return; // Not enough data

    // Find snapshots surrounding renderTime
    let s1 = buffer[0];
    let s2 = buffer[1];

    // If we are falling behind, jump to latest
    if (renderTime > buffer[buffer.length - 1].time) {
      s1 = buffer[buffer.length - 1];
      s2 = s1;
    } else {
      for (let i = 0; i < buffer.length - 1; i++) {
        if (buffer[i].time <= renderTime && buffer[i + 1].time >= renderTime) {
          s1 = buffer[i];
          s2 = buffer[i + 1];
          break;
        }
      }
    }

    const t = (s1 === s2) ? 0 : (renderTime - s1.time) / (s2.time - s1.time);
    const clampedT = Math.max(0, Math.min(1, t));

    // Interpolate Players
    const newPlayers = new Map<number, any>();
    s2.data.players.forEach((p2) => {
      const p1 = s1.data.players.find(p => p.id === p2.id);
      if (p1) {
        const pos1 = getPos(p1);
        const pos2 = getPos(p2);
        const x = pos1.x + (pos2.x - pos1.x) * clampedT;
        const y = pos1.y + (pos2.y - pos1.y) * clampedT;
        newPlayers.set(p2.id, { x, y, hp: p2.health, max: p2.max_health });
      } else {
        const pos2 = getPos(p2);
        newPlayers.set(p2.id, { ...pos2, hp: p2.health, max: p2.max_health });
      }
    });
    renderState.current.players = newPlayers;

    // Projectiles (No interpolation for now, just snap to s2 or s1? Or linear?)
    // Projectiles are fast. Interpolating them is good.
    // But matching IDs is hard if we didn't give them stable IDs.
    // In main.rs, I used id: 0 for projectiles. So we can't interpolate them by ID easily.
    // Let's just render s2 projectiles for now to avoid ghosts.
    // Or better: s1 projectiles? s2 is "future" relative to render time. 
    // Let's use s1 projectiles to match the player state better.
    renderState.current.projectiles = s1.data.projectiles?.map(p => getPos(p)) || [];
  };

  const log = (msg: string) => setMessages(prev => [...prev.slice(-9), msg]);

  // Input Handling: Movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!connected) return;

      let dx = 0;
      let dy = 0;
      switch (e.key) {
        case 'w': dy = -1; break;
        case 's': dy = 1; break;
        case 'a': dx = -1; break;
        case 'd': dx = 1; break;
        default: return;
      }

      const cmd = { Move: { dir: [dx, dy] } };
      wsRef.current?.send(JSON.stringify(cmd));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connected]);

  // Input Handling: Combat (Mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    // Calculate world coordinates from click
    // Assuming 1:1 mapping directly
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Send CastSpell
    const cmd = {
      CastSpell: {
        target: [x, y]
      }
    };
    wsRef.current?.send(JSON.stringify(cmd));
  };

  // Render Loop
  const draw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, 800, 600);

    // Grid 
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 800; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 600); ctx.stroke(); }
    for (let y = 0; y <= 600; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke(); }

    // Draw Players
    renderState.current.players.forEach((p, id) => {
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fill();

      // ID
      ctx.fillStyle = 'white';
      ctx.font = "10px Arial";
      ctx.fillText(`ID:${id}`, p.x - 10, p.y - 15);

      // Health Bar
      const hpPct = p.hp / p.max;
      ctx.fillStyle = 'red';
      ctx.fillRect(p.x - 15, p.y - 25, 30, 4);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(p.x - 15, p.y - 25, 30 * hpPct, 4);
    });

    // Draw Projectiles
    ctx.fillStyle = '#f1c40f'; // Yellow
    renderState.current.projectiles.forEach((proj) => {
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  // Initial draw - removed, handled by loop
  // useEffect(() => draw(), []);

  return (
    <div className="app-container">
      <div className="header">
        <h1>MMO Client</h1>
        <span className={`status ${connected ? 'online' : 'offline'}`}>
          {connected ? 'CONNECTED (WASD to Move, Click to Shoot)' : 'DISCONNECTED'}
        </span>
      </div>

      <div className="game-area">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="game-canvas"
          onMouseDown={handleMouseDown}
        />
        <div className="terminal">
          {messages.map((m, i) => <div key={i}>{m}</div>)}
        </div>
      </div>
    </div>
  );
}

export default App;
