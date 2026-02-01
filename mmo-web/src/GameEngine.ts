import { NetworkManager, type ServerEvent } from './NetworkManager';

export class GameEngine {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private network: NetworkManager;
    private animationId: number = 0;

    // State
    private snapshots: { time: number, data: NonNullable<ServerEvent['Snapshot']> }[] = [];
    private renderState = {
        players: new Map<number, { x: number, y: number, hp: number, max: number, name: string }>(),
        projectiles: [] as { x: number, y: number }[]
    };


    // Config
    private renderTimeOffset = 100;

    constructor(network: NetworkManager) {
        this.network = network;
        this.network.on('snapshot', (snap: any) => this.onSnapshot(snap));
    }

    setCanvas(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.startLoop();
        this.setupInput();
    }



    private onSnapshot(snapshot: any) {
        this.snapshots.push({
            time: Date.now(),
            data: snapshot
        });
        // Prune
        if (this.snapshots.length > 30) this.snapshots.shift();
    }

    private startLoop() {
        const loop = () => {
            this.update();
            this.draw();
            this.animationId = requestAnimationFrame(loop);
        };
        this.animationId = requestAnimationFrame(loop);
    }

    stop() {
        cancelAnimationFrame(this.animationId);
    }

    private getPos(p: any) {
        if (Array.isArray(p.position)) return { x: p.position[0], y: p.position[1] };
        return { x: p.position.x, y: p.position.y };
    }

    private update() {
        const now = Date.now();
        const renderTime = now - this.renderTimeOffset;

        const buffer = this.snapshots;
        if (buffer.length < 2) return;

        let s1 = buffer[0];
        let s2 = buffer[1];

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

        const newPlayers = new Map<number, any>();
        s2.data.players.forEach((p2) => {
            const p1 = s1.data.players.find(p => p.id === p2.id);
            if (p1) {
                const pos1 = this.getPos(p1);
                const pos2 = this.getPos(p2);
                const x = pos1.x + (pos2.x - pos1.x) * clampedT;
                const y = pos1.y + (pos2.y - pos1.y) * clampedT;
                newPlayers.set(p2.id, { x, y, hp: p2.health, max: p2.max_health, name: p2.name });
            } else {
                const pos2 = this.getPos(p2);
                newPlayers.set(p2.id, { ...pos2, hp: p2.health, max: p2.max_health, name: p2.name });
            }
        });
        this.renderState.players = newPlayers;
        this.renderState.projectiles = s1.data.projectiles?.map(p => this.getPos(p)) || [];
    }

    private draw() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const { width, height } = this.canvas;

        // Clear
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, width, height);

        // Grid
        ctx.strokeStyle = '#34495e';
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
        for (let y = 0; y <= height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

        // Players
        this.renderState.players.forEach((p, id) => {
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
            ctx.fill();

            // ID & Name
            ctx.fillStyle = 'white';
            ctx.font = "10px Arial";
            ctx.textAlign = "center";
            ctx.fillText(p.name || `ID:${id}`, p.x, p.y - 15);

            // Health Bar
            const hpPct = p.hp / p.max;
            ctx.fillStyle = 'red';
            ctx.fillRect(p.x - 15, p.y - 25, 30, 4);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(p.x - 15, p.y - 25, 30 * hpPct, 4);
        });

        // Projectiles
        ctx.fillStyle = '#f1c40f';
        this.renderState.projectiles.forEach((proj) => {
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    private setupInput() {
        if (!this.canvas) return;

        // Keyboard
        window.addEventListener('keydown', (e) => {
            let dx = 0, dy = 0;
            switch (e.key) {
                case 'w': dy = -1; break;
                case 's': dy = 1; break;
                case 'a': dx = -1; break;
                case 'd': dx = 1; break;
                default: return;
            }
            this.network.send({ Move: { dir: [dx, dy] } });
        });

        // Mouse
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.network.send({ CastSpell: { target: [x, y] } });
        });
    }
}
