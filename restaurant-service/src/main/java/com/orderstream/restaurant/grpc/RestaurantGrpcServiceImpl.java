package com.orderstream.restaurant.grpc;

import com.orderstream.grpc.*;
import com.orderstream.restaurant.domain.*;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@GrpcService
public class RestaurantGrpcServiceImpl extends RestaurantGrpcServiceGrpc.RestaurantGrpcServiceImplBase {

    private final RestaurantRepository restaurants;
    private final MenuItemRepository menuItems;
    private final OrderValidator validator;

    public RestaurantGrpcServiceImpl(RestaurantRepository restaurants,
                                     MenuItemRepository menuItems,
                                     OrderValidator validator) {
        this.restaurants = restaurants;
        this.menuItems = menuItems;
        this.validator = validator;
    }

    @Override
    public void validateOrder(ValidateOrderRequest request,
                              StreamObserver<ValidateOrderResponse> responseObserver) {

        Restaurant restaurant = restaurants.findById(request.getRestaurantId()).orElse(null);
        if (restaurant == null) {
            responseObserver.onNext(ValidateOrderResponse.newBuilder()
                    .setValid(false)
                    .setMessage("restaurant " + request.getRestaurantId() + " not found")
                    .setTotalCents(0L)
                    .setRestaurantName("")
                    .build());
            responseObserver.onCompleted();
            return;
        }

        Map<Long, MenuItem> menuById = menuItems.findByRestaurantId(restaurant.getId()).stream()
                .collect(Collectors.toMap(MenuItem::getId, Function.identity()));

        List<OrderValidator.RequestedItem> requested = request.getItemsList().stream()
                .map(i -> new OrderValidator.RequestedItem(i.getMenuItemId(), i.getQuantity()))
                .toList();

        OrderValidator.Result result = validator.validate(menuById, requested);

        responseObserver.onNext(ValidateOrderResponse.newBuilder()
                .setValid(result.valid())
                .setMessage(result.message())
                .setTotalCents(result.totalCents())
                .setRestaurantName(restaurant.getName())
                .build());
        responseObserver.onCompleted();
    }
}
