import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { AuthResponse } from './models';

const STORAGE_KEY = 'orderstream.auth';

/** setTimeout stores its delay in a signed 32-bit integer; anything longer fires immediately. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * Reads the `exp` claim (seconds since epoch) from a JWT. The browser cannot verify the
 * signature and does not need to — the gateway does that. This is only about knowing when
 * the session stops working, so the UI does not keep claiming the user is signed in.
 */
function expiresAt(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload)) as { exp?: unknown };
    return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isExpired(token: string): boolean {
  const expiry = expiresAt(token);
  return expiry !== null && expiry <= Date.now();
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly currentUser = signal<AuthResponse | null>(this.readFromStorage());

  readonly user = this.currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  private expiryTimer?: ReturnType<typeof setTimeout>;

  constructor(private http: HttpClient) {
    const restored = this.currentUser();
    if (restored) {
      this.scheduleExpiry(restored.token);
    }
  }

  register(email: string, password: string, fullName: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/api/auth/register`, { email, password, fullName })
      .pipe(tap(response => this.store(response)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/api/auth/login`, { email, password })
      .pipe(tap(response => this.store(response)));
  }

  /**
   * One-click access for people who just want to see the app work. Each visitor gets a fresh
   * throwaway account, so two people trying the demo at once never see each other's orders.
   */
  demoLogin(): Observable<AuthResponse> {
    const suffix = crypto.randomUUID().slice(0, 8);
    return this.register(
      `demo-${suffix}@orderstream.dev`,
      crypto.randomUUID(),
      'Demo visitor');
  }

  logout(): void {
    clearTimeout(this.expiryTimer);
    localStorage.removeItem(STORAGE_KEY);
    this.currentUser.set(null);
  }

  get token(): string | null {
    return this.currentUser()?.token ?? null;
  }

  private store(response: AuthResponse): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response));
    this.currentUser.set(response);
    this.scheduleExpiry(response.token);
  }

  /** A tab left open past the token's lifetime flips to signed-out on its own. */
  private scheduleExpiry(token: string): void {
    clearTimeout(this.expiryTimer);
    const expiry = expiresAt(token);
    if (expiry !== null) {
      this.expiryTimer = setTimeout(() => this.logout(), Math.min(expiry - Date.now(), MAX_TIMER_MS));
    }
  }

  private readFromStorage(): AuthResponse | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const session = JSON.parse(raw) as AuthResponse;
      if (isExpired(session.token)) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return session;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }
}
