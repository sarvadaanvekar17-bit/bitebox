package com.bitebox.controller;

import com.bitebox.dto.OrderDtos.OrderRequest;
import com.bitebox.dto.OrderDtos.OrderResponse;
import com.bitebox.entity.User;
import com.bitebox.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orders;

    public OrderController(OrderService orders) {
        this.orders = orders;
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User u) {
            return u;
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
    }

    private boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse create(@Valid @RequestBody OrderRequest req) {
        return orders.create(currentUser().getId(), req);
    }

    @GetMapping
    public List<OrderResponse> mine() {
        return orders.myOrders(currentUser().getId());
    }

    @GetMapping("/{orderRef}")
    public OrderResponse get(@PathVariable String orderRef) {
        User u = currentUser();
        return orders.get(u.getId(), isAdmin(), orderRef);
    }
}
