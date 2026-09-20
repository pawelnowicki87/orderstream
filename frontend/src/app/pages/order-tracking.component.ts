import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrderService } from '../core/order.service';
import { LiveOrderService } from '../core/live-order.service';
import { ORDER_STATUS_FLOW, OrderStatus, OrderView } from '../core/models';

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container" style="max-width: 640px;">
      @if (order(); as o) {
        <h2>Order #{{ o.id }}</h2>
        <p class="muted">{{ o.restaurantName }} — {{ formatPrice(o.totalCents) }}</p>

        <div class="card" style="margin-top: 1rem;">
          @for (step of flow; track step) {
            <div class="row" style="padding: 0.6rem 0; border-bottom: 1px solid var(--border);">
              <span [style.color]="isReached(step, o.status) ? 'var(--ok)' : 'var(--muted)'">
                {{ isReached(step, o.status) ? '●' : '○' }} {{ label(step) }}
              </span>
              @if (step === o.status) {
                <span class="muted" style="font-size: 0.85rem;">current</span>
              }
            </div>
          }
        </div>

        <p class="muted" style="margin-top: 1rem; font-size: 0.9rem;">
          {{ connected() ? 'Live — updates arrive over WebSocket as Kafka events are consumed.'
                         : 'Connecting to the live feed...' }}
        </p>

        <a routerLink="/orders">Back to my orders</a>
      } @else if (error()) {
        <p class="error">{{ error() }}</p>
      } @else {
        <p class="muted">Loading...</p>
      }
    </div>
  `
})
export class OrderTrackingComponent implements OnInit, OnDestroy {

  readonly flow = ORDER_STATUS_FLOW;
  readonly order = signal<OrderView | null>(null);
  readonly connected = signal(false);
  readonly error = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private liveOrders: LiveOrderService) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    this.orderService.getOne(id).subscribe({
      next: (data) => this.order.set(data),
      error: () => this.error.set('Could not load this order.')
    });

    this.liveOrders.watchOrder(id).subscribe(event => {
      this.connected.set(true);
      this.order.update(current =>
        current ? { ...current, status: event.status, updatedAt: event.occurredAt } : current);
    });
  }

  ngOnDestroy(): void {
    this.liveOrders.disconnect();
  }

  isReached(step: OrderStatus, current: OrderStatus): boolean {
    return this.flow.indexOf(step) <= this.flow.indexOf(current);
  }

  label(status: OrderStatus): string {
    return status.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
  }

  formatPrice(cents: number): string {
    return (cents / 100).toFixed(2) + ' zl';
  }
}
