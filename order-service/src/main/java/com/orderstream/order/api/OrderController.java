package com.orderstream.order.api;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderDtos.OrderView place(@RequestHeader("X-User-Id") Long userId,
                                     @Valid @RequestBody OrderDtos.PlaceOrderRequest request) {
        return orderService.placeOrder(userId, request);
    }

    @GetMapping
    public List<OrderDtos.OrderView> myOrders(@RequestHeader("X-User-Id") Long userId) {
        return orderService.findMyOrders(userId);
    }

    @GetMapping("/{id}")
    public OrderDtos.OrderView one(@RequestHeader("X-User-Id") Long userId,
                                   @PathVariable Long id) {
        return orderService.findOne(userId, id);
    }
}
