import { Injectable, OnDestroy } from '@angular/core';
import { Client } from '@stomp/stompjs';
import { Observable, Subject } from 'rxjs';
import { WS_URL } from './api.config';
import { OrderStatusEvent } from './models';

@Injectable({ providedIn: 'root' })
export class LiveOrderService implements OnDestroy {

  private client?: Client;
  private readonly events = new Subject<OrderStatusEvent>();

  watchOrder(orderId: number): Observable<OrderStatusEvent> {
    this.disconnect();

    this.client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 3000,
      onConnect: () => {
        this.client?.subscribe(`/topic/orders/${orderId}`, message => {
          this.events.next(JSON.parse(message.body) as OrderStatusEvent);
        });
      }
    });

    this.client.activate();
    return this.events.asObservable();
  }

  disconnect(): void {
    if (this.client?.active) {
      this.client.deactivate();
    }
    this.client = undefined;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
