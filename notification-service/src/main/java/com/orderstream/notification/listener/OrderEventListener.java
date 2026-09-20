package com.orderstream.notification.listener;

import com.orderstream.notification.event.OrderStatusEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class OrderEventListener {

    private static final Logger log = LoggerFactory.getLogger(OrderEventListener.class);

    private final SimpMessagingTemplate messagingTemplate;

    public OrderEventListener(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @KafkaListener(topics = "${orderstream.kafka.topic}", groupId = "notification-service")
    public void onOrderStatus(OrderStatusEvent event) {
        log.info("Received {} for order {}", event.status(), event.orderId());

        messagingTemplate.convertAndSend("/topic/orders/" + event.orderId(), event);
        messagingTemplate.convertAndSend("/topic/users/" + event.userId(), event);
    }
}
