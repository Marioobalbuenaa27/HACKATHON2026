"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/http/cliente";
import { Button } from "@/components/ui/Button";
import { Field, inputBase } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

interface LoginResponse {
  usuarioId: string;
  nombre: string;
  rol: string;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const destino = next && next.startsWith("/admin") ? next : "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [errores, setErrores] = useState<{ email?: string; password?: string }>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrores({});
    setErrorGeneral(null);
    setCargando(true);
    try {
      await api.post<LoginResponse>("/api/admin/auth/login", { email, password });
      router.replace(destino);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400 && err.details) {
          setErrores({
            email: err.detalleDe("email"),
            password: err.detalleDe("password"),
          });
          if (!err.details.email && !err.details.password) setErrorGeneral(err.message);
        } else {
          setErrorGeneral(err.message);
        }
      } else {
        setErrorGeneral("Ocurrió un error inesperado.");
      }
      setCargando(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-margin-mobile py-space-2xl">
      <div className="flex w-full max-w-md flex-col gap-space-lg">
        <header className="flex flex-col gap-space-2xs">
          <span className="text-label-sm uppercase tracking-wide text-primary">
            Hospital Pediátrico Central
          </span>
          <h1 className="text-headline-lg text-on-surface">Acceso al panel</h1>
          <p className="text-body-md text-on-surface-variant">
            Ingresá con tu correo institucional y contraseña.
          </p>
        </header>

        <form
          onSubmit={enviar}
          noValidate
          className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm"
        >
          {errorGeneral && (
            <p
              role="alert"
              aria-live="assertive"
              className="flex items-center gap-space-xs rounded-lg bg-error-container px-space-sm py-space-xs text-body-sm text-on-error-container"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                error
              </span>
              {errorGeneral}
            </p>
          )}

          <Field label="Correo electrónico" error={errores.email} requerido>
            {(a11y) => (
              <div className="relative flex items-center">
                <span
                  className="material-symbols-outlined pointer-events-none absolute left-3 text-[20px] text-outline"
                  aria-hidden
                >
                  mail
                </span>
                <input
                  {...a11y}
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre.apellido@hospital.gob.ar"
                  className={cn(inputBase, "pl-10")}
                />
              </div>
            )}
          </Field>

          <Field label="Contraseña" error={errores.password} requerido>
            {(a11y) => (
              <div className="relative flex items-center">
                <span
                  className="material-symbols-outlined pointer-events-none absolute left-3 text-[20px] text-outline"
                  aria-hidden
                >
                  lock
                </span>
                <input
                  {...a11y}
                  type={verClave ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(inputBase, "pl-10 pr-11")}
                />
                <button
                  type="button"
                  onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="material-symbols-outlined absolute right-2 rounded-full p-1 text-[20px] text-on-surface-variant hover:bg-surface-container-low"
                >
                  {verClave ? "visibility_off" : "visibility"}
                </button>
              </div>
            )}
          </Field>

          <Button type="submit" icono="login" cargando={cargando} className="mt-space-2xs w-full">
            Iniciar sesión
          </Button>
        </form>

        <p className="text-center text-body-sm text-on-surface-variant">
          ¿Buscás sacar un turno?{" "}
          <Link href="/turnos" className="text-primary hover:underline">
            Ir al portal ciudadano
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
