import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <header style="border-bottom: 1px solid var(--border);">
      <div class="container row" style="padding-top: 1rem; padding-bottom: 1rem;">
        <a routerLink="/restaurants" style="font-weight: 700; font-size: 1.2rem;">OrderStream</a>
        <nav style="display: flex; align-items: center; gap: 1rem;">
          <a routerLink="/restaurants">Restaurants</a>
          @if (auth.isLoggedIn()) {
            <a routerLink="/orders">My orders</a>
            <span class="muted">{{ auth.user()?.fullName }}</span>
            <button class="ghost" (click)="auth.logout()">Sign out</button>
          } @else {
            <a routerLink="/login">Sign in</a>
          }
        </nav>
      </div>
    </header>

    <router-outlet />
  `
})
export class App {
  readonly auth = inject(AuthService);
}
