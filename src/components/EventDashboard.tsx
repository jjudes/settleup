'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AddExpenseModal from './AddExpenseModal';
import AdjustSplitModal from './AdjustSplitModal';
import UserManagementModal from './UserManagementModal';
import ScanReceiptModal from './ScanReceiptModal';
import { Event, User, Expense, ExpensePayer, ExpenseParticipant } from '@prisma/client';
import { simplifyDebts, calculateUserSummaries } from '@/lib/balances';

type EventWithRelations = Event & {
    users: User[];
    expenses: (Expense & {
        creator: User;
        payers: (ExpensePayer & { user: User })[];
        participants: (ExpenseParticipant & { user: User })[];
    })[];
};

export default function EventDashboard({ event }: { event: EventWithRelations }) {
    const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
    const [isScanReceiptOpen, setIsScanReceiptOpen] = useState(false);
    const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<EventWithRelations['expenses'][number] | null>(null);
    const [viewingNoteExpense, setViewingNoteExpense] = useState<EventWithRelations['expenses'][number] | null>(null);
    const [adjustingSplit, setAdjustingSplit] = useState<{ expense: EventWithRelations['expenses'][number]; action: 'join' | 'leave' } | null>(null);
    const [copyFeedback, setCopyFeedback] = useState(false);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const router = useRouter();

    // Initialize current user from localStorage or find Owner
    useEffect(() => {
        const storedJson = localStorage.getItem(`settleup_user_${event.id}`);
        let storedId: string | null = null;

        try {
            if (storedJson) {
                const parsed = JSON.parse(storedJson);
                storedId = parsed.id || null;
            }
        } catch (e) {
            // Fallback for old simple string format
            storedId = storedJson;
        }

        if (storedId && event.users.find(u => u.id === storedId)) {
            setCurrentUserId(storedId);
        } else {
            // If no valid session, default to the Owner
            const owner = event.users.find(u => u.role === 'Owner');
            if (owner) {
                setCurrentUserId(owner.id);
                localStorage.setItem(`settleup_user_${event.id}`, JSON.stringify({
                    id: owner.id,
                    name: owner.name
                }));
            }
        }
    }, [event.id, event.users]);

    const currentUser = useMemo(() =>
        event.users.find(u => u.id === currentUserId) || event.users.find(u => u.role === 'Owner') || null
        , [event.users, currentUserId]);

    const isAuthorized = currentUser?.role === 'Owner' || currentUser?.role === 'Admin';

    const payments = useMemo(() => simplifyDebts(event.users, event.expenses), [event]);
    const summaries = useMemo(() => calculateUserSummaries(event.users, event.expenses), [event]);

    const handleCopyLink = () => {
        const link = `${window.location.origin}/${event.id}/join`;
        navigator.clipboard.writeText(link);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
    };

    const handleDeleteExpense = async (expenseId: string) => {
        if (!confirm('Are you sure you want to delete this expense?')) return;

        try {
            const response = await fetch(`/api/events/${event.id}/expenses/${expenseId}?userId=${currentUserId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete expense');
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Failed to delete expense');
        }
    };

    const handleToggleParticipation = async (expenseId: string, action: 'join' | 'leave') => {
        if (!currentUserId) return;

        try {
            const response = await fetch(`/api/events/${event.id}/expenses/${expenseId}/participate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId, action })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || `Failed to ${action} expense`);
            }

            router.refresh();
        } catch (error: any) {
            console.error(error);
            alert(error.message);
        }
    };

    return (
        <div className="min-h-screen p-6 max-w-5xl mx-auto bg-premium">
            <header className="mb-8 border-b border-border pb-6">
                {/* Row 1: Event Name, Invite Link, User icon */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h1 className="text-4xl font-bold tracking-tight">{event.name}</h1>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleCopyLink}
                            className="bg-primary/10 text-primary-hover py-2.5 px-5 rounded-xl text-sm font-bold border-2 border-primary/20 hover:bg-primary/20 transition-all flex items-center gap-2 shadow-sm"
                        >
                            {copyFeedback ? 'Copied!' : 'Invite Link'}
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                            </svg>
                        </button>

                        {currentUser && (
                            <div className="relative group">
                                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-primary to-secondary text-white flex items-center justify-center text-base font-bold shadow-lg border-2 border-background cursor-pointer hover:scale-105 transition-transform">
                                    {currentUser.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="absolute right-0 top-full mt-2 w-max px-3 py-1.5 bg-foreground text-background text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                    {currentUser.name}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Row 2: Add Expense, Add Receipt, Manage Participants */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setIsAddExpenseOpen(true)}
                        className="btn-primary"
                    >
                        Add Expense
                    </button>
                    <button
                        onClick={() => setIsScanReceiptOpen(true)}
                        className="btn-accent py-2.5 px-6 flex items-center gap-2 text-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                        </svg>
                        Add Receipt
                    </button>
                    {isAuthorized && (
                        <button
                            onClick={() => setIsUserManagementOpen(true)}
                            className="btn-secondary py-2.5 px-6 flex items-center gap-2 text-sm"
                        >
                            Manage Participants
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                            </svg>
                        </button>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Main Content Area: Expenses */}
                <div className="lg:col-span-8 space-y-6">
                    <section>
                        {event.expenses.length === 0 ? (
                            <div className="glass rounded-3xl p-12 text-center border-dashed border-2 border-border/50">
                                <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-6">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold mb-2">Ready to settle up?</h3>
                                <p className="text-foreground/60 max-w-xs mx-auto">Add your first expense to see who owes what.</p>
                                <button
                                    onClick={() => setIsAddExpenseOpen(true)}
                                    className="mt-6 text-primary font-bold hover:underline"
                                >
                                    Start by adding an expense →
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {[...event.expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(expense => {
                                    const canEdit = isAuthorized || expense.creatorId === currentUserId;

                                    return (
                                        <div key={expense.id} className="glass rounded-2xl p-5 flex justify-between items-center bg-surface hover:bg-surface-hover/50 transition-all group border border-transparent hover:border-border">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex flex-col items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                                    <span className="text-xs font-bold uppercase opacity-60">
                                                        {new Date(expense.date).toLocaleString('default', { month: 'short' })}
                                                    </span>
                                                    <span className="text-xl font-black leading-none">
                                                        {new Date(expense.date).getDate()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-lg">{expense.name}</h4>
                                                    <p className="text-sm text-foreground/60">
                                                        Paid by <span className="font-bold text-foreground">{expense.creator.name}</span>
                                                        {expense.splitWithEveryone && <span className="ml-2 text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Group Split</span>}
                                                        {(expense as any).unclaimed && <span className="ml-2 text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">Unclaimed</span>}
                                                    </p>
                                                    {expense.notes && (
                                                        <div className="mt-1 flex items-baseline gap-2">
                                                            <p className="text-xs text-foreground/70 italic border-l-2 border-primary/30 pl-2 py-0.5">
                                                                "{(expense.notes.length > 60 || expense.notes.includes('\n'))
                                                                    ? expense.notes.split('\n')[0].substring(0, 60) + '...'
                                                                    : expense.notes}"
                                                            </p>
                                                            {(expense.notes.length > 60 || expense.notes.includes('\n')) && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setViewingNoteExpense(expense);
                                                                    }}
                                                                    className="text-[10px] font-bold text-primary hover:underline hover:text-primary-hover whitespace-nowrap"
                                                                >
                                                                    See more
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 relative z-10 pl-4">
                                                <div className="text-right">
                                                    <span className="font-bold text-lg block">${expense.amount.toFixed(2)}</span>
                                                    <span className="text-[10px] text-foreground/40">{expense.participants.length} involved</span>
                                                </div>

                                                <div className="flex gap-2">
                                                    {(() => {
                                                        const isParticipant = currentUserId ? expense.participants.some(p => p.userId === currentUserId) : false;
                                                        const amounts = expense.participants.map(p => p.amountOwed);
                                                        const isUnequalSplit = amounts.length > 0 && !amounts.every(a => Math.abs(a - amounts[0]) < 0.01);

                                                        if (isParticipant) {
                                                            return (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (isUnequalSplit) {
                                                                            setAdjustingSplit({ expense, action: isParticipant ? 'leave' : 'join' });
                                                                        } else {
                                                                            handleToggleParticipation(expense.id, 'leave');
                                                                        }
                                                                    }}
                                                                    className="p-2 rounded-lg transition-colors bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white"
                                                                    title={isUnequalSplit ? "Leave Expense (adjust amounts)" : "Leave Expense"}
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.646-6.374-1.766z" />
                                                                    </svg>
                                                                </button>
                                                            );
                                                        } else {
                                                            return (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (isUnequalSplit) {
                                                                            setAdjustingSplit({ expense, action: 'join' });
                                                                        } else {
                                                                            handleToggleParticipation(expense.id, 'join');
                                                                        }
                                                                    }}
                                                                    disabled={expense.splitWithEveryone}
                                                                    className={`p-2 rounded-lg transition-colors ${expense.splitWithEveryone
                                                                        ? 'bg-foreground/5 text-foreground/20 cursor-not-allowed'
                                                                        : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                                                                        }`}
                                                                    title={expense.splitWithEveryone ? "Already a group split" : isUnequalSplit ? "Join Expense (adjust amounts)" : "Join Expense"}
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.646-6.374-1.766z" />
                                                                    </svg>
                                                                </button>
                                                            );
                                                        }
                                                    })()}

                                                    <div className="w-px h-6 bg-border mx-1 self-center"></div>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (canEdit) setEditingExpense(expense);
                                                        }}
                                                        disabled={!canEdit}
                                                        className={`p-2 rounded-lg transition-colors ${canEdit
                                                            ? 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                                                            : 'bg-foreground/5 text-foreground/20 cursor-not-allowed'
                                                            }`}
                                                        title={canEdit ? "Edit Expense" : "You don't have permission to edit this"}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (canEdit) handleDeleteExpense(expense.id);
                                                        }}
                                                        disabled={!canEdit}
                                                        className={`p-2 rounded-lg transition-colors ${canEdit
                                                            ? 'bg-accent/10 text-accent hover:bg-accent hover:text-white'
                                                            : 'bg-foreground/5 text-foreground/20 cursor-not-allowed'
                                                            }`}
                                                        title={canEdit ? "Delete Expense" : "You don't have permission to delete this"}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>

                {/* Sidebar: Balances & Participants */}
                <div className="lg:col-span-4 space-y-8">
                    <section className="glass rounded-3xl p-6 shadow-lg border-primary/10 border-t-4">
                        <h2 className="text-xl font-bold mb-6 flex items-center justify-between">
                            Balances
                            <span className="text-[10px] uppercase tracking-widest bg-primary/10 text-primary px-2 py-1 rounded-md">Simplified</span>
                        </h2>

                        {payments.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mx-auto mb-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                </div>
                                <p className="text-foreground/50 font-medium italic">Everything is settled!</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {payments.map((p, idx) => (
                                    <div key={idx} className="flex flex-col gap-2 p-3 rounded-xl bg-surface-hover/30 border border-border/50">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-bold text-foreground">
                                                {p.from}
                                                {currentUser?.name === p.from && <span className="ml-1.5 inline-block align-middle text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-[4px] font-black uppercase tracking-tighter">Me</span>}
                                            </span>
                                            <span className="text-foreground/40 font-medium mx-2">owes</span>
                                            <span className="font-bold text-primary">
                                                {p.to}
                                                {currentUser?.name === p.to && <span className="ml-1.5 inline-block align-middle text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-[4px] font-black uppercase tracking-tighter">Me</span>}
                                            </span>
                                        </div>
                                        <div className="text-2xl font-black text-foreground">
                                            ${p.amount.toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="glass rounded-3xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Participants</h2>
                            <span className="bg-foreground/5 text-foreground/60 text-xs px-2 py-1 rounded-md font-bold">{event.users.length} total</span>
                        </div>

                        <ul className="space-y-4">
                            {event.users.map(user => {
                                const summary = summaries[user.id];
                                return (
                                    <li key={user.id} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-secondary text-white flex items-center justify-center text-sm font-bold shadow-md shadow-primary/20 transform transition-transform group-hover:scale-110">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <p className="font-bold text-sm">{user.name}</p>
                                                    {user.id === currentUserId && <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-[4px] font-black uppercase tracking-tighter">Me</span>}
                                                    {user.role === 'Owner' && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-sm font-black uppercase tracking-tighter">Owner</span>}
                                                    {user.role === 'Admin' && <span className="text-[8px] bg-cyan-600 text-white px-1.5 py-0.5 rounded-sm font-black uppercase tracking-tighter">Admin</span>}
                                                </div>
                                                <p className="text-[10px] text-foreground/50 font-bold uppercase">Net: <span className={summary.net >= 0 ? 'text-secondary' : 'text-accent'}>${summary.net.toFixed(2)}</span></p>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <span className="block text-xs font-bold">${summary.paid > 0 ? summary.paid.toFixed(0) : '0'} paid</span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                </div>
            </div>

            {isAddExpenseOpen && (
                <AddExpenseModal
                    eventId={event.id}
                    users={event.users}
                    currentUser={currentUserId}
                    onClose={() => setIsAddExpenseOpen(false)}
                />
            )}

            {editingExpense && (
                <AddExpenseModal
                    eventId={event.id}
                    users={event.users}
                    currentUser={currentUserId}
                    expense={editingExpense}
                    onClose={() => setEditingExpense(null)}
                />
            )}

            {isScanReceiptOpen && (
                <ScanReceiptModal
                    eventId={event.id}
                    users={event.users}
                    currentUser={currentUserId}
                    onClose={() => setIsScanReceiptOpen(false)}
                />
            )}

            {isUserManagementOpen && (
                <UserManagementModal
                    eventId={event.id}
                    users={event.users}
                    currentUser={currentUser}
                    onClose={() => setIsUserManagementOpen(false)}
                />
            )}

            {viewingNoteExpense && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-border">
                            <h2 className="text-xl font-bold">Expense Note</h2>
                            <button
                                onClick={() => setViewingNoteExpense(null)}
                                className="p-2 rounded-full hover:bg-surface-hover transition-colors text-foreground/50 hover:text-foreground"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <p className="font-bold text-lg mb-4">{viewingNoteExpense.name}</p>
                            <div className="bg-surface-hover/30 rounded-xl p-4 border border-border">
                                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                                    {viewingNoteExpense.notes}
                                </p>
                            </div>
                            <div className="mt-6">
                                <button
                                    onClick={() => setViewingNoteExpense(null)}
                                    className="btn-primary w-full"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {adjustingSplit && currentUserId && (
                <AdjustSplitModal
                    eventId={event.id}
                    expense={adjustingSplit.expense}
                    users={event.users}
                    currentUserId={currentUserId}
                    action={adjustingSplit.action}
                    onClose={() => setAdjustingSplit(null)}
                />
            )}
        </div>
    );
}
