import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const { name, isExistingUserClick } = await request.json();

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        // Check if user already exists in this event
        const existingUser = await prisma.user.findUnique({
            where: {
                eventId_name: {
                    eventId,
                    name
                }
            }
        });

        if (existingUser) {
            if (isExistingUserClick) {
                return NextResponse.json({ user: existingUser }, { status: 200 });
            } else {
                return NextResponse.json({ error: 'A user with this name already exists. Please pick a different name or select it from above.' }, { status: 409 });
            }
        }

        // Join as a new user
        const newUser = await prisma.$transaction(async (tx) => {
            // 1. Create the user
            const user = await tx.user.create({
                data: {
                    eventId,
                    name,
                    role: 'User'
                }
            });

            // 2. Find all expenses that are "Split with Everyone"
            const expensesToUpdate = await tx.expense.findMany({
                where: {
                    eventId,
                    splitWithEveryone: true
                }
            });

            // 3. For each expense, update participants
            for (const expense of expensesToUpdate) {
                // Get total users in event AFTER this user joined
                const totalUsersCount = await tx.user.count({
                    where: { eventId }
                });

                const newAmountOwed = expense.amount / totalUsersCount;

                // Add the new user as a participant
                await tx.expenseParticipant.create({
                    data: {
                        expenseId: expense.id,
                        userId: user.id,
                        amountOwed: newAmountOwed
                    }
                });

                // Update all other participants' amounts
                await tx.expenseParticipant.updateMany({
                    where: {
                        expenseId: expense.id,
                        userId: { not: user.id }
                    },
                    data: {
                        amountOwed: newAmountOwed
                    }
                });
            }

            return user;
        });

        return NextResponse.json({ user: newUser }, { status: 201 });
    } catch (error) {
        console.error('Failed to join event:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
