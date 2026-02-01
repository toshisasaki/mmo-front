import { EventEmitter } from './EventEmitter';

// Types matching Backend
export interface PlayerState {
    id: number;
    name: string;
    position: [number, number] | { x: number, y: number };
    health: number;
    max_health: number;
}

export interface ProjectileState {
    id: number;
    position: [number, number] | { x: number, y: number };
}

export interface ServerEvent {
    Snapshot?: {
        tick: number;
        players: PlayerState[];
        projectiles: ProjectileState[];
    };
    PlayerJoined?: { id: number, name: string, position: [number, number] };
    PlayerLeft?: { id: number };
    Chat?: { id: number, text: string };
}

export interface ClientCommand {
    Join?: { name: string };
    Move?: { dir: [number, number] };
    CastSpell?: { target: [number, number] };
    Chat?: { text: string };
}

export class NetworkManager extends EventEmitter {
    private ws: WebSocket | null = null;
    private url: string;

    constructor(url: string = 'ws://127.0.0.1:3000/ws') {
        super();
        this.url = url;
    }

    connect() {
        if (this.ws) return;
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('Connected');
            this.emit('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleMessage(msg);
            } catch (e) {
                console.error('Failed to parse message', event.data);
            }
        };

        this.ws.onclose = () => {
            console.log('Disconnected');
            this.emit('disconnected');
            this.ws = null;
        };
    }

    send(cmd: ClientCommand) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(cmd));
        }
    }

    disconnect() {
        this.ws?.close();
        this.ws = null;
    }

    private handleMessage(msg: any) {
        if (msg.Snapshot) {
            this.emit('snapshot', msg.Snapshot);
        } else if (msg.PlayerJoined) {
            this.emit('playerJoined', msg.PlayerJoined);
        } else if (msg.PlayerLeft) {
            this.emit('playerLeft', msg.PlayerLeft);
        } else if (msg.Chat) {
            this.emit('chat', msg.Chat);
        }
    }
}
