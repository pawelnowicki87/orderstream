import { Component, OnDestroy, effect, input, signal } from '@angular/core';

export type FlowKind = 'place' | 'event';

export interface FlowTrigger {
  kind: FlowKind;
  /** Changes on every trigger so the same kind can be replayed. */
  seq: number;
}

interface FlowNode { id: string; x: number; y: number; name: string; sub: string; }
interface FlowEdge { id: string; d: string; label: string; lx: number; ly: number; }

const NODE_W = 150;
const NODE_H = 54;

/**
 * A live map of the backend. Each time something happens to the order, the path it took
 * through the services lights up hop by hop — the part of the system a screenshot of a
 * food app normally hides.
 */
@Component({
  selector: 'app-system-flow',
  standalone: true,
  template: `
    <div class="flow-scroll">
      <svg class="flow" viewBox="0 0 760 250" role="img"
           aria-label="Diagram of the services an order passes through">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" class="flow-arrow"></path>
          </marker>
          <marker id="arrow-lit" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" class="flow-arrow lit"></path>
          </marker>
        </defs>

        @for (edge of edges; track edge.id) {
          <path [attr.d]="edge.d" class="flow-edge" [class.lit]="lit().has(edge.id)"
                [attr.marker-end]="lit().has(edge.id) ? 'url(#arrow-lit)' : 'url(#arrow)'"></path>
          <text [attr.x]="edge.lx" [attr.y]="edge.ly" class="flow-edge-label"
                [class.lit]="lit().has(edge.id)">{{ edge.label }}</text>
        }

        @for (node of nodes; track node.id) {
          <g class="flow-node" [class.lit]="lit().has(node.id)">
            <rect [attr.x]="node.x" [attr.y]="node.y" [attr.width]="nodeW" [attr.height]="nodeH" rx="10"></rect>
            <text [attr.x]="node.x + nodeW / 2" [attr.y]="node.y + 23" class="flow-node-name">{{ node.name }}</text>
            <text [attr.x]="node.x + nodeW / 2" [attr.y]="node.y + 40" class="flow-node-sub">{{ node.sub }}</text>
          </g>
        }
      </svg>
    </div>
  `
})
export class SystemFlowComponent implements OnDestroy {

  readonly trigger = input<FlowTrigger | null>(null);

  readonly nodeW = NODE_W;
  readonly nodeH = NODE_H;

  readonly nodes: FlowNode[] = [
    { id: 'browser', x: 10, y: 20, name: 'Your browser', sub: 'Angular' },
    { id: 'gateway', x: 200, y: 20, name: 'api-gateway', sub: 'JWT · routing' },
    { id: 'order', x: 390, y: 20, name: 'order-service', sub: 'state machine' },
    { id: 'restaurant', x: 590, y: 20, name: 'restaurant-service', sub: 'prices · menu' },
    { id: 'kafka', x: 390, y: 170, name: 'Kafka', sub: 'topic: order-events' },
    { id: 'notification', x: 200, y: 170, name: 'notification-service', sub: 'STOMP broker' }
  ];

  readonly edges: FlowEdge[] = [
    { id: 'browser-gateway', d: 'M160,47 L198,47', label: 'REST', lx: 179, ly: 40 },
    { id: 'gateway-order', d: 'M350,47 L388,47', label: 'REST', lx: 369, ly: 40 },
    { id: 'order-restaurant', d: 'M540,47 L588,47', label: 'gRPC', lx: 564, ly: 40 },
    { id: 'order-kafka', d: 'M465,74 L465,168', label: 'publish', lx: 497, ly: 125 },
    { id: 'kafka-notification', d: 'M390,197 L352,197', label: 'consume', lx: 371, ly: 240 },
    { id: 'notification-browser', d: 'M200,197 L85,197 L85,76', label: 'WebSocket', lx: 135, ly: 190 }
  ];

  /** Hop-by-hop paths, in the order the request actually travels. */
  private readonly paths: Record<FlowKind, string[]> = {
    place: ['browser', 'browser-gateway', 'gateway', 'gateway-order', 'order',
            'order-restaurant', 'restaurant', 'order-kafka', 'kafka',
            'kafka-notification', 'notification', 'notification-browser', 'browser'],
    event: ['order', 'order-kafka', 'kafka', 'kafka-notification', 'notification',
            'notification-browser', 'browser']
  };

  readonly lit = signal<Set<string>>(new Set());

  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    effect(() => {
      const trigger = this.trigger();
      if (trigger) {
        this.play(this.paths[trigger.kind]);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private play(path: string[]): void {
    this.clearTimers();
    this.lit.set(new Set());

    const stepMs = 260;
    path.forEach((id, index) => {
      this.timers.push(setTimeout(() => this.setLit(id, true), index * stepMs));
      this.timers.push(setTimeout(() => this.setLit(id, false), index * stepMs + 1400));
    });
  }

  private setLit(id: string, on: boolean): void {
    this.lit.update(current => {
      const next = new Set(current);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
