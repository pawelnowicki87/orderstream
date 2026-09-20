import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RestaurantService } from '../core/restaurant.service';
import { RestaurantSummary } from '../core/models';

@Component({
  selector: 'app-restaurant-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container">
      <h2>Restaurants</h2>

      @if (loading()) {
        <p class="muted">Loading...</p>
      } @else if (error()) {
        <p class="error">{{ error() }}</p>
      } @else {
        <div class="grid">
          @for (restaurant of restaurants(); track restaurant.id) {
            <a class="card" [routerLink]="['/restaurants', restaurant.id]" style="color: inherit;">
              <img [src]="restaurant.imageUrl" [alt]="restaurant.name"
                   style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px;">
              <h3 style="margin: 0.75rem 0 0.25rem;">{{ restaurant.name }}</h3>
              <p class="muted" style="margin: 0;">{{ restaurant.cuisine }}</p>
            </a>
          }
        </div>
      }
    </div>
  `
})
export class RestaurantListComponent implements OnInit {

  readonly restaurants = signal<RestaurantSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor(private restaurantService: RestaurantService) {}

  ngOnInit(): void {
    this.restaurantService.listAll().subscribe({
      next: (data) => {
        this.restaurants.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load restaurants. Is the backend running?');
        this.loading.set(false);
      }
    });
  }
}
