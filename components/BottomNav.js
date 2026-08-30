'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  const tabs = [
    { href: '/', label: 'Dashboard' },
    { href: '/ledger', label: 'Ledger' },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-bark bg-soil/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-lg px-4 py-2 font-mono text-xs uppercase tracking-wide transition ${
                active ? 'bg-canopy text-harvest' : 'text-husk'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="rounded-lg px-4 py-2 font-mono text-xs uppercase tracking-wide text-husk"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
