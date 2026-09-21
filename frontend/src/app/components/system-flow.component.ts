import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal } from '@angular/core';

export type FlowKind = 'place' | 'event';

export interface FlowTrigger {
  kind: FlowKind;
  /** Changes on every trigger so the same kind can be replayed. */
  seq: number;
}

type NodeId = 'browser' | 'gateway' | 'order' | 'restaurant' | 'kafka' | 'notification';

interface FlowEdge {
  id: string;
  d: string;
  label: string;
  lx: number;
  ly: number;
  /** Degrees; used for labels that sit on vertical side routes in the narrow layout. */
  rotate?: number;
}

interface FlowLayout {
  viewBox: string;
  nodeW: number;
  nodeH: number;
  nameSize: number;
  subSize: number;
  labelSize: number;
  positions: Record<NodeId, { x: number; y: number }>;
  edges: FlowEdge[];
}

const NODE_TEXT: Record<NodeId, { name: string; sub: string }> = {
  browser: { name: 'Your browser', sub: 'Angular' },
  gateway: { name: 'api-gateway', sub: 'JWT · routing' },
  order: { name: 'order-service', sub: 'state machine' },
  restaurant: { name: 'restaurant-service', sub: 'prices · menu' },
  kafka: { name: 'Kafka', sub: 'topic: order-events' },
  notification: { name: 'notification-service', sub: 'STOMP broker' }
};

/**
 * Wide screens: the request path runs left to right, events loop back underneath.
 * Node text is sized in viewBox units, so on a full-width card it renders around 17px.
 */
const WIDE: FlowLayout = {
  viewBox: '0 0 970 272',
  nodeW: 200,
  nodeH: 66,
  nameSize: 16,
  subSize: 12.5,
  labelSize: 13,
  positions: {
    browser: { x: 10, y: 20 },
    gateway: { x: 260, y: 20 },
    order: { x: 510, y: 20 },
    restaurant: { x: 760, y: 20 },
    notification: { x: 240, y: 190 },
    kafka: { x: 510, y: 190 }
  },
  edges: [
    { id: 'browser-gateway', d: 'M210,53 L256,53', label: 'REST', lx: 234, ly: 42 },
    { id: 'gateway-order', d: 'M460,53 L506,53', label: 'REST', lx: 484, ly: 42 },
    { id: 'order-restaurant', d: 'M710,53 L756,53', label: 'gRPC', lx: 734, ly: 42 },
    { id: 'order-kafka', d: 'M610,86 L610,186', label: 'publish', lx: 652, ly: 141 },
    { id: 'kafka-notification', d: 'M510,223 L444,223', label: 'consume', lx: 476, ly: 212 },
    { id: 'notification-browser', d: 'M240,223 L110,223 L110,90', label: 'WebSocket', lx: 176, ly: 212 }
  ]
};

/**
 * Narrow screens: one column you read top to bottom. Kafka's publish route bypasses
 * restaurant-service on the left, the WebSocket push climbs back up on the right.
 */
const NARROW: FlowLayout = {
  viewBox: '0 0 360 548',
  nodeW: 260,
  nodeH: 58,
  nameSize: 18,
  subSize: 13,
  labelSize: 14,
  positions: {
    browser: { x: 50, y: 8 },
    gateway: { x: 50, y: 100 },
    order: { x: 50, y: 192 },
    restaurant: { x: 50, y: 284 },
    kafka: { x: 50, y: 388 },
    notification: { x: 50, y: 480 }
  },
  edges: [
    { id: 'browser-gateway', d: 'M180,66 L180,96', label: 'REST', lx: 210, ly: 86 },
    { id: 'gateway-order', d: 'M180,158 L180,188', label: 'REST', lx: 210, ly: 178 },
    { id: 'order-restaurant', d: 'M180,250 L180,280', label: 'gRPC', lx: 210, ly: 270 },
    { id: 'order-kafka', d: 'M50,221 L22,221 L22,417 L46,417', label: 'publish', lx: 14, ly: 320, rotate: -90 },
    { id: 'kafka-notification', d: 'M180,446 L180,476', label: 'consume', lx: 218, ly: 466 },
    { id: 'notification-browser', d: 'M310,509 L340,509 L340,37 L314,37', label: 'WebSocket', lx: 350, ly: 273, rotate: 90 }
  ]
};

