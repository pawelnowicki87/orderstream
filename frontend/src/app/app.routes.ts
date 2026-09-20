import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login.component';
import { RestaurantListComponent } from './pages/restaurant-list.component';
import { RestaurantDetailComponent } from './pages/restaurant-detail.component';
import { OrderTrackingComponent } from './pages/order-tracking.component';
import { MyOrdersComponent } from './pages/my-orders.component';

export const routes: Routes = [
  { path: '', redirectTo: 'restaurants', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'restaurants', component: RestaurantListComponent },
  { path: 'restaurants/:id', component: RestaurantDetailComponent },
  { path: 'orders', component: MyOrdersComponent },
  { path: 'orders/:id', component: OrderTrackingComponent },
  { path: '**', redirectTo: 'restaurants' }
];
