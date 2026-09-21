import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';
import { RestaurantService } from '../core/restaurant.service';
import { OrderService } from '../core/order.service';
import { AuthService } from '../core/auth.service';
import { AuthResponse, RestaurantDetail, formatPrice } from '../core/models';

@Component({
  selector: 'app-restaurant-detail',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (restaurant(); as r) {
      <section class="restaurant-banner" [style.background-image]="'url(' + r.imageUrl + ')'">
        <div class="container banner-inner">
          <a routerLink="/restaurants" class="back-link light">← All restaurants</a>
          <span class="chip">{{ r.cuisine }}</span>
          <h1>{{ r.name }}</h1>
          <p>{{ availableCount() }} dishes available today</p>
        </div>
      </section>

      <div class="container menu-page">
        <div class="menu-list">
          @for (item of r.menu; track item.id) {
            <div class="card menu-item" [class.sold-out]="!item.available"
                 [class.in-cart]="quantityOf(item.id) > 0">
              <div class="menu-item-text">
                <div class="menu-item-head">
                  <strong>{{ item.name }}</strong>
                  @if (!item.available) {
                    <span class="badge">Sold out</span>
                  }
                </div>
                <p class="muted small">{{ item.description }}</p>
                <span class="price">{{ price(item.priceCents) }}</span>
              </div>
              <div class="stepper">
                <button class="ghost round" (click)="changeQuantity(item.id, -1)"
                        [disabled]="!item.available || quantityOf(item.id) === 0"
                        [attr.aria-label]="'Remove one ' + item.name">−</button>
                <span class="qty">{{ quantityOf(item.id) }}</span>
                <button class="round" (click)="changeQuantity(item.id, 1)"
                        [disabled]="!item.available"
                        [attr.aria-label]="'Add one ' + item.name">+</button>
              </div>
            </div>
          }
        </div>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <p class="muted small price-note">
          The total you see is an estimate — the real price is calculated by restaurant-service
          over gRPC when you order, so it cannot be tampered with in the browser.
        </p>
      </div>

      @if (itemCount() > 0) {
        <div class="order-bar">
          <div class="container order-bar-inner">
            <div>
              <strong>{{ itemCount() }} {{ itemCount() === 1 ? 'item' : 'items' }}</strong>
              <span class="muted"> · {{ price(estimatedTotal()) }}</span>
            </div>
            <button (click)="placeOrder()" [disabled]="placing()">
              {{ placing() ? 'Placing your order…' : (auth.isLoggedIn() ? 'Place order →' : 'Order as demo visitor →') }}
            </button>
          </div>
        </div>
      }
    } @else if (error()) {
      <div class="container"><p class="error">{{ error() }}</p></div>
    } @else {
      <div class="restaurant-banner skeleton"></div>
    }
  `
})
export class RestaurantDetailComponent implements OnInit {

  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly restaurantService = inject(RestaurantService);
  private readonly orderService = inject(OrderService);

  readonly restaurant = signal<RestaurantDetail | null>(null);
  readonly quantities = signal<Record<number, number>>({});
  readonly placing = signal(false);
  readonly error = signal<string | null>(null);

  readonly itemCount = computed(() =>
    Object.values(this.quantities()).reduce((sum, q) => sum + q, 0));

  readonly availableCount = computed(() =>
    (this.restaurant()?.menu ?? []).filter(item => item.available).length);

  readonly estimatedTotal = computed(() => {
    const menu = this.restaurant()?.menu ?? [];
    return menu.reduce((sum, item) => sum + item.priceCents * (this.quantities()[item.id] ?? 0), 0);
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.restaurantService.getOne(id).subscribe({
      next: (data) => this.restaurant.set(data),
      error: () => this.error.set('Could not load this restaurant.')
    });
  }

  quantityOf(menuItemId: number): number {
    return this.quantities()[menuItemId] ?? 0;
  }

  changeQuantity(menuItemId: number, delta: number): void {
    this.quantities.update(current => {
      const next = Math.max(0, (current[menuItemId] ?? 0) + delta);
      return { ...current, [menuItemId]: next };
    });
  }

  price(cents: number): string {
    return formatPrice(cents);
  }

  placeOrder(): void {
    const restaurantId = this.restaurant()?.id;
    if (!restaurantId) {
      return;
    }

    const items = Object.entries(this.quantities())
      .filter(([, quantity]) => quantity > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId: Number(menuItemId), quantity }));

    this.placing.set(true);
    this.error.set(null);

    // A visitor who is not signed in gets a demo account on the spot instead of a detour
    // through a registration form — the cart they built is kept.
    const signedIn: Observable<AuthResponse | null> =
      this.auth.isLoggedIn() ? of(null) : this.auth.demoLogin();

    signedIn.pipe(switchMap(() => this.orderService.place({ restaurantId, items }))).subscribe({
      next: (order) => {
        this.placing.set(false);
        this.router.navigate(['/orders', order.id], { state: { justPlaced: true } });
      },
      error: (err) => {
        this.placing.set(false);
        // On 401 the interceptor has already dropped the dead session, so the button now
        // offers a fresh demo account and the cart is still here.
        this.error.set(err?.status === 401
          ? 'Your session expired. Your cart is still here — place the order again to continue.'
          : err?.error?.message ?? 'Could not place the order.');
      }
    });
  }
}
