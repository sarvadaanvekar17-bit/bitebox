package com.bitebox.service;

import com.bitebox.dto.OrderDtos.*;
import com.bitebox.entity.*;
import com.bitebox.repository.MenuItemRepository;
import com.bitebox.repository.OrderRepository;
import com.bitebox.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class OrderService {

    private final OrderRepository orders;
    private final MenuItemRepository menuItems;
    private final UserRepository users;
    private final MenuService menuService;

    private final BigDecimal deliveryCharge;
    private final BigDecimal packagingCharge;

    public OrderService(OrderRepository orders, MenuItemRepository menuItems,
                        UserRepository users, MenuService menuService,
                        @Value("${bitebox.pricing.delivery-charge}") long delivery,
                        @Value("${bitebox.pricing.packaging-charge}") long packaging) {
        this.orders = orders;
        this.menuItems = menuItems;
        this.users = users;
        this.menuService = menuService;
        this.deliveryCharge = BigDecimal.valueOf(delivery);
        this.packagingCharge = BigDecimal.valueOf(packaging);
    }

    /* ---------- Pricing (mirrors js/pricing.js exactly) ---------- */
    private BigDecimal discountFor(BigDecimal subtotal) {
        if (subtotal.compareTo(new BigDecimal("1000")) > 0) return subtotal.multiply(new BigDecimal("0.25"));
        if (subtotal.compareTo(new BigDecimal("800")) >= 0) return subtotal.multiply(new BigDecimal("0.15"));
        if (subtotal.compareTo(new BigDecimal("699")) >= 0) return subtotal.multiply(new BigDecimal("0.10"));
        return BigDecimal.ZERO;
    }

    private BigDecimal couponDiscount(String code, BigDecimal subtotal, BigDecimal delivery) {
        if (code == null || code.isBlank()) return BigDecimal.ZERO;
        return switch (code.trim().toUpperCase()) {
            case "BITE10" -> subtotal.multiply(new BigDecimal("0.10")).min(new BigDecimal("100"));
            case "BITE20" -> subtotal.compareTo(new BigDecimal("699")) >= 0
                    ? subtotal.multiply(new BigDecimal("0.20")) : BigDecimal.ZERO;
            case "FREESHIP" -> delivery;
            default -> BigDecimal.ZERO;
        };
    }

    /* ---------- Create order (server-side pricing — never trusts client) ---------- */
    @Transactional
    public OrderResponse create(Long userId, OrderRequest req) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found."));
        if (req.items() == null || req.items().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order must contain at least one item.");
        }

        Order order = new Order();
        order.setOrderRef("BB-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setUser(user);
        order.setStatus(OrderStatus.PENDING);
        order.setCreatedAt(Instant.now());

        if (req.delivery() != null) {
            DeliveryRequest d = req.delivery();
            order.setHouse(d.house()); order.setStreet(d.street());
            order.setCity(d.city()); order.setState(d.state());
            order.setPin(d.pin()); order.setInstructions(d.instructions());
            order.setPaymentMethod(d.paymentMethod());
        }

        BigDecimal subtotal = BigDecimal.ZERO;
        for (OrderItemRequest ir : req.items()) {
            MenuItem item = menuItems.findById(ir.menuItemId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Menu item " + ir.menuItemId() + " not found."));
            if (!item.isAvailable()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "'" + item.getName() + "' is currently unavailable.");
            }
            OrderItem oi = new OrderItem();
            oi.setMenuItem(item);
            oi.setItemName(item.getName());
            oi.setQuantity(ir.quantity());
            oi.setUnitPrice(item.getPrice()); // snapshot from DB
            order.addItem(oi);
            subtotal = subtotal.add(item.getPrice().multiply(BigDecimal.valueOf(ir.quantity())));
        }

        BigDecimal delivery = deliveryCharge;
        BigDecimal packaging = packagingCharge;
        BigDecimal discount = discountFor(subtotal);
        BigDecimal coupon = couponDiscount(req.couponCode(), subtotal, delivery);
        BigDecimal total = subtotal.add(delivery).add(packaging).subtract(discount).subtract(coupon).max(BigDecimal.ZERO);

        order.setSubtotal(subtotal);
        order.setDeliveryCharge(delivery);
        order.setPackagingCharge(packaging);
        order.setDiscount(discount.add(coupon));
        order.setCouponCode(req.couponCode() != null && !req.couponCode().isBlank() ? req.couponCode().toUpperCase() : null);
        order.setTotal(total.setScale(2, RoundingMode.HALF_UP));

        return toResponse(orders.save(order));
    }

    /* ---------- Reads ---------- */
    @Transactional(readOnly = true)
    public List<OrderResponse> myOrders(Long userId) {
        return orders.findByUserIdOrderByCreatedAtDesc(userId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public OrderResponse get(Long userId, boolean isAdmin, String orderRef) {
        Order o = orders.findByOrderRef(orderRef)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found."));
        if (!isAdmin && (o.getUser() == null || !o.getUser().getId().equals(userId))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This order belongs to another customer.");
        }
        return toResponse(o);
    }

    public OrderResponse toResponse(Order o) {
        List<OrderItemResponse> items = o.getItems().stream().map(oi -> {
            MenuItem mi = oi.getMenuItem();
            return new OrderItemResponse(
                    oi.getId(),
                    oi.getItemName() != null ? oi.getItemName() : (mi != null ? mi.getName() : "Item"),
                    mi != null && mi.getCategory() != null ? mi.getCategory().getName() : null,
                    oi.getUnitPrice(), oi.getQuantity(),
                    mi != null ? mi.getImageUrl() : null);
        }).toList();

        User u = o.getUser();
        return new OrderResponse(
                o.getId(), o.getOrderRef(), o.getStatus().name(),
                u != null ? u.getName() : null,
                u != null ? u.getEmail() : null,
                u != null ? u.getPhone() : null,
                o.getHouse(), o.getStreet(), o.getCity(), o.getState(), o.getPin(), o.getInstructions(),
                o.getPaymentMethod(), items,
                o.getSubtotal(), o.getDeliveryCharge(), o.getPackagingCharge(),
                o.getDiscount(), o.getCouponCode(), o.getTotal(), o.getCreatedAt());
    }
}
