import Link from 'next/link';

const cards = [
  { href: '/admin/users', title: 'Users', desc: 'Search, inspect accounts, assign roles (super admin).' },
  { href: '/admin/networks', title: 'Networks', desc: 'Browse networks, neighborhood metadata, featured flags.' },
  { href: '/admin/groups', title: 'Groups', desc: 'Community and chat groups — list and edit basics.' },
  { href: '/admin/channels', title: 'Channels', desc: 'Channels under networks.' },
  { href: '/admin/showcase', title: 'Showcase / Vitrin', desc: 'Announcements and curated surfacing.' },
  { href: '/admin/moderation', title: 'Moderation', desc: 'Posts and message reports.' },
  { href: '/admin/geography', title: 'Geography', desc: 'Neighborhood import / bootstrap tools.' },
  { href: '/admin/staff', title: 'Staff roles', desc: 'Operators with elevated roles (super admin only).' },
] as const;

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Operations</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        v1 admin console — conservative tools for users, vitrin, networks, groups, channels, geography, and moderation.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="block rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-600 hover:bg-slate-900"
            >
              <h2 className="text-lg font-semibold text-sky-300">{c.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{c.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs text-slate-600">
        Public vitrin:{' '}
        <Link href="/vitrin" className="text-sky-500 underline">
          /vitrin
        </Link>
      </p>
    </div>
  );
}
