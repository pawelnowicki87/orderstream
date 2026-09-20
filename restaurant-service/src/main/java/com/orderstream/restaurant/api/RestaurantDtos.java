package com.orderstream.restaurant.api;

import java.util.List;

public class RestaurantDtos {

    public record RestaurantSummary(Long id, String name, String cuisine, String imageUrl) {
    }

    public record MenuItemView(Long id, String name, String description, Long priceCents, boolean available) {
    }

    public record RestaurantDetail(
            Long id,
            String name,
            String cuisine,
            String imageUrl,
            List<MenuItemView> menu) {
    }
}
