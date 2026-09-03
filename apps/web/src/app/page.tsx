import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-margin-mobile py-space-2xl">
      <div className="flex w-full max-w-md flex-col gap-space-lg">
        <header className="flex flex-col gap-space-2xs">
          <span className="text-label-sm uppercase text-primary">
            Hospital Pediátrico Central
          </span>
          <h1 className="text-display-lg-mobile text-on-surface">Turnero JP</h1>
          <p className="text-body-md text-on-surface-variant">
            Gestión de turnos ambulatorios pediátricos.
          </p>
        </header>

        <nav className="flex flex-col gap-space-xs">
          <Link
            href="/admin"
            className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-sm transition-colors hover:bg-surface-container-low"
          >
            <span className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary">
                lock
              </span>
              <span className="flex flex-col">
                <span className="text-label-lg text-on-surface">
                  Acceso Personal
                </span>
                <span className="text-body-sm text-on-surface-variant">
                  Administración, recepción y consultorio
                </span>
              </span>
            </span>
            <span className="material-symbols-outlined text-on-surface-variant">
              arrow_forward
            </span>
          </Link>

          <Link
            href="/turnos"
            className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-sm transition-colors hover:bg-surface-container-low"
          >
            <span className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-secondary">
                calendar_month
              </span>
              <span className="flex flex-col">
                <span className="text-label-lg text-on-surface">
                  Portal Ciudadano
                </span>
                <span className="text-body-sm text-on-surface-variant">
                  Reservá un turno sin iniciar sesión
                </span>
              </span>
            </span>
            <span className="material-symbols-outlined text-on-surface-variant">
              arrow_forward
            </span>
          </Link>
        </nav>
      </div>
    </main>
  );
}
