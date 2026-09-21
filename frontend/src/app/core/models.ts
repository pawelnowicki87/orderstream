export interface RestaurantSummary {
  id: number;
  name: string;
  cuisine: string;
  imageUrl: string;
}

export interface MenuItemView {
  id: number;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
}

export interface RestaurantDetail {
  id: number;
  name: string;
  cuisine: string;
  imageUrl: string;
  menu: MenuItemView[];
}

export interface AuthResponse {
  token: string;
  userId: number;
  email: string;
  fullName: string;
}

export interface OrderLineView {
  menuItemId: number;
  quantity: number;
}

export interface OrderView {
  id: number;
  restaurantId: number;
  restaurantName: string;
  totalCents: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  items: OrderLineView[];
}

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'PLACED',
  'CONFIRMED',
  'PREPARING',
  'OUT_FOR_DELIVERY',
  'DELIVERED'
];

export const STATUS_META: Record<OrderStatus, { label: string; icon: string; blurb: string }> = {
  PLACED: { label: 'Placed', icon: '🧾', blurb: 'order-service stored it and published the first event' },
  CONFIRMED: { label: 'Confirmed', icon: '✅', blurb: 'The restaurant accepted the order' },
  PREPARING: { label: 'Preparing', icon: '👨‍🍳', blurb: 'Your food is in the kitchen' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', icon: '🛵', blurb: 'A courier is on the way' },
  DELIVERED: { label: 'Delivered', icon: '🏠', blurb: 'Enjoy your meal' },
  CANCELLED: { label: 'Cancelled', icon: '✖️', blurb: 'This order was cancelled' }
};

/**
 * How often order-service's demo simulator advances an order
 * (orderstream.demo.advance-interval-ms). Only used for the "next update in" hint.
 */
export const DEMO_STEP_MS = 15000;

export interface OrderStatusEvent {
  orderId: number;
  userId: number;
  status: OrderStatus;
  restaurantName: string;
  totalCents: number;
  occurredAt: string;
}

export function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2) + ' zł';
}
