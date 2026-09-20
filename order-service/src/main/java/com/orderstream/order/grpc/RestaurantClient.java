package com.orderstream.order.grpc;

import com.orderstream.grpc.*;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class RestaurantClient {

    public record RequestedItem(Long menuItemId, int quantity) {
    }

    public record ValidationResult(boolean valid, String message, long totalCents, String restaurantName) {
    }

    @GrpcClient("restaurant-service")
    private RestaurantGrpcServiceGrpc.RestaurantGrpcServiceBlockingStub stub;

    public ValidationResult validateOrder(Long restaurantId, List<RequestedItem> items) {
        ValidateOrderRequest.Builder request = ValidateOrderRequest.newBuilder()
                .setRestaurantId(restaurantId);

        for (RequestedItem item : items) {
            request.addItems(OrderItemRequest.newBuilder()
                    .setMenuItemId(item.menuItemId())
                    .setQuantity(item.quantity())
                    .build());
        }

        ValidateOrderResponse response = stub.validateOrder(request.build());

        return new ValidationResult(
                response.getValid(),
                response.getMessage(),
                response.getTotalCents(),
                response.getRestaurantName());
    }
}
