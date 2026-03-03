'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@prisma/client';

export default function AddExpenseModal({
    eventId,
    users,
    onClose,
    currentUser,
    expense
}: {
    eventId: string,
    users: User[],
    onClose: () => void,
    currentUser: string | null,
    expense?: any // Using any for brevity in this specific task context, better type would be Expense with relations
}) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    // Initialize state from expense if editing
    const [formData, setFormData] = useState({
        name: expense?.name || '',
        amount: expense?.amount?.toString() || '',
        creatorId: expense?.creatorId || currentUser || (users.length > 0 ? users[0].id : ''),
        splitWithEveryone: expense ? expense.splitWithEveryone : true,
        splitUnequally: expense && expense.participants ? expense.participants.some((p: any) => p.amountOwed !== (expense.amount / expense.participants.length)) : false,
        unclaimed: expense?.unclaimed || false,
        date: expense?.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        notes: expense?.notes || ''
    });

    const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(
        expense
            ? expense.participants.map((p: any) => p.userId)
            : users.map(u => u.id)
    );

    const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
        expense && expense.participants.some((p: any) => p.amountOwed !== (expense.amount / expense.participants.length))
            ? expense.participants.reduce((acc: any, p: any) => ({ ...acc, [p.userId]: p.amountOwed.toString() }), {})
            : {}
    );

    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const totalAmount = parseFloat(formData.amount);
        if (!formData.name || isNaN(totalAmount)) return;

        let isUnclaimed = formData.unclaimed;
        if (!formData.splitWithEveryone && selectedParticipantIds.length === 0) {
            isUnclaimed = true;
        }

        if (formData.splitUnequally && !isUnclaimed) {
            const sum = Object.values(customAmounts).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
            if (Math.abs(sum - totalAmount) > 0.01) {
                setError(`The sum of individual shares ($${sum.toFixed(2)}) must equal the total amount ($${totalAmount.toFixed(2)})`);
                return;
            }
        }

        setIsLoading(true);

        try {
            const url = expense
                ? `/api/events/${eventId}/expenses/${expense.id}`
                : `/api/events/${eventId}/expenses`;

            const method = expense ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    unclaimed: isUnclaimed,
                    selectedParticipantIds: (formData.splitWithEveryone || isUnclaimed) ? [] : selectedParticipantIds,
                    customAmounts: (formData.splitUnequally && !isUnclaimed) ? customAmounts : null
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save expense');
            }

            router.refresh();
            onClose();
        } catch (err: any) {
            setError(err.message);
            setIsLoading(false);
        }
    };

    const handleSplitWithEveryoneChange = (checked: boolean) => {
        setError(null);
        setFormData({ ...formData, splitWithEveryone: checked, unclaimed: checked ? false : formData.unclaimed });
        if (!checked) {
            setSelectedParticipantIds([]);
        } else {
            setSelectedParticipantIds(users.map(u => u.id));
        }
    };

    const handleCustomAmountChange = (userId: string, value: string) => {
        setError(null);
        setCustomAmounts(prev => ({
            ...prev,
            [userId]: value
        }));
    };

    const toggleParticipant = (id: string) => {
        setError(null);
        setSelectedParticipantIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden overflow-x-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-border">
                    <h2 className="text-xl font-bold">{expense ? 'Edit Expense' : 'Add an Expense'}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-surface-hover transition-colors text-foreground/50 hover:text-foreground"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5 ml-1">Description</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Dinner, Groceries..."
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5 ml-1">Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5 ml-1">Amount ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="input-field font-mono text-lg"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                onBlur={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) setFormData({ ...formData, amount: Math.max(0, val).toFixed(2) });
                                }}
                                onWheel={(e) => e.currentTarget.blur()}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5 ml-1">Paid By</label>
                            <select
                                className="input-field appearance-none bg-surface"
                                value={formData.creatorId}
                                onChange={(e) => setFormData({ ...formData, creatorId: e.target.value })}
                                disabled={isLoading}
                            >
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="bg-surface-hover/50 rounded-xl p-4 border border-border space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                                    checked={formData.unclaimed}
                                    onChange={(e) => {
                                        setFormData({ ...formData, unclaimed: e.target.checked, splitWithEveryone: e.target.checked ? false : formData.splitWithEveryone });
                                        if (e.target.checked) setSelectedParticipantIds([]);
                                        setError(null);
                                    }}
                                    disabled={isLoading}
                                />
                                <div>
                                    <span className="block font-medium">Leave Unclaimed</span>
                                    <span className="block text-xs text-foreground/60 mt-0.5">No participants assigned, waiting for someone to claim</span>
                                </div>
                            </label>

                            {!formData.unclaimed && (
                                <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-border/50">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                                        checked={formData.splitWithEveryone}
                                        onChange={(e) => handleSplitWithEveryoneChange(e.target.checked)}
                                        disabled={isLoading}
                                    />
                                    <div>
                                        <span className="block font-medium">Split with everyone</span>
                                        <span className="block text-xs text-foreground/60 mt-0.5">Equally divides the cost among all {users.length} participants</span>
                                    </div>
                                </label>
                            )}

                            {!formData.splitWithEveryone && !formData.unclaimed && (
                                <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-border/50">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                                        checked={formData.splitUnequally}
                                        onChange={(e) => setFormData({ ...formData, splitUnequally: e.target.checked })}
                                        disabled={isLoading}
                                    />
                                    <div>
                                        <span className="block font-medium">Split unequally</span>
                                        <span className="block text-xs text-foreground/60 mt-0.5">Assign custom amounts to each participant</span>
                                    </div>
                                </label>
                            )}

                            {!formData.splitWithEveryone && !formData.unclaimed && (
                                <div className="mt-4 pt-4 border-t border-border animate-in slide-in-from-top-2 duration-300">
                                    <p className="text-xs font-bold uppercase text-foreground/40 mb-3 tracking-wider">
                                        {formData.splitUnequally ? 'Participant Shares' : 'Select Participants'}
                                    </p>
                                    <div className="space-y-2">
                                        {users.map(u => (
                                            <div key={u.id} className="flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleParticipant(u.id)}
                                                    className={`flex-1 flex items-center gap-2 p-2 rounded-lg text-sm transition-all border ${selectedParticipantIds.includes(u.id)
                                                        ? 'bg-primary/10 border-primary/30 text-primary'
                                                        : 'bg-surface border-transparent text-foreground/60'
                                                        }`}
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedParticipantIds.includes(u.id) ? 'bg-primary border-primary text-white' : 'border-border'
                                                        }`}>
                                                        {selectedParticipantIds.includes(u.id) && (
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-3 h-3">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <span className="truncate">{u.name}</span>
                                                </button>

                                                {formData.splitUnequally && selectedParticipantIds.includes(u.id) && (
                                                    <div className="relative w-32 flex-shrink-0">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-40">$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            className="input-field py-1 pl-8 text-sm font-mono h-9"
                                                            placeholder="0.00"
                                                            value={customAmounts[u.id] || ''}
                                                            onChange={(e) => handleCustomAmountChange(u.id, e.target.value)}
                                                            onBlur={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                if (!isNaN(val)) handleCustomAmountChange(u.id, Math.max(0, val).toFixed(2));
                                                            }}
                                                            onWheel={(e) => e.currentTarget.blur()}
                                                            disabled={isLoading}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5 ml-1">Notes (Optional)</label>
                            <textarea
                                className="input-field resize-none h-24"
                                placeholder="Add any additional details..."
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        {error && (
                            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium animate-in slide-in-from-top-1 duration-200">
                                <div className="flex items-start gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mt-0.5 flex-shrink-0">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                    </svg>
                                    <span>{error}</span>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn-primary w-full flex justify-center items-center"
                            disabled={isLoading || !formData.name || !formData.amount}
                        >
                            {isLoading ? 'Saving...' : (expense ? 'Update Expense' : 'Save Expense')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
