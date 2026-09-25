import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../core/auth.service';
import { AuthResponse } from '../core/models';

const session: AuthResponse = { token: 'token', userId: 7, email: 'ada@example.com', fullName: 'Ada Lovelace' };

function setUp() {
  const auth = {
    login: vi.fn(() => of(session)),
    register: vi.fn(() => of(session)),
    demoLogin: vi.fn(() => of(session))
  };
  TestBed.configureTestingModule({
    imports: [LoginComponent],
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }]
  });
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture = TestBed.createComponent(LoginComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, auth, router };
}

describe('LoginComponent form', () => {

  it('does not call the backend while the form is invalid, and says why', () => {
    const { fixture, component, auth } = setUp();

    component.submit();
    fixture.detectChanges();

    expect(auth.login).not.toHaveBeenCalled();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Email is required.');
    expect(text).toContain('Password is required.');
  });

  it('rejects an email address without a domain', () => {
    const { component } = setUp();

    component.form.controls.email.setValue('ada');

    expect(component.form.controls.email.hasError('email')).toBe(true);
  });

  it('signs in with the typed credentials and goes to the restaurants', () => {
    const { component, auth, router } = setUp();

    component.form.patchValue({ email: 'ada@example.com', password: 'abc' });
    component.submit();

    expect(auth.login).toHaveBeenCalledWith('ada@example.com', 'abc');
    expect(router.navigate).toHaveBeenCalledWith(['/restaurants']);
  });

  it('asks for a name and a longer password only when creating an account', () => {
    const { component, auth } = setUp();
    component.form.patchValue({ email: 'ada@example.com', password: 'abc' });
    expect(component.form.valid).toBe(true);

    component.toggleMode();

    expect(component.form.controls.fullName.hasError('required')).toBe(true);
    expect(component.form.controls.password.hasError('minlength')).toBe(true);

    component.form.patchValue({ fullName: 'Ada Lovelace', password: 'longer-secret' });
    component.submit();

    expect(auth.register).toHaveBeenCalledWith('ada@example.com', 'longer-secret', 'Ada Lovelace');
  });

  it('drops the registration rules again when switching back to sign in', () => {
    const { component } = setUp();
    component.toggleMode();
    component.toggleMode();

    component.form.patchValue({ email: 'ada@example.com', password: 'abc' });

    expect(component.form.valid).toBe(true);
    expect(component.form.controls.fullName.disabled).toBe(true);
  });
});
