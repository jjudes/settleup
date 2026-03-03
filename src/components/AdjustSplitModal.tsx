'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@prisma/client';

type Participant = {
    userId: string;
    amountOwed: number;
    user: User;
};

type ExpenseWithRelations = {
    id: string;
    name: string;
    amount: number;
    splitWithEveryone: boolean;
    participants: Participant[];
    [key: string]: any;
};

export default function AdjustSplitModal({
    eventId,
    expense,
    users,
    currentUserId,
    action,
    onClose
}: {
    eventId: string;
    expense: ExpenseWithRelations;
    users: User[];
    currentUserId: string;
    action: 'join' | 'leave';
    onClose: () => void;
}) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Build the initial participant list based on action
    const buildInitialParticipants = () => {
        const existingMap: Record<string, number> = {};
        expense.participants.forEach(p => {
            existingMap[p.userId] = p.amountOwed;
        });

        if (action === 'join') {
            // Add user with $0 — they need to adjust
            existingMap[currentUserId] = 0;
        } else {
            // Remove the user
            delete existingMap[currentUserId];
        }

        return existingMap;
    };

    const [amounts, setAmounts] = useState<Record<string, string>>(() => {
        const initial = buildInitialParticipants();
        const result: Record<string, string> = {};
        Object.entries(initial).forEach(([uid, val]) => {
            result[uid] = val.toFixed(2);
        });
        return result;
    });

    const participantUserIds = Object.keys(amounts);
    const participantUsers = users.filter(u => participantUserIds.includes(u.id));

    const currentTotal = Object.values(amounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    const remaining = expense.amount - currentTotal;
    const isValid = Math.abs(remaining) < 0.01;

    const handleSave = async () => {
        if (!isValid) {
            setError(`Amounts must sum to $${expense.amount.toFixed(2)}. Currently ${remaining > 0 ? `$${remaining.toFixed(2)} remaining` : `$${Math.abs(remaining).toFixed(2)} over`}.`);
            return;
        }

        setError(null);
        setIsLoading(true);

        try {
            // Build participants array for PATCH
            const participants = Object.entries(amounts).map(([userId, amount]) => ({
                userId,
                amountOwed: parseFloat(amount)
            }));

            const response = await fetch(`/api/events/${eventId}/expenses/${expense.id}?userId=${currentUserId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: expense.name,
                    amount: expense.amount,
                    creatorId: expense.creatorId,
                    splitWithEveryone: action === 'leave' && expense.splitWithEveryone ? false : expense.splitWithEveryone,
                    splitUnequally: true,
                    date: expense.date,
                    notes: expense.notes || '',
                    selectedParticipantIds: participantUserIds,
                    customAmounts: amounts,
                    payers: expense.payers?.map((p: any) => ({
                        userId: p.userId,
                        amount: p.amount
                    })) || [{ userId: expense.creatorId, amount: expense.amount }]
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update expense');
            }

            router.refresh();
            onClose();
        } catch (err: any) {
            setError(err.message);
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-md rounded-3xl shadow-2xl overflow-hidden overflow-x-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-border">
                    <div>
                        <h2 className="text-xl font-bold">
                            {action === 'join' ? 'Join' : 'Leave'} Expense
                        </h2>
                        <p className="text-sm text-foreground/60 mt-0.5">
                            Adjust split for <span className="font-bold text-foreground">{expense.name}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-surface-hover transition-colors text-foreground/50 hover:text-foreground"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-5">
                    {/* Total info */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                        <span className="text-sm font-medium text-foreground/70">Total Amount</span>
                        <span className="text-xl font-black text-primary">${expense.amount.toFixed(2)}</span>
                    </div>

                    {/* Participant amounts */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-foreground/60">
                            Amount per person
                        </label>
                        {participantUsers.map(user => (
                            <div key={user.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-[120px]">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-secondary text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-bold flex-1 truncate">
                                        {user.name}
                                        {user.id === currentUserId && (
                                            <span className="ml-1.5 text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-[4px] font-black uppercase tracking-tighter">
                                                {action === 'join' ? 'New' : 'Leaving'}
                                            </span>
                                        )}
                                    </span>
                                </div>
                                <div className="relative w-full sm:w-28 mt-1 sm:mt-0">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 font-bold text-sm">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={amounts[user.id] || ''}
                                        onChange={(e) => setAmounts(prev => ({ ...prev, [user.id]: e.target.value }))}
                                        onBlur={(e) => {
                                            const val = parseFloat(e.target.value);
                                            if (!isNaN(val)) setAmounts(prev => ({ ...prev, [user.id]: Math.max(0, val).toFixed(2) }));
                                        }}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        className="input-field text-right pl-8 py-2 text-sm w-full"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Running total */}
                    <div className={`flex items-center justify-between p-3 rounded-xl border ${isValid
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600'
                        : 'bg-amber-500/5 border-amber-500/20 text-amber-600'
                        }`}>
                        <span className="text-sm font-medium">
                            {isValid ? '✓ Amounts match' : remaining > 0 ? 'Remaining' : 'Over by'}
                        </span>
                        <span className="text-lg font-black">
                            {isValid ? `$${expense.amount.toFixed(2)}` : `$${Math.abs(remaining).toFixed(2)}`}
                        </span>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium">
                            <div className="flex items-start gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mt-0.5 flex-shrink-0">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 glass py-2.5 rounded-xl text-sm font-semibold border-2 border-border hover:border-foreground/30 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isLoading || !isValid}
                            className="flex-1 btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Saving...' : 'Save Split'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
