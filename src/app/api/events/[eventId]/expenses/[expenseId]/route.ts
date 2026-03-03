import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ eventId: string, expenseId: string }> }
) {
    try {
        const { eventId, expenseId } = await params;
        const body = await request.json();
        const { name, amount, creatorId, splitWithEveryone, date, notes, selectedParticipantIds, customAmounts, splitUnequally, unclaimed } = body;

        // 1. Basic Validation
        if (!name || amount === undefined || !creatorId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 2. Fetch existing expense and users for permission check
        const existingExpense = await prisma.expense.findUnique({
            where: { id: expenseId },
            include: { creator: true }
        });

        if (!existingExpense) {
            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        }

        const requestUser = await prisma.user.findUnique({
            where: { id: creatorId }
        });

        if (!requestUser || requestUser.eventId !== eventId) {
            return NextResponse.json({ error: 'Invalid user or event' }, { status: 403 });
        }

        // 3. Permission Check: Creator, Admin, or Owner
        const isAuthorized =
            existingExpense.creatorId === creatorId ||
            requestUser.role === 'Admin' ||
            requestUser.role === 'Owner';

        if (!isAuthorized) {
            return NextResponse.json({ error: 'Unauthorized to edit this expense' }, { status: 403 });
        }

        // 4. Update the expense in a transaction
        const updatedExpense = await prisma.$transaction(async (tx) => {
            // Update base expense
            const expense = await tx.expense.update({
                where: { id: expenseId },
                data: {
                    name,
                    amount: parseFloat(amount),
                    date: date ? new Date(date) : undefined,
                    notes: notes || '',
                    splitWithEveryone: unclaimed ? false : splitWithEveryone,
                    unclaimed: unclaimed || false, // Update based on request, set to false if not provided
                }
            });

            // Update Payer record (assuming the person who "Paid By" in the form is the sole payer)
            await tx.expensePayer.deleteMany({ where: { expenseId } });
            await tx.expensePayer.create({
                data: {
                    expenseId,
                    userId: creatorId,
                    amountPaid: parseFloat(amount)
                }
            });

            // Update Participants
            await tx.expenseParticipant.deleteMany({ where: { expenseId } });

            if (!unclaimed) {
                const eventUsers = await tx.user.findMany({ where: { eventId } });
                let participantData: { userId: string, amountOwed: number }[] = [];

                if (splitWithEveryone) {
                    const splitAmount = parseFloat(amount) / eventUsers.length;
                    participantData = eventUsers.map(u => ({
                        userId: u.id,
                        amountOwed: splitAmount
                    }));
                } else if (customAmounts && splitUnequally) {
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
                        expenseId
                    }))
                });
            }

            return expense;
        });

        return NextResponse.json({ expense: updatedExpense }, { status: 200 });
    } catch (error) {
        console.error('Failed to update expense:', error);
        return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ eventId: string, expenseId: string }> }
) {
    try {
        const { eventId, expenseId } = await params;
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required for deletion' }, { status: 400 });
        }

        const existingExpense = await prisma.expense.findUnique({
            where: { id: expenseId }
        });

        if (!existingExpense) {
            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        }

        const requestUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!requestUser || requestUser.eventId !== eventId) {
            return NextResponse.json({ error: 'Invalid user or event' }, { status: 403 });
        }

        const isAuthorized =
            existingExpense.creatorId === userId ||
            requestUser.role === 'Admin' ||
            requestUser.role === 'Owner';

        if (!isAuthorized) {
            return NextResponse.json({ error: 'Unauthorized to delete this expense' }, { status: 403 });
        }

        await prisma.expense.delete({
            where: { id: expenseId }
        });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('Failed to delete expense:', error);
        return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
    }
}
