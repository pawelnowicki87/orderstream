package com.orderstream.order.api;

import com.orderstream.order.domain.*;
import com.orderstream.order.event.OrderEventPublisher;
import com.orderstream.order.grpc.RestaurantClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class OrderService {

    private final CustomerOrderRepository orders;
    private final RestaurantClient restaurantClient;
    private final OrderEventPublisher eventPublisher;

    public OrderService(CustomerOrderRepository orders,
                        RestaurantClient restaurantClient,
                        OrderEventPublisher eventPublisher) {
        this.orders = orders;
        this.restaurantClient = restaurantClient;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public OrderDtos.OrderView placeOrder(Long userId, OrderDtos.PlaceOrderRequest request) {
        List<RestaurantClient.RequestedItem> requestedItems = request.items().stream()
                .map(i -> new RestaurantClient.RequestedItem(i.menuItemId(), i.quantity()))
                .toList();

        RestaurantClient.ValidationResult validation;
        try {
            validation = restaurantClient.validateOrder(request.restaurantId(), requestedItems);
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "restaurant service unavailable: " + e.getMessage());
        }

        if (!validation.valid()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, validation.message());
        }

        List<OrderLine> lines = request.items().stream()
                .map(i -> new OrderLine(i.menuItemId(), i.quantity()))
                .toList();

        CustomerOrder saved = orders.save(new CustomerOrder(
                userId,
                request.restaurantId(),
                validation.restaurantName(),
                validation.totalCents(),
                lines));

        eventPublisher.publishStatus(saved);
        return toView(saved);
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.OrderView> findMyOrders(Long userId) {
        return orders.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toView)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderDtos.OrderView findOne(Long userId, Long orderId) {
        CustomerOrder order = orders.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "order not found"));

        if (!order.getUserId().equals(userId)) {
            // Deliberately 404 rather than 403: a user must not be able to discover
            // that an order exists just because it is not theirs.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "order not found");
        }
        return toView(order);
    }

    OrderDtos.OrderView toView(CustomerOrder order) {
        return new OrderDtos.OrderView(
                order.getId(),
                order.getRestaurantId(),
                order.getRestaurantName(),
                order.getTotalCents(),
                order.getStatus().name(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                order.getLines().stream()
                        .map(l -> new OrderDtos.OrderLineView(l.getMenuItemId(), l.getQuantity()))
                        .toList());
    }
}
