package com.bitebox.repository;

import com.bitebox.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<Order> findByOrderRef(String orderRef);
    List<Order> findAllByOrderByCreatedAtDesc();
}
