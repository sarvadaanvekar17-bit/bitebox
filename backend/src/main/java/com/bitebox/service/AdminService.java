package com.bitebox.service;

import com.bitebox.dto.AdminDtos.AnalyticsResponse;
import com.bitebox.dto.AdminDtos.CustomerSummary;
import com.bitebox.dto.AdminDtos.TopItem;
import com.bitebox.dto.OrderDtos.AdminStatsResponse;
import com.bitebox.dto.OrderDtos.OrderResponse;
import com.bitebox.dto.OrderDtos.StatusUpdateRequest;
import com.bitebox.entity.Order;
import com.bitebox.entity.OrderItem;
import com.bitebox.entity.OrderStatus;
import com.bitebox.entity.User;
import com.bitebox.repository.MenuItemRepository;
import com.bitebox.repository.OrderRepository;
import com.bitebox.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AdminService {

    private final OrderRepository orders;
    private final MenuItemRepository menuItems;
    private final UserRepository users;
    private final OrderService orderService;

    public AdminService(OrderRepository orders, MenuItemRepository menuItems,
                        UserRepository users, OrderService orderService) {
        this.orders = orders;
        this.menuItems = menuItems;
        this.users = users;
        this.orderService = orderService;
    }

    public AdminStatsResponse stats() {
        List<Order> all = orders.findAllByOrderByCreatedAtDesc();
        BigDecimal revenue = all.stream()
                .filter(o -> o.getStatus() != OrderStatus.CANCELLED)
                .map(o -> o.getTotal() != null ? o.getTotal() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long pending = all.stream()
                .filter(o -> o.getStatus() == OrderStatus.PENDING).count();
        return new AdminStatsResponse(
                all.size(), revenue, pending, menuItems.count(), users.count());
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> allOrders() {
        return orders.findAllByOrderByCreatedAtDesc().stream()
                .map(orderService::toResponse).toList();
    }

    @Transactional
    public OrderResponse updateStatus(String orderRef, StatusUpdateRequest req) {
        Order o = orders.findByOrderRef(orderRef)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found."));
        OrderStatus status;
        try {
            status = OrderStatus.valueOf(req.status().trim().toUpperCase().replace(" ", "_"));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: " + req.status());
        }
        o.setStatus(status);
        return orderService.toResponse(orders.save(o));
    }

    /* ---------- Customers ---------- */
    @Transactional(readOnly = true)
    public List<CustomerSummary> customers() {
        List<Order> all = orders.findAllByOrderByCreatedAtDesc();
        Map<Long, List<Order>> byUser = all.stream()
                .filter(o -> o.getUser() != null)
                .collect(Collectors.groupingBy(o -> o.getUser().getId()));
        return users.findAll().stream()
                .map(u -> {
                    List<Order> uo = byUser.getOrDefault(u.getId(), List.of());
                    BigDecimal spent = uo.stream()
                            .filter(o -> o.getStatus() != OrderStatus.CANCELLED)
                            .map(o -> o.getTotal() != null ? o.getTotal() : BigDecimal.ZERO)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    return new CustomerSummary(u.getId(), u.getName(), u.getEmail(),
                            u.getPhone(), uo.size(), spent);
                })
                .sorted(Comparator.comparing(CustomerSummary::orderCount).reversed())
                .toList();
    }

    /* ---------- Analytics (computed from real order data only) ---------- */
    @Transactional(readOnly = true)
    public AnalyticsResponse analytics() {
        List<Order> all = orders.findAllByOrderByCreatedAtDesc();

        BigDecimal revenue = all.stream()
                .filter(o -> o.getStatus() != OrderStatus.CANCELLED)
                .map(o -> o.getTotal() != null ? o.getTotal() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Long> byStatus = all.stream()
                .collect(Collectors.groupingBy(o -> o.getStatus().name(),
                        Collectors.counting()));

        // Aggregate order line items by name snapshot
        Map<String, long[]> qty = new java.util.HashMap<>();
        Map<String, BigDecimal> rev = new java.util.HashMap<>();
        for (Order o : all) {
            if (o.getStatus() == OrderStatus.CANCELLED) continue;
            for (OrderItem oi : o.getItems()) {
                String name = oi.getItemName() != null ? oi.getItemName() : "Item";
                qty.computeIfAbsent(name, k -> new long[1])[0] += oi.getQuantity();
                rev.merge(name, oi.getUnitPrice().multiply(BigDecimal.valueOf(oi.getQuantity())), BigDecimal::add);
            }
        }
        List<TopItem> topItems = rev.entrySet().stream()
                .map(e -> new TopItem(e.getKey(), qty.get(e.getKey())[0], e.getValue()))
                .sorted(Comparator.comparing(TopItem::revenue).reversed())
                .limit(5)
                .toList();

        long cancelled = byStatus.getOrDefault("CANCELLED", 0L);
        return new AnalyticsResponse(revenue, byStatus, topItems, cancelled);
    }
}
