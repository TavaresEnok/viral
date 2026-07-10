import { Logo } from '@/components/layout/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="grid min-h-screen overflow-hidden bg-base lg:grid-cols-2">
      {/* Painel lime */}
      <section className="relative hidden bg-accent p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-[#10120A]">
            <svg viewBox="0 0 12 12" className="ml-0.5 h-3.5 w-3.5" aria-hidden="true">
              <path d="M2.4 1.2 L10.6 6 L2.4 10.8 Z" fill="#C8F542" />
            </svg>
          </div>
          <span className="font-display text-[22px] font-extrabold lowercase leading-none tracking-tight text-[#10120A]">
            viral.
          </span>
        </div>
        <h1
          className="max-w-xl font-display font-extrabold leading-[1.04] tracking-[-0.03em] text-[#10120A]"
          style={{ fontSize: 'clamp(40px, 4.4vw, 64px)' }}
        >
          O algoritmo ama quem posta todo dia.
        </h1>
        <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-[#10120A]/70">
          cortes 9:16 · legenda queimada · score viral
        </p>
      </section>
      <section className="grid place-items-center px-4 py-10">
        <div className="w-full max-w-[430px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
