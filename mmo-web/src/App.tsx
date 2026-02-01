import { useState, useEffect, useRef } from 'react';
import './App.css';

// Simple types mirroring Rust shared types
interface ClientCommand {
  type: 'Move';
  dx: number;
  dy: number;
}

function App() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerPos = useRef({ x: 400, y: 300 }); // Center of 800x600

  // Connect
  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  const connect = () => {
    if (wsRef.current) return;
    const ws = new WebSocket('ws://localhost:3000/ws');

    ws.onopen = () => {
      setConnected(true);
      log("Connected to server");
    };
    ws.onmessage = (event) => log(`RX: ${event.data}`);
    ws.onclose = () => setConnected(false);
    wsRef.current = ws;
  };

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
  };

  const log = (msg: string) => setMessages(prev => [...prev.slice(-9), msg]);

  // Input Handling
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

      // 1. Send to Server
      const cmd = { type: 'Move', dx, dy }; // Simplified JSON
      wsRef.current?.send(JSON.stringify(cmd));

      // 2. Client-side prediction (visual only for now)
      playerPos.current.x += dx * 10;
      playerPos.current.y += dy * 10;
      draw();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connected]);

  // Render Loop
  const draw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, 800, 600);

    // Grid (AOI visualization)
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 800; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 600); ctx.stroke(); }
    for (let y = 0; y <= 600; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke(); }

    // Player
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(playerPos.current.x, playerPos.current.y, 10, 0, Math.PI * 2);
    ctx.fill();
  };

  // Initial draw
  useEffect(() => draw(), []);

  return (
    <div className="app-container">
      <div className="header">
        <h1>MMO Client</h1>
        <span className={`status ${connected ? 'online' : 'offline'}`}>
          {connected ? 'CONNECTED (WASD to Move)' : 'DISCONNECTED'}
        </span>
      </div>

      <div className="game-area">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="game-canvas"
        />
        <div className="terminal">
          {messages.map((m, i) => <div key={i}>{m}</div>)}
        </div>
      </div>
    </div>
  );
}

export default App;
