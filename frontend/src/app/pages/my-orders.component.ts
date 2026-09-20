import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderService } from '../core/order.service';
import { OrderView } from '../core/models';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container">
      <h2>My orders</h2>

      @if (loading()) {
        <p class="muted">Loading...</p>
      } @else if (orders().length === 0) {
        <p class="muted">No orders yet. <a routerLink="/restaurants">Browse restaurants</a>.</p>
      } @else {
        <div style="display: grid; gap: 0.75rem;">
          @for (order of orders(); track order.id) {
            <a class="card row" [routerLink]="['/orders', order.id]" style="color: inherit;">
              <div>
                <strong>#{{ order.id }} — {{ order.restaurantName }}</strong>
                <div class="muted" style="font-size: 0.9rem;">{{ formatPrice(order.totalCents) }}</div>
              </div>
              <span class="muted">{{ order.status }}</span>
            </a>
          }
        </div>
      }
    </div>
  `
})
export class MyOrdersComponent implements OnInit {

  readonly orders = signal<OrderView[]>([]);
  readonly loading = signal(true);

  constructor(private orderService: OrderService) {}

  ngOnInit(): void {
    this.orderService.myOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  formatPrice(cents: number): string {
    return (cents / 100).toFixed(2) + ' zl';
  }
}
