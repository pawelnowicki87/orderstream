import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { OrderService } from '../core/order.service';
import { AuthService } from '../core/auth.service';
import { StompService } from '../core/stomp.service';
import { OrderStatus, OrderStatusEvent, OrderView, STATUS_META, formatPrice } from '../core/models';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container">
      <div class="section-head">
        <h2>My orders</h2>
        @if (orders().length > 0) {
          <span class="muted">Statuses update live — no refresh needed</span>
        }
      </div>

      @if (loading()) {
        <div class="order-list">
          @for (i of [1, 2, 3]; track i) {
            <div class="card skeleton" style="height: 76px;"></div>
          }
        </div>
      } @else if (orders().length === 0) {
        <div class="card empty-state">
          <p class="empty-icon">🍽️</p>
          <p>No orders yet.</p>
          <a class="button" routerLink="/restaurants">Browse restaurants</a>
        </div>
      } @else {
        <div class="order-list">
          @for (order of orders(); track order.id) {
            <a class="card order-row" [routerLink]="['/orders', order.id]">
              <span class="order-icon">{{ meta(order.status).icon }}</span>
              <div class="order-row-text">
                <strong>#{{ order.id }} · {{ order.restaurantName }}</strong>
                <div class="muted small">{{ price(order.totalCents) }} · {{ when(order.createdAt) }}</div>
              </div>
              <span class="status-chip" [attr.data-status]="order.status">{{ meta(order.status).label }}</span>
            </a>
          }
        </div>
      }
    </div>
  `
})
export class MyOrdersComponent implements OnInit, OnDestroy {

  private readonly orderService = inject(OrderService);
  private readonly auth = inject(AuthService);
  private readonly stomp = inject(StompService);

  readonly orders = signal<OrderView[]>([]);
  readonly loading = signal(true);

  private liveSubscription?: Subscription;

  ngOnInit(): void {
    this.orderService.myOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    const userId = this.auth.user()?.userId;
    if (userId) {
      this.liveSubscription = this.stomp.watch<OrderStatusEvent>(`/topic/users/${userId}`)
        .subscribe(event => this.orders.update(list => list.map(order =>
          order.id === event.orderId ? { ...order, status: event.status } : order)));
    }
  }

  ngOnDestroy(): void {
    this.liveSubscription?.unsubscribe();
  }

  meta(status: OrderStatus) {
    return STATUS_META[status];
  }

  price(cents: number): string {
    return formatPrice(cents);
  }

  when(iso: string): string {
    return new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
