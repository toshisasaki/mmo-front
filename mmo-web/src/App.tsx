import { useState, useEffect, useRef } from 'react';
import { NetworkManager } from './NetworkManager';
import { GameEngine } from './GameEngine';
import { Login } from './components/Login';
import { Chat } from './components/Chat';
import './App.css';

function App() {
  const [gameState, setGameState] = useState<'LOGIN' | 'PLAYING'>('LOGIN');
  const networkRef = useRef<NetworkManager | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize Systems
  useEffect(() => {
    const net = new NetworkManager();
    const engine = new GameEngine(net);

    networkRef.current = net;
    engineRef.current = engine;

    net.connect();

    // Listen for join confirmation (optional, for now trust the client flow)
    // Could listen for "PlayerJoined" with my name to confirm ID.

    return () => {
      engine.stop();
      net.disconnect();
    };
  }, []);

  const handleJoin = (name: string) => {
    if (!networkRef.current) return;

    networkRef.current.send({ Join: { name } });
    setGameState('PLAYING');

    // Slight delay to allow canvas mount
    setTimeout(() => {
      if (canvasRef.current && engineRef.current) {
        engineRef.current.setCanvas(canvasRef.current);
      }
    }, 100);
  };

  return (
    <div className="app-container">
      {gameState === 'LOGIN' && <Login onJoin={handleJoin} />}

      {gameState === 'PLAYING' && (
        <div className="game-area">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="game-canvas"
          />
          {networkRef.current && <Chat network={networkRef.current} />}
        </div>
      )}
    </div>
  );
}

export default App;
