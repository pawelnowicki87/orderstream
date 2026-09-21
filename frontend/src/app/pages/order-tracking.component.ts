import { Component, ElementRef, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { OrderService } from '../core/order.service';
import { StompService } from '../core/stomp.service';
import {
  DEMO_STEP_MS, ORDER_STATUS_FLOW, OrderStatus, OrderStatusEvent, OrderView, STATUS_META, formatPrice
} from '../core/models';
import { FlowKind, FlowTrigger, SystemFlowComponent } from '../components/system-flow.component';

interface LogEntry {
  id: number;
  time: string;
  tag: 'REST' | 'gRPC' | 'KAFKA' | 'WS';
  text: string;
}

const CONFETTI_COLOURS = ['#ff6b35', '#34d399', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa'];

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [RouterLink, SystemFlowComponent],
  template: `
    <div class="container tracking">
      @if (order(); as o) {
        <header class="tracking-head">
          <div>
            <p class="eyebrow">Order #{{ o.id }}</p>
            <h1 class="tracking-title">
              <span class="tracking-icon">{{ meta(o.status).icon }}</span> {{ meta(o.status).label }}
            </h1>
            <p class="muted">{{ o.restaurantName }} · {{ price(o.totalCents) }}</p>
          </div>
          <span class="live-pill" [class.on]="stomp.connected()">
            <span class="dot"></span>{{ stomp.connected() ? 'Live' : 'Connecting…' }}
          </span>
        </header>

        <div class="tracking-layout">
          <section class="card flow-card" #flowCard>
            <div class="flow-card-head">
              <div>
                <h2 class="section-title">What just happened in the backend</h2>
                <p class="muted small">Every status change is a Kafka event consumed by notification-service
                  and pushed to this tab over WebSocket. Watch the path light up.</p>
              </div>
            </div>
            <app-system-flow [trigger]="flowTrigger()" />
          </section>

          <section class="card status-card">
            <div class="progress" role="progressbar" [attr.aria-valuenow]="progress(o.status)"
                 aria-valuemin="0" aria-valuemax="100">
              <div class="progress-fill" [style.width.%]="progress(o.status)"></div>
            </div>

            <p class="muted small replay-hint">Tap a completed step to replay its path on the diagram.</p>

            <ol class="steps">
              @for (step of flow; track step) {
                <li>
                  <button type="button" class="step"
                          [class.done]="reached(step, o.status)"
                          [class.current]="step === o.status"
                          [class.replaying]="replaying() === step"
                          [disabled]="!reached(step, o.status)"
                          (click)="replay(step)"
                          [attr.aria-label]="'Replay the ' + meta(step).label + ' step on the diagram'">
                    <span class="step-icon">{{ meta(step).icon }}</span>
                    <span class="step-text">
                      <strong>{{ meta(step).label }}</strong>
                      <span class="muted small">{{ meta(step).blurb }}</span>
                    </span>
                    @if (reached(step, o.status)) {
                      <span class="step-replay" aria-hidden="true">↻</span>
                    }
                  </button>
                </li>
              }
            </ol>

            @if (o.status === 'DELIVERED') {
              <div class="delivered-banner">🎉 Delivered — enjoy your meal!</div>
            } @else {
              <p class="muted small next-update">
                Next update in ~{{ nextUpdateIn() }}s · the demo simulator moves every order one step
                every {{ stepSeconds }} seconds
              </p>
            }

            <a routerLink="/orders" class="back-link">← My orders</a>

            @if (celebrate()) {
              <div class="confetti" aria-hidden="true">
                @for (piece of confetti; track $index) {
                  <span [style]="piece"></span>
                }
              </div>
            }
          </section>

          <section class="card log-card">
            <h2 class="section-title">Event log</h2>
            <ul class="event-log">
              @for (entry of log(); track entry.id) {
                <li>
                  <time>{{ entry.time }}</time>
                  <span class="tag" [attr.data-tag]="entry.tag">{{ entry.tag }}</span>
                  <span class="log-text">{{ entry.text }}</span>
                </li>
              } @empty {
                <li class="muted">Waiting for the next event…</li>
              }
            </ul>
          </section>
        </div>
      } @else if (error()) {
        <div class="card empty-state">
          <p class="error">{{ error() }}</p>
          <a routerLink="/orders">Back to my orders</a>
        </div>
      } @else {
        <div class="tracking-layout">
          <div class="card skeleton flow-card" style="height: 320px;"></div>
          <div class="card skeleton status-card" style="height: 420px;"></div>
          <div class="card skeleton log-card" style="height: 420px;"></div>
        </div>
      }
    </div>
  `
})
export class OrderTrackingComponent implements OnInit, OnDestroy {

  readonly stomp = inject(StompService);
  private readonly route = inject(ActivatedRoute);
  private readonly orderService = inject(OrderService);
  private readonly flowCard = viewChild<ElementRef<HTMLElement>>('flowCard');

  readonly flow = ORDER_STATUS_FLOW;
  readonly stepSeconds = DEMO_STEP_MS / 1000;

