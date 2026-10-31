import { Link } from "react-router-dom";

/**
 * Public entry (/). App screens live under /testing.
 * Brand gradient is the design-system hero only; chrome uses the solid sidebar colour
 * so type stays readable on every screen size.
 */
export default function MainLandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full bg-[hsl(var(--sidebar-background))] pt-[env(safe-area-inset-top)] text-white">
        <div className="container flex h-14 items-center justify-between gap-3 px-4">
          <Link to="/" className="flex min-h-11 items-center gap-2 font-display font-bold text-white">
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-contain" aria-hidden />
            <span className="text-lg">ShiftED AI</span>
          </Link>
          <Link
            to="/testing/login"
            className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/10 active:scale-[0.96]"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-[hsl(var(--sidebar-background))] px-6 py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-4xl font-bold leading-tight text-white md:text-5xl">
              Build empathetic leaders, one conversation at a time
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-white">
              ShiftED AI is practice for first-time managers: constructive feedback, inclusive communication, and critical thinking. It is training, not therapy.
            </p>
            <div className="mt-10 flex justify-center">
              <Link
                to="/testing/login"
                className="inline-flex min-h-11 items-center rounded-xl bg-white px-6 text-base font-semibold text-foreground transition-transform duration-150 active:scale-[0.96]"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-xl px-6 py-14">
          <h2 className="font-display text-2xl font-bold text-foreground">One guided session</h2>
          <p className="mt-3 text-base leading-relaxed text-foreground">
            Sign in, then practise a difficult feedback conversation with the coach. Your journeys, tasks, and notes stay on this account.
          </p>
          <p className="mt-6">
            <Link to="/testing/login" className="inline-flex min-h-11 items-center font-medium text-primary">
              Continue to sign in
            </Link>
          </p>
        </section>
      </main>

      <footer className="bg-background px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center text-sm text-foreground">
        <p>ShiftED AI is empathy training for managers. It is not a substitute for professional support.</p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <a className="inline-flex min-h-11 items-center underline" href="https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-use-111/">NHS 111</a>
          <a className="inline-flex min-h-11 items-center underline" href="https://www.nhs24.scot/">NHS 24 (Scotland)</a>
          <a className="inline-flex min-h-11 items-center underline" href="https://www.mind.org.uk">Mind</a>
          <a className="inline-flex min-h-11 items-center underline" href="https://www.samaritans.org">Samaritans</a>
        </p>
      </footer>
    </div>
  );
}