/** Below this card width the horizontal diagram would shrink its text past readable. */
const NARROW_BELOW_PX = 720;

/** Page and card padding around the diagram — the gap between the window and the card's width. */
const CARD_CHROME_PX = 80;

/**
 * A live map of the backend. Each time something happens to the order, the path it took
 * through the services lights up hop by hop — the part of the system a screenshot of a
 * food app normally hides.
 */
@Component({
  selector: 'app-system-flow',
  standalone: true,
  template: `
    <svg class="flow" [class.narrow]="narrow()" [attr.viewBox]="layout().viewBox" role="img"
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

      @for (edge of layout().edges; track edge.id) {
        <path [attr.d]="edge.d" class="flow-edge" [class.lit]="lit().has(edge.id)"
              [attr.marker-end]="lit().has(edge.id) ? 'url(#arrow-lit)' : 'url(#arrow)'"></path>
        <text [attr.x]="edge.lx" [attr.y]="edge.ly" class="flow-edge-label"
              [attr.font-size]="layout().labelSize"
              [attr.transform]="edge.rotate ? 'rotate(' + edge.rotate + ' ' + edge.lx + ' ' + edge.ly + ')' : null"
              [class.lit]="lit().has(edge.id)">{{ edge.label }}</text>
      }

      @for (node of nodes(); track node.id) {
        <g class="flow-node" [class.lit]="lit().has(node.id)">
          <rect [attr.x]="node.x" [attr.y]="node.y" [attr.width]="layout().nodeW"
                [attr.height]="layout().nodeH" rx="12"></rect>
          <text [attr.x]="node.x + layout().nodeW / 2" [attr.y]="node.y + layout().nodeH * 0.45"
                class="flow-node-name" [attr.font-size]="layout().nameSize">{{ node.name }}</text>
          <text [attr.x]="node.x + layout().nodeW / 2" [attr.y]="node.y + layout().nodeH * 0.76"
                class="flow-node-sub" [attr.font-size]="layout().subSize">{{ node.sub }}</text>
        </g>
      }
    </svg>
  `
})
export class SystemFlowComponent {

  readonly trigger = input<FlowTrigger | null>(null);

  /**
   * First guess from the window, so a phone renders the vertical layout straight away instead
   * of flashing the wide one; the ResizeObserver below then corrects it from the card's real width.
   */
  readonly narrow = signal(typeof window !== 'undefined' && window.innerWidth < NARROW_BELOW_PX + CARD_CHROME_PX);
  readonly layout = computed(() => (this.narrow() ? NARROW : WIDE));

  readonly nodes = computed(() => {
    const { positions } = this.layout();
    return (Object.keys(NODE_TEXT) as NodeId[]).map(id => ({ id, ...positions[id], ...NODE_TEXT[id] }));
  });

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
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);

    // Pick the layout from the space the card actually has, not the window width —
    // the same diagram can sit in a wide or a narrow column.
    afterNextRender(() => {
      const observer = new ResizeObserver(entries => {
        const width = entries[0]?.contentRect.width ?? host.clientWidth;
        this.narrow.set(width < NARROW_BELOW_PX);
      });
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });

    destroyRef.onDestroy(() => this.clearTimers());

    effect(() => {
      const trigger = this.trigger();
      if (trigger) {
        this.play(this.paths[trigger.kind]);
      }
    });
  }

  private play(path: string[]): void {
    this.clearTimers();
    this.lit.set(new Set());

    const stepMs = 280;
    path.forEach((id, index) => {
      this.timers.push(setTimeout(() => this.setLit(id, true), index * stepMs));
      this.timers.push(setTimeout(() => this.setLit(id, false), index * stepMs + 1500));
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
