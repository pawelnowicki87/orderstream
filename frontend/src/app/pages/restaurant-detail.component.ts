import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RestaurantService } from '../core/restaurant.service';
import { OrderService } from '../core/order.service';
import { AuthService } from '../core/auth.service';
import { RestaurantDetail } from '../core/models';

@Component({
  selector: 'app-restaurant-detail',
  standalone: true,
  template: `
    <div class="container">
      @if (restaurant(); as r) {
        <h2>{{ r.name }}</h2>
        <p class="muted">{{ r.cuisine }}</p>

        <div style="display: grid; gap: 0.75rem; margin-top: 1rem;">
          @for (item of r.menu; track item.id) {
            <div class="card row">
              <div>
                <strong>{{ item.name }}</strong>
                <div class="muted" style="font-size: 0.9rem;">{{ item.description }}</div>
                <div style="margin-top: 0.25rem;">{{ formatPrice(item.priceCents) }}</div>
                @if (!item.available) {
                  <div class="error" style="font-size: 0.85rem;">Currently unavailable</div>
                }
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <button class="ghost" (click)="changeQuantity(item.id, -1)"
                        [disabled]="!item.available || quantityOf(item.id) === 0">-</button>
                <span style="min-width: 1.5rem; text-align: center;">{{ quantityOf(item.id) }}</span>
                <button class="ghost" (click)="changeQuantity(item.id, 1)"
                        [disabled]="!item.available">+</button>
              </div>
            </div>
          }
        </div>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <div class="card row" style="margin-top: 1rem;">
          <strong>Total: {{ formatPrice(estimatedTotal()) }}</strong>
          <button (click)="placeOrder()" [disabled]="itemCount() === 0 || placing()">
            {{ placing() ? 'Placing...' : 'Place order' }}
          </button>
        </div>
        <p class="muted" style="font-size: 0.85rem;">
          The final price is calculated by restaurant-service over gRPC, not by this page.
        </p>
      } @else {
        <p class="muted">Loading...</p>
      }
    </div>
  `
})
export class RestaurantDetailComponent implements OnInit {

  readonly restaurant = signal<RestaurantDetail | null>(null);
  readonly quantities = signal<Record<number, number>>({});
  readonly placing = signal(false);
  readonly error = signal<string | null>(null);

  readonly itemCount = computed(() =>
    Object.values(this.quantities()).reduce((sum, q) => sum + q, 0));

  readonly estimatedTotal = computed(() => {
    const menu = this.restaurant()?.menu ?? [];
    return menu.reduce((sum, item) => sum + item.priceCents * (this.quantities()[item.id] ?? 0), 0);
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private restaurantService: RestaurantService,
    private orderService: OrderService,
    private auth: AuthService) {}

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

  formatPrice(cents: number): string {
    return (cents / 100).toFixed(2) + ' zl';
  }

  placeOrder(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    const restaurantId = this.restaurant()?.id;
    if (!restaurantId) {
      return;
    }

    const items = Object.entries(this.quantities())
      .filter(([, quantity]) => quantity > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId: Number(menuItemId), quantity }));

    this.placing.set(true);
    this.error.set(null);

    this.orderService.place({ restaurantId, items }).subscribe({
      next: (order) => {
        this.placing.set(false);
        this.router.navigate(['/orders', order.id]);
      },
      error: (err) => {
        this.placing.set(false);
        this.error.set(err?.error?.message ?? 'Could not place the order.');
      }
    });
  }
}
