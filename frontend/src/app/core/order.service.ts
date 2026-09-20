import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { OrderView } from './models';

export interface PlaceOrderPayload {
  restaurantId: number;
  items: { menuItemId: number; quantity: number }[];
}

@Injectable({ providedIn: 'root' })
export class OrderService {

  constructor(private http: HttpClient) {}

  place(payload: PlaceOrderPayload): Observable<OrderView> {
    return this.http.post<OrderView>(`${API_BASE_URL}/api/orders`, payload);
  }

  myOrders(): Observable<OrderView[]> {
    return this.http.get<OrderView[]>(`${API_BASE_URL}/api/orders`);
  }

  getOne(id: number): Observable<OrderView> {
    return this.http.get<OrderView>(`${API_BASE_URL}/api/orders/${id}`);
  }
}
