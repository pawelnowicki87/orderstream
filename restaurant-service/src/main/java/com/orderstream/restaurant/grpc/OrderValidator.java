package com.orderstream.restaurant.grpc;

import com.orderstream.restaurant.domain.MenuItem;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class OrderValidator {

    public record RequestedItem(Long menuItemId, int quantity) {
    }

    public record Result(boolean valid, String message, long totalCents) {

        static Result ok(long totalCents) {
            return new Result(true, "ok", totalCents);
        }

        static Result rejected(String message) {
            return new Result(false, message, 0L);
        }
    }

    public Result validate(Map<Long, MenuItem> menuById, List<RequestedItem> requestedItems) {
        if (requestedItems.isEmpty()) {
            return Result.rejected("order contains no items");
        }

        long total = 0L;
        for (RequestedItem requested : requestedItems) {
            if (requested.quantity() <= 0) {
                return Result.rejected("quantity must be positive for menu item " + requested.menuItemId());
            }

            MenuItem menuItem = menuById.get(requested.menuItemId());
            if (menuItem == null) {
                return Result.rejected("menu item " + requested.menuItemId() + " does not belong to this restaurant");
            }
            if (!menuItem.isAvailable()) {
                return Result.rejected("menu item '" + menuItem.getName() + "' is not available right now");
            }

            total += menuItem.getPriceCents() * requested.quantity();
        }
        return Result.ok(total);
    }
}
