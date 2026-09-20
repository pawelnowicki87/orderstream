package com.orderstream.restaurant.api;

import com.orderstream.restaurant.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants")
public class RestaurantController {

    private final RestaurantRepository restaurants;
    private final MenuItemRepository menuItems;

    public RestaurantController(RestaurantRepository restaurants, MenuItemRepository menuItems) {
        this.restaurants = restaurants;
        this.menuItems = menuItems;
    }

    @GetMapping
    public List<RestaurantDtos.RestaurantSummary> listAll() {
        return restaurants.findAll().stream()
                .map(r -> new RestaurantDtos.RestaurantSummary(
                        r.getId(), r.getName(), r.getCuisine(), r.getImageUrl()))
                .toList();
    }

    @GetMapping("/{id}")
    public RestaurantDtos.RestaurantDetail getOne(@PathVariable Long id) {
        Restaurant restaurant = restaurants.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "restaurant not found"));

        List<RestaurantDtos.MenuItemView> menu = menuItems.findByRestaurantId(id).stream()
                .map(m -> new RestaurantDtos.MenuItemView(
                        m.getId(), m.getName(), m.getDescription(), m.getPriceCents(), m.isAvailable()))
                .toList();

        return new RestaurantDtos.RestaurantDetail(
                restaurant.getId(), restaurant.getName(), restaurant.getCuisine(),
                restaurant.getImageUrl(), menu);
    }
}
