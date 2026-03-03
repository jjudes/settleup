export type UserBalance = {
    userId: string;
    name: string;
    netAmount: number;
};

export type SimplifiedPayment = {
    from: string;
    fromId: string;
    to: string;
    toId: string;
    amount: number;
};

export function simplifyDebts(users: { id: string; name: string }[], expenses: any[]): SimplifiedPayment[] {
    const netBalances: Record<string, number> = {};

    // Initialize balances
    users.forEach(u => netBalances[u.id] = 0);

    // Calculate net balance for each user (skip unclaimed expenses)
    expenses.filter((e: any) => !e.unclaimed).forEach(expense => {
        // What they paid (positive for them)
        expense.payers.forEach((payer: any) => {
            netBalances[payer.userId] = (netBalances[payer.userId] || 0) + payer.amountPaid;
        });

        // What they owe (negative for them)
        expense.participants.forEach((participant: any) => {
            netBalances[participant.userId] = (netBalances[participant.userId] || 0) - participant.amountOwed;
        });
    });

    const debtors = Object.keys(netBalances)
        .filter(id => netBalances[id] < -0.01)
        .map(id => ({ id, amount: Math.abs(netBalances[id]), name: users.find(u => u.id === id)?.name || 'Unknown' }))
        .sort((a, b) => b.amount - a.amount);

    const creditors = Object.keys(netBalances)
        .filter(id => netBalances[id] > 0.01)
        .map(id => ({ id, amount: netBalances[id], name: users.find(u => u.id === id)?.name || 'Unknown' }))
        .sort((a, b) => b.amount - a.amount);

    const payments: SimplifiedPayment[] = [];

    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];

        const amount = Math.min(debtor.amount, creditor.amount);

        if (amount > 0.01) {
            payments.push({
                from: debtor.name,
                fromId: debtor.id,
                to: creditor.name,
                toId: creditor.id,
                amount: Number(amount.toFixed(2))
            });
        }

        debtor.amount -= amount;
        creditor.amount -= amount;

        if (debtor.amount < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    return payments;
}

export function calculateUserSummaries(users: { id: string; name: string }[], expenses: any[]) {
    const summaries: Record<string, { paid: number, owed: number, net: number }> = {};
    users.forEach(u => summaries[u.id] = { paid: 0, owed: 0, net: 0 });

    expenses.filter((e: any) => !e.unclaimed).forEach(expense => {
        expense.payers.forEach((p: any) => {
            summaries[p.userId].paid += p.amountPaid;
        });
        expense.participants.forEach((p: any) => {
            summaries[p.userId].owed += p.amountOwed;
        });
    });

    Object.keys(summaries).forEach(id => {
        summaries[id].net = summaries[id].paid - summaries[id].owed;
    });

    return summaries;
}
