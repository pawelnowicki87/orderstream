package com.orderstream.order.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.Instant;
import java.util.List;

public class OrderDtos {

    public record OrderLineRequest(
            @NotNull Long menuItemId,
            @Positive int quantity) {
    }

    public record PlaceOrderRequest(
            @NotNull Long restaurantId,
            @NotEmpty @Valid List<OrderLineRequest> items) {
    }

    public record OrderLineView(Long menuItemId, int quantity) {
    }

    public record OrderView(
            Long id,
            Long restaurantId,
            String restaurantName,
            Long totalCents,
            String status,
            Instant createdAt,
            Instant updatedAt,
            List<OrderLineView> items) {
    }
}
