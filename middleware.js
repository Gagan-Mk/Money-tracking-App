import { NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from './lib/auth';

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === '/login' ||
    pathname === '/api/login' ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json';

  if (isPublic) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
