package com.orderstream.restaurant.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "restaurants")
public class Restaurant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String cuisine;

    @Column(nullable = false)
    private String imageUrl;

    protected Restaurant() {
    }

    public Restaurant(String name, String cuisine, String imageUrl) {
        this.name = name;
        this.cuisine = cuisine;
        this.imageUrl = imageUrl;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getCuisine() {
        return cuisine;
    }

    public String getImageUrl() {
        return imageUrl;
    }
}
