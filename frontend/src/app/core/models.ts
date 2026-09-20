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

export interface OrderStatusEvent {
  orderId: number;
  userId: number;
  status: OrderStatus;
  restaurantName: string;
  totalCents: number;
  occurredAt: string;
}