  readonly order = signal<OrderView | null>(null);
  readonly error = signal<string | null>(null);
  readonly log = signal<LogEntry[]>([]);
  readonly flowTrigger = signal<FlowTrigger | null>(null);
  readonly celebrate = signal(false);
  readonly replaying = signal<OrderStatus | null>(null);

  private readonly now = signal(Date.now());
  private readonly lastEventAt = signal(Date.now());

  readonly nextUpdateIn = computed(() =>
    Math.max(0, Math.ceil((this.lastEventAt() + DEMO_STEP_MS - this.now()) / 1000)));

  readonly confetti = Array.from({ length: 36 }, (_, i) => {
    const x = Math.round((Math.random() - 0.5) * 520);
    const y = Math.round(-120 - Math.random() * 200);
    const r = Math.round(Math.random() * 720 - 360);
    const colour = CONFETTI_COLOURS[i % CONFETTI_COLOURS.length];
    const delay = Math.round(Math.random() * 180);
    return `--x:${x}px;--y:${y}px;--r:${r}deg;--c:${colour};animation-delay:${delay}ms`;
  });

  private logId = 1;
  private flowSeq = 1;
  private ticker?: ReturnType<typeof setInterval>;
  private replayTimers: ReturnType<typeof setTimeout>[] = [];
  private liveSubscription?: Subscription;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const state = history.state as { justPlaced?: boolean } | null;

    this.ticker = setInterval(() => this.now.set(Date.now()), 500);

    this.orderService.getOne(id).subscribe({
      next: order => {
        this.order.set(order);
        this.lastEventAt.set(this.sane(Date.parse(order.updatedAt)));

        if (state?.justPlaced) {
          this.addLog('REST', `POST /api/orders → api-gateway validated your JWT, routed to order-service`);
          this.addLog('gRPC', `ValidateOrder → restaurant-service priced it at ${formatPrice(order.totalCents)}`);
          this.addLog('KAFKA', `order-events ← PLACED (key = order ${order.id})`);
          this.fire('place');
        }
      },
      error: () => this.error.set('This order does not exist, or it belongs to someone else.')
    });

    this.liveSubscription = this.stomp.watch<OrderStatusEvent>(`/topic/orders/${id}`)
      .subscribe(event => this.onEvent(event));
  }

  ngOnDestroy(): void {
    clearInterval(this.ticker);
    this.replayTimers.forEach(clearTimeout);
    this.liveSubscription?.unsubscribe();
  }

  meta(status: OrderStatus) {
    return STATUS_META[status];
  }

  price(cents: number): string {
    return formatPrice(cents);
  }

  reached(step: OrderStatus, current: OrderStatus): boolean {
    return this.flow.indexOf(step) <= this.flow.indexOf(current);
  }

  progress(status: OrderStatus): number {
    const index = this.flow.indexOf(status);
    return index < 0 ? 0 : Math.round((index / (this.flow.length - 1)) * 100);
  }

  /**
   * Replays the path a completed step took: placing the order went through REST and gRPC,
   * every later status came back through Kafka and the WebSocket. Nothing is logged — a
   * replay is not a new event.
   */
  replay(step: OrderStatus): void {
    this.replayTimers.forEach(clearTimeout);
    this.replayTimers = [];
    this.replaying.set(step);

    const kind: FlowKind = step === 'PLACED' ? 'place' : 'event';
    const card = this.flowCard()?.nativeElement;
    const offScreen = card ? !this.isMostlyVisible(card) : false;

    // On a phone the diagram sits above the steps; bring it into view first so the
    // animation is not played to an empty screen.
    if (card && offScreen) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    this.replayTimers.push(setTimeout(() => this.fire(kind), offScreen ? 450 : 0));
    this.replayTimers.push(setTimeout(() => this.replaying.set(null), 2200));
  }

  private isMostlyVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    return visible >= rect.height * 0.6;
  }

  private onEvent(event: OrderStatusEvent): void {
    const previous = this.order()?.status;
    this.order.update(current =>
      current ? { ...current, status: event.status, updatedAt: event.occurredAt } : current);
    this.lastEventAt.set(Date.now());

    const latency = Date.now() - Date.parse(event.occurredAt);
    const latencyText = latency >= 0 && latency < 10_000 ? ` · ${latency} ms end to end` : '';

    this.addLog('KAFKA', `order-events → ${event.status}, consumed by notification-service`);
    this.addLog('WS', `/topic/orders/${event.orderId} pushed to this tab${latencyText}`);
    this.fire('event');

    if (event.status === 'DELIVERED' && previous !== 'DELIVERED') {
      this.celebrate.set(true);
      setTimeout(() => this.celebrate.set(false), 2600);
    }
  }

  private fire(kind: FlowKind): void {
    this.flowTrigger.set({ kind, seq: this.flowSeq++ });
  }

  private addLog(tag: LogEntry['tag'], text: string): void {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.log.update(entries => [{ id: this.logId++, time, tag, text }, ...entries].slice(0, 10));
  }

  /** Server and browser clocks can disagree; never let that produce a silly countdown. */
  private sane(timestamp: number): number {
    const now = Date.now();
    return Number.isNaN(timestamp) || Math.abs(now - timestamp) > DEMO_STEP_MS * 4 ? now : timestamp;
  }
}
