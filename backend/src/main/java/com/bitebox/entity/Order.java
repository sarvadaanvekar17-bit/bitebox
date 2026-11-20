package com.bitebox.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
@Getter
@Setter
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_ref", nullable = false, unique = true, length = 20)
    private String orderRef;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.PENDING;

    /* Delivery address snapshot */
    private String house;
    private String street;
    private String city;
    private String state;
    private String pin;
    private String instructions;
    private String paymentMethod;

    /* Price snapshot — computed server-side */
    @Column(precision = 10, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "delivery_charge", precision = 10, scale = 2)
    private BigDecimal deliveryCharge;

    @Column(name = "packaging_charge", precision = 10, scale = 2)
    private BigDecimal packagingCharge;

    @Column(precision = 10, scale = 2)
    private BigDecimal discount;

    @Column(name = "coupon_code", length = 30)
    private String couponCode;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal total;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    public void addItem(OrderItem item) {
        item.setOrder(this);
        this.items.add(item);
    }
}
