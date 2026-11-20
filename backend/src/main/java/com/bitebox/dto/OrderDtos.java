package com.bitebox.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class OrderDtos {
    private OrderDtos() {}

    public record OrderItemRequest(
        @NotNull Long menuItemId,
        @NotNull @Min(1) @Max(50) Integer quantity
    ) {}

    public record DeliveryRequest(
        @NotBlank @Size(max = 200) String house,
        @NotBlank @Size(max = 300) String street,
        @NotBlank @Size(max = 100) String city,
        @NotBlank @Size(max = 100) String state,
        @NotBlank @Pattern(regexp = "\\d{6}", message = "PIN must be 6 digits") String pin,
        @Size(max = 300) String instructions,
        @NotBlank String paymentMethod
    ) {}

    public record OrderRequest(
        @NotEmpty @Valid List<OrderItemRequest> items,
        @Valid DeliveryRequest delivery,
        @Size(max = 30) String couponCode
    ) {}

    public record OrderItemResponse(
        Long id,
        String name,
        String category,
        BigDecimal price,
        Integer quantity,
        String imageUrl
    ) {}

    public record OrderResponse(
        Long id,
        String orderRef,
        String status,
        String customerName,
        String customerEmail,
        String customerPhone,
        String house, String street, String city, String state, String pin, String instructions,
        String paymentMethod,
        List<OrderItemResponse> items,
        BigDecimal subtotal,
        BigDecimal deliveryCharge,
        BigDecimal packagingCharge,
        BigDecimal discount,
        String couponCode,
        BigDecimal total,
        Instant createdAt
    ) {}

    public record StatusUpdateRequest(@NotBlank String status) {}

    public record AdminStatsResponse(
        long totalOrders,
        BigDecimal totalRevenue,
        long pendingOrders,
        long menuItems,
        long totalCustomers
    ) {}
}
