'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function JoinEventPage() {
    const params = useParams();
    const eventId = params.eventId as string;
    const router = useRouter();

    const [event, setEvent] = useState<any>(null);
    const [userName, setUserName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchEvent() {
            try {
                const res = await fetch(`/api/events/${eventId}`);
                if (!res.ok) throw new Error('Event not found');
                const data = await res.json();
                setEvent(data);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        fetchEvent();
    }, [eventId]);

    const handleJoin = async (selectedName?: string) => {
        setError(null);
        const finalName = selectedName || userName.trim();
        if (!finalName) return;

        setIsJoining(true);

        try {
            const res = await fetch(`/api/events/${eventId}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: finalName,
                    isExistingUserClick: !!selectedName
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to join');
            }

            const data = await res.json();

            // Store user info in localStorage
            localStorage.setItem(`settleup_user_${eventId}`, JSON.stringify({
                id: data.user.id,
                name: data.user.name
            }));

            router.push(`/${eventId}`);
        } catch (err: any) {
            setError(err.message);
            setIsJoining(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 text-center">
                <div className="glass p-8 rounded-3xl max-w-sm">
                    <h1 className="text-2xl font-bold mb-4">Event Not Found</h1>
                    <p className="text-foreground/60 mb-6">The link you followed might be broken or the event was deleted.</p>
                    <button onClick={() => router.push('/')} className="btn-primary w-full">Go Home</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float"></div>

            <main className="w-full max-w-md z-10">
                <div className="glass rounded-3xl p-8 shadow-2xl">
                    <h1 className="text-3xl font-bold tracking-tight mb-2 text-center">Join Event</h1>
                    <p className="text-foreground/70 mb-8 text-center">
                        You've been invited to <span className="text-foreground font-bold">{event.name}</span>
                    </p>

                    {event.users.length > 0 && (
                        <div className="mb-8">
                            <label className="block text-sm font-medium mb-3 ml-1 text-foreground/60">
                                Are you already in this event?
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {event.users.map((user: any) => (
                                    <button
                                        key={user.id}
                                        onClick={() => handleJoin(user.name)}
                                        disabled={isJoining}
                                        className="flex items-center gap-3 p-3 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-xs font-bold group-hover:bg-primary group-hover:text-white transition-colors">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-medium text-sm truncate">{user.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="relative mb-8">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-border"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-3 bg-surface text-foreground/40 font-medium rounded-full">Or join as someone new</span>
                        </div>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); handleJoin(); }} className="space-y-5">
                        <div>
                            <label htmlFor="newName" className="block text-sm font-medium mb-1.5 ml-1 text-foreground/80">
                                What's your name?
                            </label>
                            <input
                                id="newName"
                                type="text"
                                placeholder="e.g. Sarah"
                                className="input-field"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                required
                                disabled={isJoining}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-primary w-full flex justify-center items-center"
                            disabled={isJoining || !userName.trim()}
                        >
                            {isJoining ? 'Joining...' : 'Join Event'}
                        </button>

                        {error && (
                            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium animate-in slide-in-from-top-1 duration-200">
                                <div className="flex items-start gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mt-0.5 flex-shrink-0">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                    </svg>
                                    <span>{error}</span>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </main>
        </div>
    );
}
