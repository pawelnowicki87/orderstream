package com.orderstream.restaurant.grpc;

import com.orderstream.restaurant.domain.MenuItem;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class OrderValidatorTest {

    private final OrderValidator validator = new OrderValidator();

    private MenuItem item(Long id, Long priceCents, boolean available) {
        MenuItem menuItem = new MenuItem(1L, "Test item", "desc", priceCents, available);
        try {
            var field = MenuItem.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(menuItem, id);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
        return menuItem;
    }

    @Test
    void sumsPriceTimesQuantityForAvailableItems() {
        Map<Long, MenuItem> menu = Map.of(
                10L, item(10L, 3200L, true),
                11L, item(11L, 1200L, true));

        OrderValidator.Result result = validator.validate(
                menu, List.of(new OrderValidator.RequestedItem(10L, 2), new OrderValidator.RequestedItem(11L, 1)));

        assertTrue(result.valid());
        assertEquals(7600L, result.totalCents());
    }

    @Test
    void rejectsUnknownMenuItem() {
        Map<Long, MenuItem> menu = Map.of(10L, item(10L, 3200L, true));

        OrderValidator.Result result = validator.validate(
                menu, List.of(new OrderValidator.RequestedItem(99L, 1)));

        assertFalse(result.valid());
        assertTrue(result.message().contains("99"));
    }

    @Test
    void rejectsUnavailableMenuItem() {
        Map<Long, MenuItem> menu = Map.of(10L, item(10L, 6500L, false));

        OrderValidator.Result result = validator.validate(
                menu, List.of(new OrderValidator.RequestedItem(10L, 1)));

        assertFalse(result.valid());
        assertTrue(result.message().toLowerCase().contains("available"));
    }

    @Test
    void rejectsEmptyOrder() {
        OrderValidator.Result result = validator.validate(Map.of(), List.of());

        assertFalse(result.valid());
        assertEquals(0L, result.totalCents());
    }

    @Test
    void rejectsNonPositiveQuantity() {
        Map<Long, MenuItem> menu = Map.of(10L, item(10L, 3200L, true));

        OrderValidator.Result result = validator.validate(
                menu, List.of(new OrderValidator.RequestedItem(10L, 0)));

        assertFalse(result.valid());
    }
}
