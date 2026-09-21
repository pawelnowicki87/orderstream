import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { AuthResponse } from './models';

const STORAGE_KEY = 'orderstream.auth';

/** A structurally valid JWT; the browser never verifies signatures, only reads `exp`. */
function tokenExpiringIn(seconds: number): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const exp = Math.floor(Date.now() / 1000) + seconds;
  return `${encode({ alg: 'HS384' })}.${encode({ sub: '7', exp })}.signature`;
}

function storedSession(token: string): AuthResponse {
  return { token, userId: 7, email: 'demo@orderstream.dev', fullName: 'Demo visitor' };
}

function setUp(): { auth: AuthService; http: HttpClient; backend: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()]
  });
  return {
    auth: TestBed.inject(AuthService),
    http: TestBed.inject(HttpClient),
    backend: TestBed.inject(HttpTestingController)
  };
}

describe('AuthService session expiry', () => {
  afterEach(() => localStorage.clear());

  it('keeps a stored session whose token is still valid', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession(tokenExpiringIn(3600))));

    const { auth } = setUp();

    expect(auth.isLoggedIn()).toBe(true);
  });

  it('treats a stored session with an expired token as signed out', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession(tokenExpiringIn(-60))));

    const { auth } = setUp();

    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('signs out when a protected request comes back 401', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession(tokenExpiringIn(3600))));
    const { auth, http, backend } = setUp();

    http.get('/api/orders').subscribe({ error: () => undefined });
    backend.expectOne('/api/orders').flush('', { status: 401, statusText: 'Unauthorized' });

    expect(auth.isLoggedIn()).toBe(false);
  });

  it('does not touch the session when a login attempt is rejected', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession(tokenExpiringIn(3600))));
    const { auth, http, backend } = setUp();

    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/auth/login').flush('', { status: 401, statusText: 'Unauthorized' });

    expect(auth.isLoggedIn()).toBe(true);
  });
});
