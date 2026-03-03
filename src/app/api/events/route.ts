import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const { eventName, ownerName } = await request.json();

        if (!eventName || !ownerName) {
            return NextResponse.json(
                { error: 'Event name and owner name are required' },
                { status: 400 }
            );
        }

        // Create the event and the owner user in a single transaction
        const event = await prisma.event.create({
            data: {
                name: eventName,
                users: {
                    create: {
                        name: ownerName,
                        role: 'Owner'
                    }
                }
            }
        });

        const eventWithUser = await prisma.event.findUnique({
            where: { id: event.id },
            include: { users: true }
        });

        const owner = eventWithUser?.users.find(u => u.role === 'Owner');

        return NextResponse.json({
            eventId: event.id,
            owner: owner
        }, { status: 201 });
    } catch (error) {
        console.error('Failed to create event:', error);
        return NextResponse.json(
            { error: 'Failed to create event' },
            { status: 500 }
        );
    }
}
