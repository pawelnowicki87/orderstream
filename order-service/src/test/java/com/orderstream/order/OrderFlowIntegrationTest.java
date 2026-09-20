package com.orderstream.order;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orderstream.order.domain.CustomerOrderRepository;
import com.orderstream.order.domain.OrderStatus;
import com.orderstream.order.grpc.RestaurantClient;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.KafkaContainer;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class OrderFlowIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Container
    static KafkaContainer kafka = new KafkaContainer(DockerImageName.parse("apache/kafka:3.8.1"));

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.kafka.bootstrap-servers", kafka::getBootstrapServers);
        // Keep the scheduler out of the way so the test controls the order's status.
        registry.add("orderstream.demo.advance-interval-ms", () -> "3600000");
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CustomerOrderRepository orders;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private RestaurantClient restaurantClient;

    @Test
    void placingAnOrderPersistsItAndPublishesAnEvent() throws Exception {
        Mockito.when(restaurantClient.validateOrder(Mockito.eq(1L), Mockito.anyList()))
                .thenReturn(new RestaurantClient.ValidationResult(true, "ok", 10200L, "Pizza Napoli"));

        String payload = objectMapper.writeValueAsString(Map.of(
                "restaurantId", 1L,
                "items", List.of(Map.of("menuItemId", 1L, "quantity", 2))));

        mockMvc.perform(post("/api/orders")
                        .header("X-User-Id", "77")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PLACED"))
                .andExpect(jsonPath("$.totalCents").value(10200))
                .andExpect(jsonPath("$.restaurantName").value("Pizza Napoli"));

        var saved = orders.findByUserIdOrderByCreatedAtDesc(77L);
        assertEquals(1, saved.size());
        assertEquals(OrderStatus.PLACED, saved.get(0).getStatus());
        assertEquals(10200L, saved.get(0).getTotalCents());

        assertTrue(consumedEventBodies().stream().anyMatch(body -> body.contains("\"status\":\"PLACED\"")),
                "expected a PLACED event on the order-events topic");
    }

    @Test
    void rejectsOrderWhenRestaurantServiceSaysItIsInvalid() throws Exception {
        Mockito.when(restaurantClient.validateOrder(Mockito.eq(1L), Mockito.anyList()))
                .thenReturn(new RestaurantClient.ValidationResult(
                        false, "menu item 'Truffle Special' is not available right now", 0L, "Pizza Napoli"));

        String payload = objectMapper.writeValueAsString(Map.of(
                "restaurantId", 1L,
                "items", List.of(Map.of("menuItemId", 4L, "quantity", 1))));

        mockMvc.perform(post("/api/orders")
                        .header("X-User-Id", "78")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());

        assertTrue(orders.findByUserIdOrderByCreatedAtDesc(78L).isEmpty(),
                "a rejected order must not be persisted");
    }

    private List<String> consumedEventBodies() {
        Properties props = new Properties();
        props.put("bootstrap.servers", kafka.getBootstrapServers());
        props.put("group.id", "integration-test-" + System.nanoTime());
        props.put("auto.offset.reset", "earliest");
        props.put("key.deserializer", StringDeserializer.class.getName());
        props.put("value.deserializer", StringDeserializer.class.getName());

        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props)) {
            consumer.subscribe(List.of("order-events"));
            ConsumerRecords<String, String> records = consumer.poll(Duration.ofSeconds(10));

            return java.util.stream.StreamSupport.stream(records.spliterator(), false)
                    .map(ConsumerRecord::value)
                    .toList();
        }
    }
}
