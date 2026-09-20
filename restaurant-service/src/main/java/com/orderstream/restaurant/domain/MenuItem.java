package com.orderstream.restaurant.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "menu_items")
public class MenuItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long restaurantId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private Long priceCents;

    @Column(nullable = false)
    private boolean available = true;

    protected MenuItem() {
    }

    public MenuItem(Long restaurantId, String name, String description, Long priceCents, boolean available) {
        this.restaurantId = restaurantId;
        this.name = name;
        this.description = description;
        this.priceCents = priceCents;
        this.available = available;
    }

    public Long getId() {
        return id;
    }

    public Long getRestaurantId() {
        return restaurantId;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public Long getPriceCents() {
        return priceCents;
    }

    public boolean isAvailable() {
        return available;
    }
}
