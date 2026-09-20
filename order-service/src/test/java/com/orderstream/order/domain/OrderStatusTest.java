package com.orderstream.order.domain;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class OrderStatusTest {

    @Test
    void advancesThroughTheHappyPathInOrder() {
        assertEquals(Optional.of(OrderStatus.CONFIRMED), OrderStatus.PLACED.next());
        assertEquals(Optional.of(OrderStatus.PREPARING), OrderStatus.CONFIRMED.next());
        assertEquals(Optional.of(OrderStatus.OUT_FOR_DELIVERY), OrderStatus.PREPARING.next());
        assertEquals(Optional.of(OrderStatus.DELIVERED), OrderStatus.OUT_FOR_DELIVERY.next());
    }

    @Test
    void deliveredIsTerminal() {
        assertEquals(Optional.empty(), OrderStatus.DELIVERED.next());
        assertTrue(OrderStatus.DELIVERED.isTerminal());
    }

    @Test
    void cancelledIsTerminal() {
        assertEquals(Optional.empty(), OrderStatus.CANCELLED.next());
        assertTrue(OrderStatus.CANCELLED.isTerminal());
    }

    @Test
    void activeStatusesAreNotTerminal() {
        assertFalse(OrderStatus.PLACED.isTerminal());
        assertFalse(OrderStatus.CONFIRMED.isTerminal());
        assertFalse(OrderStatus.PREPARING.isTerminal());
        assertFalse(OrderStatus.OUT_FOR_DELIVERY.isTerminal());
    }
}
