import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/** Canonical education hub lives at `/spaces/education`; legacy links used `/spaces/EDUCATION`. */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/spaces/EDUCATION') {
    const url = request.nextUrl.clone();
    url.pathname = '/spaces/education';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/spaces/EDUCATION'],
};
