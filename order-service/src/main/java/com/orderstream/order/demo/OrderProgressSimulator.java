package com.orderstream.order.demo;

import com.orderstream.order.domain.*;
import com.orderstream.order.event.OrderEventPublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
public class OrderProgressSimulator {

    private static final Logger log = LoggerFactory.getLogger(OrderProgressSimulator.class);

    private final CustomerOrderRepository orders;
    private final OrderEventPublisher eventPublisher;

    public OrderProgressSimulator(CustomerOrderRepository orders, OrderEventPublisher eventPublisher) {
        this.orders = orders;
        this.eventPublisher = eventPublisher;
    }

    @Scheduled(fixedDelayString = "${orderstream.demo.advance-interval-ms}")
    @Transactional
    public void advanceActiveOrders() {
        List<CustomerOrder> active = orders.findByStatusNotIn(
                List.of(OrderStatus.DELIVERED, OrderStatus.CANCELLED));

        for (CustomerOrder order : active) {
            order.getStatus().next().ifPresent(next -> {
                order.changeStatus(next);
                orders.save(order);
                eventPublisher.publishStatus(order);
                log.info("Order {} advanced to {}", order.getId(), next);
            });
        }
    }
}
