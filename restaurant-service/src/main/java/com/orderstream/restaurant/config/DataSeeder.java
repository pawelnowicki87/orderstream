package com.orderstream.restaurant.config;

import com.orderstream.restaurant.domain.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    private final RestaurantRepository restaurants;
    private final MenuItemRepository menuItems;

    public DataSeeder(RestaurantRepository restaurants, MenuItemRepository menuItems) {
        this.restaurants = restaurants;
        this.menuItems = menuItems;
    }

    @Override
    public void run(String... args) {
        if (restaurants.count() > 0) {
            return;
        }

        Restaurant pizza = restaurants.save(new Restaurant(
                "Pizza Napoli", "Italian",
                "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600"));
        Restaurant sushi = restaurants.save(new Restaurant(
                "Sushi Zen", "Japanese",
                "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600"));
        Restaurant burger = restaurants.save(new Restaurant(
                "Burger House", "American",
                "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600"));

        menuItems.saveAll(List.of(
                new MenuItem(pizza.getId(), "Margherita", "Tomato, mozzarella, basil", 3200L, true),
                new MenuItem(pizza.getId(), "Pepperoni", "Tomato, mozzarella, pepperoni", 3800L, true),
                new MenuItem(pizza.getId(), "Quattro Formaggi", "Four cheeses", 4100L, true),
                new MenuItem(pizza.getId(), "Truffle Special", "Seasonal, currently unavailable", 6500L, false),

                new MenuItem(sushi.getId(), "Salmon Nigiri (8 pcs)", "Fresh salmon over rice", 5200L, true),
                new MenuItem(sushi.getId(), "California Roll", "Crab, avocado, cucumber", 3900L, true),
                new MenuItem(sushi.getId(), "Miso Soup", "Tofu, seaweed, spring onion", 1200L, true),

                new MenuItem(burger.getId(), "Classic Cheeseburger", "Beef, cheddar, pickles", 3400L, true),
                new MenuItem(burger.getId(), "Bacon Deluxe", "Beef, bacon, BBQ sauce", 4200L, true),
                new MenuItem(burger.getId(), "Sweet Potato Fries", "With aioli dip", 1800L, true)));
    }
}
