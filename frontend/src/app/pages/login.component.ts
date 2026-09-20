import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container" style="max-width: 420px;">
      <div class="card">
        <h2>{{ registerMode() ? 'Create account' : 'Sign in' }}</h2>

        <div style="display: grid; gap: 0.75rem; margin-top: 1rem;">
          @if (registerMode()) {
            <input placeholder="Full name" [(ngModel)]="fullName" name="fullName">
          }
          <input placeholder="Email" type="email" [(ngModel)]="email" name="email">
          <input placeholder="Password" type="password" [(ngModel)]="password" name="password">
        </div>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <div class="row" style="margin-top: 1rem;">
          <button (click)="submit()" [disabled]="loading()">
            {{ loading() ? 'Please wait...' : (registerMode() ? 'Register' : 'Sign in') }}
          </button>
          <button class="ghost" (click)="toggleMode()">
            {{ registerMode() ? 'I already have an account' : 'Create an account' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {

  email = '';
  password = '';
  fullName = '';

  readonly registerMode = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor(private auth: AuthService, private router: Router) {}

  toggleMode(): void {
    this.registerMode.update(value => !value);
    this.error.set(null);
  }

  submit(): void {
    this.error.set(null);
    this.loading.set(true);

    const request$ = this.registerMode()
      ? this.auth.register(this.email, this.password, this.fullName)
      : this.auth.login(this.email, this.password);

    request$.subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/restaurants']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Something went wrong. Check your details and try again.');
      }
    });
  }
}
