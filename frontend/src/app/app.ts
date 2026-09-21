import { Component, DestroyRef, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from './core/auth.service';
import { StompService } from './core/stomp.service';
import { ToastService } from './core/toast.service';
import { OrderStatusEvent, STATUS_META } from './core/models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="site-header">
      <div class="container row header-inner">
        <a routerLink="/restaurants" class="brand">
          <img class="brand-mark" src="favicon.svg" alt="" width="32" height="32"> OrderStream
        </a>
        <nav class="nav">
          <a routerLink="/restaurants" routerLinkActive="active" class="nav-home">Restaurants</a>
          @if (auth.isLoggedIn()) {
            <a routerLink="/orders" routerLinkActive="active">My orders</a>
            <span class="user-chip" [title]="auth.user()?.email ?? ''">
              @if (stomp.connected()) {
                <span class="dot live" title="Live updates connected"></span>
              }
              {{ auth.user()?.fullName }}
            </span>
            <button class="ghost small" (click)="auth.logout()">Sign out</button>
          } @else {
            <a routerLink="/login" routerLinkActive="active">Sign in</a>
          }
        </nav>
      </div>
    </header>

    <main>
      <router-outlet />
    </main>

    <footer class="site-footer">
      <div class="container">
        Spring Boot microservices · gRPC · Kafka · WebSocket · Angular — a portfolio project.
      </div>
    </footer>

    <div class="toast-stack" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" role="status">
          <span class="toast-icon">{{ toast.icon }}</span>
          <div class="toast-body">
            <strong>{{ toast.title }}</strong>
            <p>{{ toast.message }}</p>
            @if (toast.link) {
              <a [routerLink]="toast.link" (click)="toasts.dismiss(toast.id)">Track it →</a>
            }
          </div>
          <button class="toast-close" (click)="toasts.dismiss(toast.id)" aria-label="Dismiss">×</button>
        </div>
      }
    </div>
  `
})
export class App {

  readonly auth = inject(AuthService);
  readonly stomp = inject(StompService);
  readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  private userEvents?: Subscription;

  constructor() {
    // Follow the signed-in user's orders wherever they are in the app, so a status change
    // shows up as a notification even while browsing another restaurant.
    effect(() => {
      const userId = this.auth.user()?.userId;
      this.userEvents?.unsubscribe();
      this.userEvents = undefined;

      if (userId) {
        this.userEvents = this.stomp.watch<OrderStatusEvent>(`/topic/users/${userId}`)
          .subscribe(event => this.notify(event));
      }
    });

    inject(DestroyRef).onDestroy(() => this.userEvents?.unsubscribe());
  }

  private notify(event: OrderStatusEvent): void {
    // PLACED always follows the user's own click, and it arrives while the router is still
    // navigating to the tracking page — a toast for it would only ever be noise.
    if (event.status === 'PLACED') {
      return;
    }
    // The tracking page for this order already shows the change.
    if (this.router.url.startsWith(`/orders/${event.orderId}`)) {
      return;
    }
    const meta = STATUS_META[event.status];
    this.toasts.show({
      icon: meta.icon,
      title: `Order #${event.orderId} · ${meta.label}`,
      message: `${event.restaurantName} — ${meta.blurb.toLowerCase()}.`,
      link: `/orders/${event.orderId}`
    });
  }
}
