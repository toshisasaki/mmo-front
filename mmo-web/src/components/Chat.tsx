import { useState, useEffect, useRef } from 'react';
import { NetworkManager } from '../NetworkManager';
import './Chat.css';

interface ChatProps {
    network: NetworkManager;
}

export function Chat({ network }: ChatProps) {
    const [messages, setMessages] = useState<{ id: number, text: string }[]>([]);
    const [input, setInput] = useState('');
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onChat = (msg: { id: number, text: string }) => {
            setMessages(prev => [...prev, msg].slice(-50));
        };
        network.on('chat', onChat);
        return () => network.off('chat', onChat);
    }, [network]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        network.send({ Chat: { text: input } });
        setInput('');
    };

    return (
        <div className="chat-container">
            <div className="chat-messages">
                {messages.map((m, i) => (
                    <div key={i} className="chat-msg">
                        <span className="chat-id">#{m.id}:</span> {m.text}
                    </div>
                ))}
                <div ref={endRef} />
            </div>
            <form onSubmit={send} className="chat-input-form">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Press Enter to chat..."
                />
            </form>
        </div>
    );
}
