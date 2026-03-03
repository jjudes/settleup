import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                }
            }
        });

        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        return NextResponse.json(event);
    } catch (error) {
        console.error('Failed to fetch event:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
