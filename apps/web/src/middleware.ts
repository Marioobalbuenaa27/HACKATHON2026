// Guarda de borde para `/admin/*`: si no hay cookie de sesión, redirige al login.
// NO valida el JWT (eso es caro y corre en edge sin Prisma): la validación real la
// hacen `auth()` en el layout del panel y los guards de cada endpoint (NFR-S7).

import { NextResponse, type NextRequest } from "next/server";

const COOKIES_SESION = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // El login es la única ruta pública bajo /admin.
  if (pathname === "/admin/login") return NextResponse.next();

  const tieneCookie = COOKIES_SESION.some((c) => req.cookies.has(c));
  if (tieneCookie) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
