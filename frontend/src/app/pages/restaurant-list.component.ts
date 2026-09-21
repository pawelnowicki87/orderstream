import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RestaurantService } from '../core/restaurant.service';
import { AuthService } from '../core/auth.service';
import { ToastService } from '../core/toast.service';
import { RestaurantSummary } from '../core/models';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-restaurant-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="hero">
      <div class="container hero-inner">
        <span class="eyebrow"><span class="dot"></span> Live demo</span>
        <h1 class="hero-title">
          Order food. Watch it travel through
          <span class="accent">five microservices</span> in real time.
        </h1>
        <p class="hero-lead">
          Place an order and follow every step — a gRPC call prices it, Kafka carries each status
          change, and a WebSocket pushes it to your screen the moment it happens.
        </p>

        <div class="hero-cta">
          @if (auth.isLoggedIn()) {
            <a class="button" href="#restaurants">Pick a restaurant ↓</a>
          } @else {
            <button (click)="tryDemo()" [disabled]="startingDemo()">
              {{ startingDemo() ? 'Setting up your demo…' : 'Try the demo — no sign-up' }}
            </button>
          }
          @if (repoUrl) {
            <a class="button ghost" [href]="repoUrl" target="_blank" rel="noopener">View the source</a>
          }
        </div>

        <ul class="stack-chips" aria-label="Technology stack">
          @for (tech of stack; track tech) {
            <li>{{ tech }}</li>
          }
        </ul>
      </div>
    </section>

    <div class="container" id="restaurants">
      <div class="section-head">
        <h2>Restaurants</h2>
        @if (!loading() && !error()) {
          <span class="muted">{{ restaurants().length }} places open now</span>
        }
      </div>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      } @else {
        <div class="grid">
          @if (loading()) {
            @for (i of placeholders; track i) {
              <div class="card restaurant-card skeleton-card">
                <div class="skeleton img"></div>
                <div class="skeleton line"></div>
                <div class="skeleton line short"></div>
              </div>
            }
          } @else {
            @for (restaurant of restaurants(); track restaurant.id) {
              <a class="card restaurant-card" [routerLink]="['/restaurants', restaurant.id]">
                <div class="restaurant-img">
                  <img [src]="restaurant.imageUrl" [alt]="restaurant.name" loading="lazy">
                  <span class="chip">{{ restaurant.cuisine }}</span>
                </div>
                <h3>{{ restaurant.name }}</h3>
                <p class="muted">View menu →</p>
              </a>
            }
          }
        </div>
      }
    </div>
  `
})
export class RestaurantListComponent implements OnInit {

  readonly auth = inject(AuthService);
  private readonly restaurantService = inject(RestaurantService);
  private readonly toasts = inject(ToastService);

  readonly restaurants = signal<RestaurantSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly startingDemo = signal(false);

  readonly repoUrl = environment.repoUrl;
  readonly placeholders = [1, 2, 3, 4, 5, 6];
  readonly stack = ['Java 21', 'Spring Boot', 'gRPC', 'Apache Kafka', 'WebSocket', 'PostgreSQL', 'Angular', 'Docker'];

  ngOnInit(): void {
    this.restaurantService.listAll().subscribe({
      next: (data) => {
        this.restaurants.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load restaurants. Is the backend running?');
        this.loading.set(false);
      }
    });
  }

  tryDemo(): void {
    this.startingDemo.set(true);
    this.auth.demoLogin().subscribe({
      next: () => {
        this.startingDemo.set(false);
        this.toasts.show({
          icon: '👋',
          title: 'You are in',
          message: 'Pick a restaurant, add a few dishes and place an order.'
        });
        document.getElementById('restaurants')?.scrollIntoView({ behavior: 'smooth' });
      },
      error: () => {
        this.startingDemo.set(false);
        this.toasts.show({
          icon: '⚠️',
          title: 'The demo could not start',
          message: 'The backend did not answer. It may still be waking up — try again in a moment.'
        });
      }
    });
  }
}
