import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      // The gateway rejected a token the browser still believed in — expired, or signed with a
      // secret that has since rotated. Drop the dead session so the UI stops pretending the
      // user is signed in. A 401 from the login endpoint itself is just a wrong password.
      if (error instanceof HttpErrorResponse && error.status === 401 && token
          && !req.url.includes('/api/auth/')) {
        auth.logout();
      }
      return throwError(() => error);
    })
  );
};
