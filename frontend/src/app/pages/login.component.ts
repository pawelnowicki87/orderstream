import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { AuthResponse } from '../core/models';

/** Same rule as `RegisterRequest` in auth-service, so the user hears about it before the round trip. */
const MIN_PASSWORD_LENGTH = 6;

type Field = 'fullName' | 'email' | 'password';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="container auth-page">
      <div class="card auth-card">
        <h2>{{ registerMode() ? 'Create account' : 'Sign in' }}</h2>
        <p class="muted small">Or skip this entirely and look around with a throwaway account.</p>

        <button class="demo-button" (click)="demo()" [disabled]="loading()">
          ⚡ Continue as demo visitor
        </button>

        <div class="divider"><span>or with email</span></div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form">
          @if (registerMode()) {
            <input placeholder="Full name" formControlName="fullName" autocomplete="name"
                   [attr.aria-invalid]="showError('fullName')">
            @if (showError('fullName')) {
              <p class="error small field-error">Tell us your name.</p>
            }
          }

          <input placeholder="Email" type="email" formControlName="email" autocomplete="email"
                 [attr.aria-invalid]="showError('email')">
          @if (showError('email')) {
            <p class="error small field-error">
              {{ form.controls.email.hasError('required') ? 'Email is required.' : 'That does not look like an email address.' }}
            </p>
          }

          <input placeholder="Password" type="password" formControlName="password"
                 [attr.autocomplete]="registerMode() ? 'new-password' : 'current-password'"
                 [attr.aria-invalid]="showError('password')">
          @if (showError('password')) {
            <p class="error small field-error">
              {{ form.controls.password.hasError('required') ? 'Password is required.' : 'Use at least ' + minPasswordLength + ' characters.' }}
            </p>
          }

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

  readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  /** The name only matters when creating an account, so it starts disabled and out of the validity check. */
  readonly form = inject(NonNullableFormBuilder).group({
    fullName: [{ value: '', disabled: true }, Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  readonly registerMode = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  toggleMode(): void {
    this.registerMode.update(value => !value);
    this.applyModeRules();
    this.error.set(null);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password, fullName } = this.form.getRawValue();
    this.run(this.registerMode()
      ? this.auth.register(email, password, fullName)
      : this.auth.login(email, password));
  }

  demo(): void {
    this.run(this.auth.demoLogin());
  }

  /** A message shows up once the user has left the field or tried to submit, not after the first keystroke. */
  showError(field: Field): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  /**
   * Signing in only needs both fields filled in. Creating an account also needs a name and a password
   * long enough for the backend, and checking that here saves a request that would come back 400.
   */
  private applyModeRules(): void {
    const { fullName, password } = this.form.controls;
    if (this.registerMode()) {
      fullName.enable();
      password.setValidators([Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]);
    } else {
      fullName.disable();
      password.setValidators(Validators.required);
    }
    password.updateValueAndValidity();
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
