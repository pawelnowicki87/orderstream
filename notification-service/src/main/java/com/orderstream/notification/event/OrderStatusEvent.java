package com.orderstream.notification.event;

import java.time.Instant;

public record OrderStatusEvent(
        Long orderId,
        Long userId,
        String status,
        String restaurantName,
        Long totalCents,
        Instant occurredAt) {
}
