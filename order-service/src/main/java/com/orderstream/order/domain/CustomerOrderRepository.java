package com.orderstream.order.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, Long> {

    List<CustomerOrder> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<CustomerOrder> findByStatusNotIn(List<OrderStatus> statuses);
}
