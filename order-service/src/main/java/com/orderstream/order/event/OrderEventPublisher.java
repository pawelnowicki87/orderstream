package com.orderstream.order.event;

import com.orderstream.order.domain.CustomerOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class OrderEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(OrderEventPublisher.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String topic;

    public OrderEventPublisher(KafkaTemplate<String, Object> kafkaTemplate,
                               @Value("${orderstream.kafka.topic}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
    }

    public void publishStatus(CustomerOrder order) {
        OrderStatusEvent event = new OrderStatusEvent(
                order.getId(),
                order.getUserId(),
                order.getStatus().name(),
                order.getRestaurantName(),
                order.getTotalCents(),
                Instant.now());

        kafkaTemplate.send(topic, String.valueOf(order.getId()), event);
        log.info("Published {} for order {}", event.status(), event.orderId());
    }
}
