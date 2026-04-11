import Link from 'next/link';

const highlights = [
  {
    title: 'گفتگو و ارتباط',
    body: 'چت مستقیم و گروهی با تجربه‌ای ساده و یکدست.',
    icon: '◉',
  },
  {
    title: 'گروه‌ها و شبکه‌ها',
    body: 'کنار هم جمع شوید؛ بر اساس علایق، محله یا هر جمعی که برایتان مهم است.',
    icon: '◎',
  },
  {
    title: 'محله‌محور',
    body: 'تمرکز بر جامعهٔ نزدیک؛ کمتر شلوغی، بیشتر ارتباط معنادار.',
    icon: '⌂',
  },
  {
    title: 'فارسی‌محور',
    body: 'رابط کاربری و متن‌ها برای فارسی و راست‌به‌چپ طراحی شده‌اند.',
    icon: '✦',
  },
] as const;

export default function LandingPage() {
  return (
    <main
      className="relative min-h-[calc(100dvh-3.5rem)] overflow-x-hidden"
      dir="rtl"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[#f7f9f9]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -start-24 top-0 h-72 w-72 rounded-full bg-sky-200/25 blur-3xl sm:-start-16 sm:top-8"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -end-20 bottom-32 h-64 w-64 rounded-full bg-slate-300/20 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-lg px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
        <header className="text-center sm:text-start">
          <p className="text-sm font-semibold text-sky-700">شبکه‌ای برای نزدیکی بیشتر</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            توت
          </h1>
          <p className="mx-auto mt-4 max-w-md text-pretty text-base leading-relaxed text-slate-600 sm:mx-0 sm:text-lg">
            پیام‌رسانی و شبکهٔ اجتماعی برای ارتباط نزدیک‌تر با محله، دوستان و جمع‌هایی
            که برایتان مهم‌اند — ساده، فارسی و متمرکز بر شما.
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-3 sm:mt-12 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
          <Link
            href="/login"
            className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-2xl bg-slate-900 px-6 text-base font-bold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 active:scale-[0.99] sm:w-auto sm:min-w-[10.5rem]"
          >
            ورود
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-2xl border border-slate-200/90 bg-white/90 px-6 text-base font-bold text-slate-900 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:bg-white active:scale-[0.99] sm:w-auto sm:min-w-[10.5rem]"
          >
            ثبت‌نام
          </Link>
        </div>

        <section className="mt-14 sm:mt-16" aria-labelledby="landing-highlights">
          <h2
            id="landing-highlights"
            className="text-center text-sm font-extrabold text-slate-800 sm:text-start"
          >
            در یک نگاه
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4">
            {highlights.map((item) => (
              <li
                key={item.title}
                className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm ring-1 ring-slate-100/80 backdrop-blur-sm sm:p-5"
              >
                <div className="flex gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-lg text-sky-700"
                    aria-hidden
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
