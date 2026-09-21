import { Injectable, signal } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { Observable } from 'rxjs';
import { WS_URL } from './api.config';

interface Watcher {
  destination: string;
  onMessage: (message: IMessage) => void;
  subscription?: StompSubscription;
}

/**
 * One STOMP connection for the whole app. Components ask for a destination and get an
 * Observable; the service keeps the subscriptions alive across reconnects, so a tab left
 * open while the backend restarts picks up where it left off.
 */
@Injectable({ providedIn: 'root' })
export class StompService {

  readonly connected = signal(false);

  private readonly watchers = new Set<Watcher>();

  private readonly client = new Client({
    brokerURL: WS_URL,
    reconnectDelay: 3000,
    onConnect: () => {
      this.connected.set(true);
      // Subscriptions do not survive a dropped socket, so re-attach every watcher.
      this.watchers.forEach(watcher => this.attach(watcher));
    },
    onWebSocketClose: () => this.connected.set(false),
    onStompError: () => this.connected.set(false)
  });

  watch<T>(destination: string): Observable<T> {
    return new Observable<T>(subscriber => {
      const watcher: Watcher = {
        destination,
        onMessage: message => subscriber.next(JSON.parse(message.body) as T)
      };
      this.watchers.add(watcher);

      if (this.client.connected) {
        this.attach(watcher);
      }
      if (!this.client.active) {
        this.client.activate();
      }

      return () => {
        this.watchers.delete(watcher);
        if (this.client.connected) {
          watcher.subscription?.unsubscribe();
        }
      };
    });
  }

  private attach(watcher: Watcher): void {
    watcher.subscription = this.client.subscribe(watcher.destination, watcher.onMessage);
  }
}
