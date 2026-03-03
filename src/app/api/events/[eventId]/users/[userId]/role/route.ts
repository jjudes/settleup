import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// PATCH /api/events/[eventId]/users/[userId]/role - Update user role
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ eventId: string; userId: string }> }
) {
    try {
        const { eventId, userId } = await params;
        const { role, requesterId } = await request.json();

        if (!role || !requesterId) {
            return NextResponse.json({ error: 'Role and requesterId are required' }, { status: 400 });
        }

        // Verify requester is Owner or Admin
        const requester = await prisma.user.findUnique({
            where: { id: requesterId }
        });

        if (!requester || (requester.role !== 'Owner' && requester.role !== 'Admin')) {
            return NextResponse.json({ error: 'Unauthorized: Only Owners and Admins can manage roles' }, { status: 403 });
        }

        // Only Owners can promote others to Admin? Let's stick to the prompt:
        // "The creator and other admins should be able to make other users admin as well."

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { role }
        });

        return NextResponse.json({ user: updatedUser });
    } catch (error) {
        console.error('Failed to update role:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
