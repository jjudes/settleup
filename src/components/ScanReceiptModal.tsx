'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@prisma/client';

interface ReceiptItem {
    id: string;
    name: string;
    amount: string;
    assignedUserIds: string[];
    splitWithEveryone: boolean;
}

type TaxTipMode = 'dollar' | 'percent';

export default function ScanReceiptModal({
    eventId,
    users,
    currentUser,
    onClose
}: {
    eventId: string;
    users: User[];
    currentUser: string | null;
    onClose: () => void;
}) {
    const router = useRouter();

    // Step tracking
    const [step, setStep] = useState<1 | 2>(1);

    // Step 1: Entry & Assign
    const [items, setItems] = useState<ReceiptItem[]>([{ id: 'item-0', name: '', amount: '', assignedUserIds: [], splitWithEveryone: false }]);
    const [taxMode, setTaxMode] = useState<TaxTipMode>('dollar');
    const [taxValue, setTaxValue] = useState<string>('');
    const [tipMode, setTipMode] = useState<TaxTipMode>('dollar');
    const [tipValue, setTipValue] = useState<string>('');
    const [calculateTipPostTax, setCalculateTipPostTax] = useState<boolean>(true);
    const [receiptName, setReceiptName] = useState<string>('');

    // Step 2: Confirm
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Derived calculations
    const itemsSubtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const taxDollar = taxMode === 'dollar'
        ? parseFloat(taxValue) || 0
        : (itemsSubtotal * (parseFloat(taxValue) || 0)) / 100;

    const taxPercent = taxMode === 'percent'
        ? parseFloat(taxValue) || 0
        : itemsSubtotal > 0 ? ((parseFloat(taxValue) || 0) / itemsSubtotal) * 100 : 0;

    const tipBaseAmount = calculateTipPostTax ? itemsSubtotal + taxDollar : itemsSubtotal;

    const tipDollar = tipMode === 'dollar'
        ? parseFloat(tipValue) || 0
        : (tipBaseAmount * (parseFloat(tipValue) || 0)) / 100;

    const tipPercent = tipMode === 'percent'
        ? parseFloat(tipValue) || 0
        : tipBaseAmount > 0 ? ((parseFloat(tipValue) || 0) / tipBaseAmount) * 100 : 0;

    const totalExtra = taxDollar + tipDollar;
    const grandTotal = itemsSubtotal + totalExtra;

    const updateItem = (id: string, updates: Partial<ReceiptItem>) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const addItem = () => {
        setItems(prev => [...prev, {
            id: `item-${Date.now()}`,
            name: '',
            amount: '',
            assignedUserIds: [],
            splitWithEveryone: false,
        }]);
    };

    const toggleUserForItem = (itemId: string, userId: string) => {
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            const has = item.assignedUserIds.includes(userId);
            return {
                ...item,
                assignedUserIds: has
                    ? item.assignedUserIds.filter(id => id !== userId)
                    : [...item.assignedUserIds, userId],
            };
        }));
    };

    const getItemFinalAmount = (item: ReceiptItem) => {
        const itemAmt = parseFloat(item.amount) || 0;
        if (itemsSubtotal === 0) return itemAmt;
        const proportion = itemAmt / itemsSubtotal;
        return Math.round((itemAmt + totalExtra * proportion) * 100) / 100;
    };

    const getAssignmentLabel = (item: ReceiptItem) => {
        if (item.splitWithEveryone) return 'Group Split';
        if (item.assignedUserIds.length === 0) return 'Unclaimed';
        return item.assignedUserIds
            .map(id => users.find(u => u.id === id)?.name || 'Unknown')
            .join(', ');
    };

    const handleCreateExpenses = async () => {
        setIsCreating(true);
        setCreateError(null);

        try {
            const validItems = items.filter(item => (parseFloat(item.amount) || 0) > 0);

            if (validItems.length === 0) {
                throw new Error("Please add at least one item with a valid amount greater than 0.");
            }

            const expenseItems = validItems.map(item => ({
                name: item.name || 'Receipt Item',
                finalAmount: getItemFinalAmount(item),
                assignedUserIds: item.assignedUserIds,
                splitWithEveryone: item.splitWithEveryone,
            }));

            const response = await fetch(`/api/events/${eventId}/receipts/create-expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: expenseItems,
                    creatorId: currentUser,
                    receiptName: receiptName || 'Receipt',
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create expenses');
            }

            router.refresh();
            onClose();
        } catch (err: any) {
            setCreateError(err.message);
            setIsCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden overflow-x-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Add Receipt</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                {[1, 2].map(s => (
                                    <div key={s} className="flex items-center gap-1">
                                        <div className={`w-2 h-2 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-border'}`} />
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${s === step ? 'text-primary' : 'text-foreground/30'}`}>
                                            {s === 1 ? 'Entry & Assign' : 'Confirm'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
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

                {/* Step Content */}
                <div className="p-6 overflow-y-auto flex-1">

                    {/* ─── STEP 1: ENTRY & ASSIGN ─── */}
                    {step === 1 && (
                        <div className="space-y-6">
                            {/* Receipt name */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5 ml-1">Receipt Name</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="e.g. Dinner at Joe's"
                                    value={receiptName}
                                    onChange={(e) => setReceiptName(e.target.value)}
                                />
                            </div>

                            {/* Items list */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <p className="text-xs font-bold uppercase text-foreground/40 tracking-wider">Items</p>
                                    <button
                                        onClick={addItem}
                                        className="text-xs font-bold text-primary hover:text-primary-hover transition-colors flex items-center gap-1"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                        Add Item
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {items.map((item) => (
                                        <div key={item.id} className="bg-surface-hover/30 rounded-xl p-4 border border-border space-y-3">
                                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                                                <div className="flex-1 min-w-0">
                                                    <input
                                                        type="text"
                                                        className="input-field w-full py-2 text-sm"
                                                        placeholder="Item name"
                                                        value={item.name}
                                                        onChange={(e) => updateItem(item.id, { name: e.target.value })}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 sm:gap-3">
                                                    <div className="relative flex-1 sm:w-28 sm:flex-none">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-40">$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            className="input-field py-2 pl-6 pr-3 text-right text-sm font-mono w-full"
                                                            placeholder="0.00"
                                                            value={item.amount}
                                                            onChange={(e) => updateItem(item.id, { amount: e.target.value })}
                                                            onBlur={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                if (!isNaN(val)) updateItem(item.id, { amount: Math.max(0, val).toFixed(2) });
                                                            }}
                                                            onWheel={(e) => e.currentTarget.blur()}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => removeItem(item.id)}
                                                        className="p-2 rounded-lg text-foreground/30 hover:text-accent hover:bg-accent/10 transition-colors flex-shrink-0"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Assignment */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                                        checked={item.splitWithEveryone}
                                                        onChange={(e) => updateItem(item.id, {
                                                            splitWithEveryone: e.target.checked,
                                                            assignedUserIds: e.target.checked ? [] : item.assignedUserIds
                                                        })}
                                                    />
                                                    <span className="text-xs font-semibold text-secondary">Group Split</span>
                                                </label>

                                                {!item.splitWithEveryone && (
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        {users.map(u => {
                                                            const selected = item.assignedUserIds.includes(u.id);
                                                            return (
                                                                <button
                                                                    key={u.id}
                                                                    onClick={() => toggleUserForItem(item.id, u.id)}
                                                                    className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-all ${selected
                                                                        ? 'bg-primary text-white'
                                                                        : 'bg-foreground/5 text-foreground/40 hover:bg-foreground/10'
                                                                        }`}
                                                                >
                                                                    {u.name}
                                                                </button>
                                                            );
                                                        })}
                                                        {item.assignedUserIds.length === 0 && (
                                                            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg">
                                                                Unclaimed
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Tax & Tip */}
                            <div className="bg-surface-hover/30 rounded-xl p-4 border border-border space-y-4">
                                <p className="text-xs font-bold uppercase text-foreground/40 tracking-wider">Tax & Tip</p>

                                {/* Tax */}
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col w-12 sm:w-16 shrink-0">
                                                <label className="text-sm font-medium">Tax</label>
                                            </div>
                                            <div className="flex bg-foreground/5 rounded-lg p-0.5">
                                                <button
                                                    onClick={() => {
                                                        if (taxMode === 'percent') {
                                                            setTaxMode('dollar');
                                                            setTaxValue(taxValue === '' ? '' : taxDollar.toFixed(2));
                                                        }
                                                    }}
                                                    className={`text-xs font-bold px-3 py-1 rounded-md transition-all ${taxMode === 'dollar' ? 'bg-primary text-white' : 'text-foreground/50'}`}
                                                >
                                                    $
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (taxMode === 'dollar') {
                                                            setTaxMode('percent');
                                                            setTaxValue(taxValue === '' ? '' : Number(taxPercent.toFixed(2)).toString());
                                                        }
                                                    }}
                                                    className={`text-xs font-bold px-3 py-1 rounded-md transition-all ${taxMode === 'percent' ? 'bg-primary text-white' : 'text-foreground/50'}`}
                                                >
                                                    %
                                                </button>
                                            </div>
                                        </div>
                                        {/* Hidden on mobile, shown on desktop */}
                                        <span className="hidden sm:block text-xs text-foreground/40 font-mono w-20 text-right shrink-0">
                                            {taxMode === 'dollar'
                                                ? `${taxPercent.toFixed(1)}%`
                                                : `$${taxDollar.toFixed(2)}`
                                            }
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 w-full sm:w-auto sm:self-end">
                                        <div className="relative w-full sm:w-28 flex-shrink-0">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-40">
                                                {taxMode === 'dollar' ? '$' : '%'}
                                            </span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                className="input-field py-2 pl-6 pr-3 text-right text-sm font-mono w-full"
                                                placeholder={taxMode === 'dollar' ? "0.00" : "0"}
                                                value={taxValue}
                                                onChange={(e) => setTaxValue(e.target.value)}
                                                onBlur={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    if (!isNaN(val)) {
                                                        const newVal = Math.max(0, val);
                                                        setTaxValue(taxMode === 'dollar' ? newVal.toFixed(2) : newVal.toString());
                                                    }
                                                }}
                                                onWheel={(e) => e.currentTarget.blur()}
                                            />
                                        </div>
                                        {/* Shown on mobile, hidden on desktop */}
                                        <span className="sm:hidden text-xs text-foreground/40 font-mono w-16 text-right shrink-0">
                                            {taxMode === 'dollar'
                                                ? `${taxPercent.toFixed(1)}%`
                                                : `$${taxDollar.toFixed(2)}`
                                            }
                                        </span>
                                    </div>
                                </div>

                                {/* Tip */}
                                <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
                                    <div className="flex items-start justify-between w-full">
                                        <div className="flex items-start gap-3">
                                            <div className="flex flex-col w-12 sm:w-16 shrink-0 mt-1">
                                                <label className="text-sm font-medium">Tip</label>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex bg-foreground/5 rounded-lg p-0.5 w-fit">
                                                    <button
                                                        onClick={() => {
                                                            if (tipMode === 'percent') {
                                                                setTipMode('dollar');
                                                                setTipValue(tipValue === '' ? '' : tipDollar.toFixed(2));
                                                            }
                                                        }}
                                                        className={`text-xs font-bold px-3 py-1 rounded-md transition-all ${tipMode === 'dollar' ? 'bg-primary text-white' : 'text-foreground/50'}`}
                                                    >
                                                        $
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (tipMode === 'dollar') {
                                                                setTipMode('percent');
                                                                setTipValue(tipValue === '' ? '' : Number(tipPercent.toFixed(2)).toString());
                                                            }
                                                        }}
                                                        className={`text-xs font-bold px-3 py-1 rounded-md transition-all ${tipMode === 'percent' ? 'bg-primary text-white' : 'text-foreground/50'}`}
                                                    >
                                                        %
                                                    </button>
                                                </div>
                                                <label className="flex items-center gap-1.5 cursor-pointer mt-1 pl-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={calculateTipPostTax}
                                                        onChange={(e) => setCalculateTipPostTax(e.target.checked)}
                                                        className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary"
                                                    />
                                                    <span className="text-[10px] sm:text-xs text-foreground/60 whitespace-nowrap">Post-tax</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative w-full sm:w-28 sm:self-end flex-shrink-0">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-40">
                                            {tipMode === 'dollar' ? '$' : '%'}
                                        </span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="input-field py-2 pl-6 pr-3 text-right text-sm font-mono w-full"
                                            placeholder={tipMode === 'dollar' ? "0.00" : "0"}
                                            value={tipValue}
                                            onChange={(e) => setTipValue(e.target.value)}
                                            onBlur={(e) => {
                                                const val = parseFloat(e.target.value);
                                                if (!isNaN(val)) {
                                                    const newVal = Math.max(0, val);
                                                    setTipValue(tipMode === 'dollar' ? newVal.toFixed(2) : newVal.toString());
                                                }
                                            }}
                                            onWheel={(e) => e.currentTarget.blur()}
                                        />
                                    </div>
                                </div>

                                {/* Totals summary */}
                                <div className="pt-3 border-t border-border space-y-1.5">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-foreground/50">Subtotal</span>
                                        <span className="font-mono">${itemsSubtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-foreground/50">Tax</span>
                                        <span className="font-mono">${taxDollar.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-foreground/50">Tip</span>
                                        <span className="font-mono">${tipDollar.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-base font-bold pt-1">
                                        <span>Total</span>
                                        <span className="font-mono">${grandTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                disabled={items.length === 0}
                                className="btn-primary w-full"
                            >
                                Continue to Review
                            </button>
                        </div>
                    )}

                    {/* ─── STEP 2: CONFIRM ─── */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold mb-1">{receiptName || 'Receipt'}</h3>
                                <p className="text-sm text-foreground/50">
                                    {items.length} expense{items.length !== 1 ? 's' : ''} will be created
                                </p>
                            </div>

                            <div className="space-y-2">
                                {items.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-hover/30 border border-border">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate">{item.name || 'Unnamed item'}</p>
                                            <p className="text-[11px] text-foreground/50 mt-0.5">
                                                {getAssignmentLabel(item)}
                                            </p>
                                        </div>
                                        <div className="text-right ml-4 flex-shrink-0">
                                            <p className="font-bold font-mono">${getItemFinalAmount(item).toFixed(2)}</p>
                                            {totalExtra > 0 && (
                                                <p className="text-[10px] text-foreground/40 font-mono">
                                                    base: ${(parseFloat(item.amount) || 0).toFixed(2)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-surface-hover/30 rounded-xl p-4 border border-border">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-foreground/50">Items subtotal</span>
                                    <span className="font-mono">${itemsSubtotal.toFixed(2)}</span>
                                </div>
                                {taxDollar > 0 && (
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-foreground/50">Tax</span>
                                        <span className="font-mono">+${taxDollar.toFixed(2)}</span>
                                    </div>
                                )}
                                {tipDollar > 0 && (
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-foreground/50">Tip</span>
                                        <span className="font-mono">+${tipDollar.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-bold pt-2 border-t border-border mt-2">
                                    <span>Grand Total</span>
                                    <span className="font-mono">${grandTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {createError && (
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium">
                                    <div className="flex items-start gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mt-0.5 flex-shrink-0">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                        </svg>
                                        <span>{createError}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="glass py-2.5 px-5 rounded-xl text-sm font-semibold border-2 border-border hover:border-primary transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleCreateExpenses}
                                    disabled={isCreating || items.length === 0}
                                    className="btn-primary flex-1 flex justify-center items-center"
                                >
                                    {isCreating ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                            Creating...
                                        </>
                                    ) : (
                                        `Create ${items.length} Expense${items.length !== 1 ? 's' : ''}`
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
