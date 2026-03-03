import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface ReceiptExpenseItem {
    name: string;
    finalAmount: number;
    assignedUserIds: string[];
    splitWithEveryone: boolean;
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const { items, creatorId, receiptName } = await request.json() as {
            items: ReceiptExpenseItem[];
            creatorId: string;
            receiptName: string;
        };

        if (!items || items.length === 0 || !creatorId) {
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

        // Get all event users for "split with everyone" items
        const eventUsers = await prisma.user.findMany({
            where: { eventId }
        });

        // Create all expenses in a single transaction
        const expenses = await prisma.$transaction(async (tx) => {
            const created = [];

            for (const item of items) {
                const isUnclaimed = !item.splitWithEveryone && item.assignedUserIds.length === 0;

                // Create the expense
                const expense = await tx.expense.create({
                    data: {
                        name: item.name,
                        amount: item.finalAmount,
                        eventId,
                        creatorId,
                        splitWithEveryone: item.splitWithEveryone,
                        unclaimed: isUnclaimed,
                        date: new Date(),
                        notes: `From receipt: ${receiptName}`,
                    }
                });

                // Create payer record (creator paid)
                await tx.expensePayer.create({
                    data: {
                        expenseId: expense.id,
                        userId: creatorId,
                        amountPaid: item.finalAmount,
                    }
                });

                // Create participant records
                if (item.splitWithEveryone) {
                    // Split among all event users
                    const splitAmount = item.finalAmount / eventUsers.length;
                    await tx.expenseParticipant.createMany({
                        data: eventUsers.map(u => ({
                            expenseId: expense.id,
                            userId: u.id,
                            amountOwed: splitAmount,
                        }))
                    });
                } else if (item.assignedUserIds.length > 0) {
                    // Split among assigned users
                    const splitAmount = item.finalAmount / item.assignedUserIds.length;
                    await tx.expenseParticipant.createMany({
                        data: item.assignedUserIds.map(userId => ({
                            expenseId: expense.id,
                            userId,
                            amountOwed: splitAmount,
                        }))
                    });
                }

                created.push(expense);
            }

            return created;
        });

        return NextResponse.json({ expenses }, { status: 201 });
    } catch (error: any) {
        console.error('Failed to create receipt expenses:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to create expenses from receipt' },
            { status: 500 }
        );
    }
}
