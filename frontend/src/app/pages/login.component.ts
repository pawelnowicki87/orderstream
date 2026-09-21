import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { AuthResponse } from '../core/models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container auth-page">
      <div class="card auth-card">
        <h2>{{ registerMode() ? 'Create account' : 'Sign in' }}</h2>
        <p class="muted small">Or skip this entirely and look around with a throwaway account.</p>

        <button class="demo-button" (click)="demo()" [disabled]="loading()">
          ⚡ Continue as demo visitor
        </button>

        <div class="divider"><span>or with email</span></div>

        <form (ngSubmit)="submit()" class="auth-form">
          @if (registerMode()) {
            <input placeholder="Full name" [(ngModel)]="fullName" name="fullName" autocomplete="name">
          }
          <input placeholder="Email" type="email" [(ngModel)]="email" name="email" autocomplete="email">
          <input placeholder="Password" type="password" [(ngModel)]="password" name="password"
                 [attr.autocomplete]="registerMode() ? 'new-password' : 'current-password'">

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }

          <button type="submit" [disabled]="loading()">
            {{ loading() ? 'Please wait…' : (registerMode() ? 'Create account' : 'Sign in') }}
          </button>
        </form>

        <button class="link-button" (click)="toggleMode()">
          {{ registerMode() ? 'I already have an account' : 'New here? Create an account' }}
        </button>
      </div>
    </div>
  `
})
export class LoginComponent {

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  fullName = '';

  readonly registerMode = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  toggleMode(): void {
    this.registerMode.update(value => !value);
    this.error.set(null);
  }

  submit(): void {
    this.run(this.registerMode()
      ? this.auth.register(this.email, this.password, this.fullName)
      : this.auth.login(this.email, this.password));
  }

  demo(): void {
    this.run(this.auth.demoLogin());
  }

  private run(request$: Observable<AuthResponse>): void {
    this.error.set(null);
    this.loading.set(true);

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
