'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@prisma/client';

export default function UserManagementModal({
    eventId,
    users,
    onClose,
    currentUser
}: {
    eventId: string,
    users: User[],
    onClose: () => void,
    currentUser: User | null
}) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [newName, setNewName] = useState('');
    const [error, setError] = useState('');

    const isAuthorized = currentUser?.role === 'Owner' || currentUser?.role === 'Admin';

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || !currentUser) return;

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`/api/events/${eventId}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName.trim(),
                    requesterId: currentUser.id
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to add user');
            }

            setNewName('');
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleAdmin = async (userId: string, currentRole: string) => {
        if (!currentUser) return;

        const newRole = currentRole === 'Admin' ? 'User' : 'Admin';

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`/api/events/${eventId}/users/${userId}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: newRole,
                    requesterId: currentUser.id
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update role');
            }

            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="glass w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="flex justify-between items-center p-6 border-b border-border">
                    <h2 className="text-xl font-bold">Manage Participants</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-surface-hover transition-colors text-foreground/50 hover:text-foreground"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    {/* Add User Form */}
                    {isAuthorized && (
                        <form onSubmit={handleAddUser} className="space-y-3">
                            <label className="text-sm font-medium ml-1">Add someone manually</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Friend's name"
                                    className="input-field flex-1"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    className="btn-primary py-2 px-4 whitespace-nowrap"
                                    disabled={isLoading || !newName.trim()}
                                >
                                    Add
                                </button>
                            </div>
                            {error && <p className="text-red-500 text-xs mt-1 ml-1">{error}</p>}
                        </form>
                    )}

                    {/* Users List */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase text-foreground/40 tracking-wider ml-1">
                            Current Participants ({users.length})
                        </h3>
                        <div className="space-y-2">
                            {users.map((user) => (
                                <div key={user.id} className="flex items-center justify-between p-3 rounded-2xl bg-surface-hover/30 border border-border/50">
                                    <div className="flex flex-col">
                                        <span className="font-medium">{user.name}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter w-fit ${user.role === 'Owner' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                            user.role === 'Admin' ? 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/20' :
                                                'bg-foreground/5 text-foreground/40 border border-border/50'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </div>

                                    {isAuthorized && user.role !== 'Owner' && (
                                        <button
                                            onClick={() => toggleAdmin(user.id, user.role)}
                                            disabled={isLoading}
                                            className={`text-xs font-medium px-3 py-1.5 rounded-xl transition-all ${user.role === 'Admin'
                                                ? 'bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/20'
                                                : 'bg-foreground/5 text-foreground/60 hover:bg-foreground/10'
                                                }`}
                                        >
                                            {user.role === 'Admin' ? 'Make Member' : 'Make Admin'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-surface-hover/20">
                    <p className="text-[10px] text-center text-foreground/40">
                        {isAuthorized
                            ? "As an Admin, you can add users and promote others."
                            : "Only Admins and the Owner can manage participants."}
                    </p>
                </div>
            </div>
        </div>
    );
}
