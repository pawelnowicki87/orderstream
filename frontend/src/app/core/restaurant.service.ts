import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { RestaurantDetail, RestaurantSummary } from './models';

@Injectable({ providedIn: 'root' })
export class RestaurantService {

  constructor(private http: HttpClient) {}

  listAll(): Observable<RestaurantSummary[]> {
    return this.http.get<RestaurantSummary[]>(`${API_BASE_URL}/api/restaurants`);
  }

  getOne(id: number): Observable<RestaurantDetail> {
    return this.http.get<RestaurantDetail>(`${API_BASE_URL}/api/restaurants/${id}`);
  }
}
