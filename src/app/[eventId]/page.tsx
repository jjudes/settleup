import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import EventDashboard from '@/components/EventDashboard';

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;

    const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
            users: true,
            expenses: {
                include: {
                    creator: true,
                    payers: { include: { user: true } },
                    participants: { include: { user: true } }
                }
            }
        }
    });

    if (!event) {
        notFound();
    }

    return <EventDashboard event={event as any} />;
}
