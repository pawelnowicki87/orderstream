package com.orderstream.order.domain;

import java.util.Optional;

public enum OrderStatus {

    PLACED,
    CONFIRMED,
    PREPARING,
    OUT_FOR_DELIVERY,
    DELIVERED,
    CANCELLED;

    public Optional<OrderStatus> next() {
        return switch (this) {
            case PLACED -> Optional.of(CONFIRMED);
            case CONFIRMED -> Optional.of(PREPARING);
            case PREPARING -> Optional.of(OUT_FOR_DELIVERY);
            case OUT_FOR_DELIVERY -> Optional.of(DELIVERED);
            case DELIVERED, CANCELLED -> Optional.empty();
        };
    }

    public boolean isTerminal() {
        return next().isEmpty();
    }
}
