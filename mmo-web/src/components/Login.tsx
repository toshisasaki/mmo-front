import { useState } from 'react';
import './Login.css';

interface LoginProps {
    onJoin: (name: string) => void;
}

export function Login({ onJoin }: LoginProps) {
    const [name, setName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) onJoin(name);
    };

    return (
        <div className="login-overlay">
            <form onSubmit={handleSubmit} className="login-form">
                <h2>Enter World</h2>
                <input
                    autoFocus
                    type="text"
                    placeholder="Character Name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={12}
                />
                <button type="submit">Join Game</button>
            </form>
        </div>
    );
}
