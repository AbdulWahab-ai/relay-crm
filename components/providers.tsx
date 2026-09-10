'use client';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import { DEMO } from '@/lib/demo-store';
export function Providers({ children }: { children: React.ReactNode }) {
  return DEMO ? (
    <>
      <Toaster position="bottom-right" richColors />
      {children}
    </>
  ) : (
    <SessionProvider>
      <Toaster position="bottom-right" richColors />
      {children}
    </SessionProvider>
  );
}
