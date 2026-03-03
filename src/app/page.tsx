'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MoneyRain from '@/components/MoneyRain';

export default function Home() {
  const router = useRouter();
  const [eventName, setEventName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || !ownerName.trim()) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventName: eventName.trim(),
          ownerName: ownerName.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create event');
      }

      const data = await response.json();

      // Store owner info in localStorage for this event
      if (data.owner) {
        localStorage.setItem(`settleup_user_${data.eventId}`, JSON.stringify({
          id: data.owner.id,
          name: data.owner.name
        }));
      }

      // Navigate to the newly created event page
      router.push(`/${data.eventId}`);
    } catch (error) {
      console.error('Error creating event:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-gradient-to-b from-[#d5ead5] to-[#b7dbb7]">
      <MoneyRain />

      <main className="w-full max-w-md z-10">
        <div className="glass rounded-3xl p-8 mb-8 text-center shadow-2xl">
          <div className="w-20 h-20 bg-primary text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/30 transform rotate-3 hover:rotate-6 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          </div>

          <h1 className="text-4xl font-bold tracking-tight mb-2 text-foreground">Settle Up</h1>
          <p className="text-foreground/70 mb-8">The easiest way to split expenses with friends.</p>

          <form onSubmit={handleCreateEvent} className="space-y-5 text-left">
            <div>
              <label htmlFor="eventName" className="block text-sm font-medium mb-1.5 ml-1 text-foreground/80">
                Event Name
              </label>
              <input
                id="eventName"
                type="text"
                placeholder="e.g. Weekend Trip to Tahoe"
                className="input-field"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
                maxLength={50}
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="ownerName" className="block text-sm font-medium mb-1.5 ml-1 text-foreground/80">
                Your Name
              </label>
              <input
                id="ownerName"
                type="text"
                placeholder="e.g. Alex"
                className="input-field"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
                maxLength={30}
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full mt-4 flex justify-center items-center"
              disabled={isLoading || !eventName.trim() || !ownerName.trim()}
            >
              {isLoading ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                'Create Event'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-foreground/50">
          No sign up required. Just create and share a link.
        </p>
      </main>
    </div>
  );
}
