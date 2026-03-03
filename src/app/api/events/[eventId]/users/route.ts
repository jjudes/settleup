import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/events/[eventId]/users - Add a new user manually
export async function POST(
    request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const { name, role, requesterId } = await request.json();

        if (!name || !requesterId) {
            return NextResponse.json({ error: 'Name and requesterId are required' }, { status: 400 });
        }

        // Verify requester is Owner or Admin
        const requester = await prisma.user.findUnique({
            where: { id: requesterId }
        });

        if (!requester || (requester.role !== 'Owner' && requester.role !== 'Admin')) {
            return NextResponse.json({ error: 'Unauthorized: Only Owners and Admins can add users' }, { status: 403 });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: {
                eventId_name: {
                    eventId,
                    name
                }
            }
        });

        if (existingUser) {
            return NextResponse.json({ error: 'User already exists' }, { status: 400 });
        }

        const newUser = await prisma.$transaction(async (tx) => {
            // 1. Create the user
            const user = await tx.user.create({
                data: {
                    eventId,
                    name,
                    role: role || 'User'
                }
            });

            // 2. Backfill "Split with Everyone" expenses
            const expensesToUpdate = await tx.expense.findMany({
                where: {
                    eventId,
                    splitWithEveryone: true
                }
            });

            const totalUsersCount = await tx.user.count({
                where: { eventId }
            });

            for (const expense of expensesToUpdate) {
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
        console.error('Failed to add user:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
