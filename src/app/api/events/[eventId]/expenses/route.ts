import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const body = await request.json();

        // We'll simplify this initially and build the split algorithm separately.
        const { name, amount, creatorId, splitWithEveryone, date, notes, unclaimed } = body;

        if (!name || amount === undefined || !creatorId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Verify creator exists and belongs to event
        const user = await prisma.user.findUnique({
            where: { id: creatorId }
        });

        if (!user || user.eventId !== eventId) {
            return NextResponse.json(
                { error: 'Invalid creator or event' },
                { status: 403 }
            );
        }

        // Get all users in the event if splitting with everyone
        const eventUsers = await prisma.user.findMany({
            where: { eventId }
        });

        const splitAmount = splitWithEveryone ? amount / eventUsers.length : amount;

        // Create the expense, payer, and participants in a transaction
        const expense = await prisma.$transaction(async (tx) => {
            // 1. Create the base expense
            const newExpense = await tx.expense.create({
                data: {
                    name,
                    amount: parseFloat(amount),
                    eventId,
                    creatorId,
                    splitWithEveryone: unclaimed ? false : splitWithEveryone,
                    date: date ? new Date(date) : new Date(),
                    notes: notes || '',
                    unclaimed: unclaimed || false,
                }
            });

            // 2. Create the Payer record (currently assuming the creator paid the whole thing)
            await tx.expensePayer.create({
                data: {
                    expenseId: newExpense.id,
                    userId: creatorId,
                    amountPaid: parseFloat(amount)
                }
            });

            // 3. Create Participant records
            if (!unclaimed) {
                const { selectedParticipantIds, customAmounts, splitUnequally } = body;
                let participantData: { userId: string, amountOwed: number }[] = [];

                if (splitWithEveryone) {
                    const splitAmount = parseFloat(amount) / eventUsers.length;
                    participantData = eventUsers.map(u => ({
                        userId: u.id,
                        amountOwed: splitAmount
                    }));
                } else if (customAmounts && splitUnequally) {
                    // Validate sum of custom amounts
                    const sum = Object.values(customAmounts as Record<string, string>)
                        .reduce((acc, val) => acc + (parseFloat(val) || 0), 0);

                    if (Math.abs(sum - parseFloat(amount)) > 0.01) {
                        throw new Error(`Sum of custom amounts ($${sum.toFixed(2)}) does not match total ($${parseFloat(amount).toFixed(2)})`);
                    }

                    participantData = Object.entries(customAmounts as Record<string, string>).map(([userId, val]) => ({
                        userId,
                        amountOwed: parseFloat(val) || 0
                    }));
                } else {
                    const participantsToInclude = (selectedParticipantIds && selectedParticipantIds.length > 0)
                        ? selectedParticipantIds
                        : [creatorId];

                    const splitAmount = parseFloat(amount) / participantsToInclude.length;
                    participantData = participantsToInclude.map((userId: string) => ({
                        userId,
                        amountOwed: splitAmount
                    }));
                }

                await tx.expenseParticipant.createMany({
                    data: participantData.map(p => ({
                        ...p,
                        expenseId: newExpense.id
                    }))
                });
            }

            return newExpense;
        });

        return NextResponse.json({ expense }, { status: 201 });
    } catch (error) {
        console.error('Failed to create expense:', error);
        return NextResponse.json(
            { error: 'Failed to create expense' },
            { status: 500 }
        );
    }
}
