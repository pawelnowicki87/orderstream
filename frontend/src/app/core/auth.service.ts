import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { AuthResponse } from './models';

const STORAGE_KEY = 'orderstream.auth';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly currentUser = signal<AuthResponse | null>(this.readFromStorage());

  readonly user = this.currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  constructor(private http: HttpClient) {}

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
    localStorage.removeItem(STORAGE_KEY);
    this.currentUser.set(null);
  }

  get token(): string | null {
    return this.currentUser()?.token ?? null;
  }

  private store(response: AuthResponse): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response));
    this.currentUser.set(response);
  }

  private readFromStorage(): AuthResponse | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthResponse;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }
}
