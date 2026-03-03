import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ eventId: string; expenseId: string }> }
) {
    try {
        const { eventId, expenseId } = await params;
        const { userId, action } = await request.json(); // action: 'join' | 'leave'

        if (!userId || !action || !['join', 'leave'].includes(action)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        // 1. Fetch the expense and all active users
        const expense = await prisma.expense.findFirst({
            where: { id: expenseId, eventId },
            include: { participants: true, payers: true }
        });

        if (!expense) {
            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        }

        const allUsers = await prisma.user.findMany({
            where: { eventId }
        });

        const isParticipant = expense.participants.some(p => p.userId === userId);

        // Validations
        if (action === 'join' && isParticipant) {
            return NextResponse.json({ error: 'User is already a participant' }, { status: 400 });
        }
        if (action === 'leave' && !isParticipant) {
            return NextResponse.json({ error: 'User is not a participant' }, { status: 400 });
        }

        // 2. Perform transaction to update participants and recalculate split
        const updatedExpense = await prisma.$transaction(async (tx) => {
            let participants = [...expense.participants];
            let isSplitWithEveryone = expense.splitWithEveryone;

            if (action === 'join') {
                // Add the user to the participants array
                participants.push({
                    id: 'temp', // Will be ignored in calculation
                    expenseId: expense.id,
                    userId: userId,
                    amountOwed: 0
                });

                // Check if everyone is now included
                if (participants.length === allUsers.length && !isSplitWithEveryone) {
                    isSplitWithEveryone = true;
                }
            } else if (action === 'leave') {
                // Remove the user
                participants = participants.filter(p => p.userId !== userId);

                // If leaving a group split, it's no longer 'splitWithEveryone'
                // Re-select all *other* active participants to be explicit
                if (isSplitWithEveryone) {
                    isSplitWithEveryone = false;

                    // Filter out the leaving user, but keep all other explicit users in the event
                    participants = allUsers
                        .filter(u => u.id !== userId)
                        .map(u => ({
                            id: 'temp',
                            expenseId: expense.id,
                            userId: u.id,
                            amountOwed: 0
                        }));
                }
            }

            // 1. Delete all existing participants
            await tx.expenseParticipant.deleteMany({
                where: { expenseId: expense.id }
            });

            let isUnclaimed = false;

            // Distribute amount equally among remaining participants
            if (participants.length === 0) {
                isUnclaimed = true;
                isSplitWithEveryone = false;
            } else {
                const amountPerPerson = expense.amount / participants.length;

                // 2. Add the new ones with equal splits
                await tx.expenseParticipant.createMany({
                    data: participants.map(p => ({
                        expenseId: expense.id,
                        userId: p.userId,
                        amountOwed: amountPerPerson
                    }))
                });
            }

            // 3. Update the expense metadata
            return await tx.expense.update({
                where: { id: expense.id },
                data: {
                    splitWithEveryone: isSplitWithEveryone,
                    unclaimed: isUnclaimed
                },
                include: { participants: true, payers: true, creator: true }
            });
        });

        return NextResponse.json(updatedExpense);
    } catch (error: any) {
        console.error('Failed to update expense participants:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
