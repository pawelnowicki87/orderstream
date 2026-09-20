package com.orderstream.gateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RouteConfig {

    @Value("${orderstream.services.auth}")
    private String authUri;

    @Value("${orderstream.services.restaurant}")
    private String restaurantUri;

    @Value("${orderstream.services.order}")
    private String orderUri;

    @Bean
    public RouteLocator routes(RouteLocatorBuilder builder) {
        return builder.routes()
                .route("auth-service", r -> r.path("/api/auth/**").uri(authUri))
                .route("restaurant-service", r -> r.path("/api/restaurants/**").uri(restaurantUri))
                .route("order-service", r -> r.path("/api/orders/**").uri(orderUri))
                .build();
    }
}
