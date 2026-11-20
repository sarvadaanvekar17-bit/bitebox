package com.bitebox.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public final class AdminDtos {
    private AdminDtos() {}

    public record CustomerSummary(
        Long id,
        String name,
        String email,
        String phone,
        long orderCount,
        BigDecimal totalSpent
    ) {}

    public record TopItem(
        String name,
        long quantity,
        BigDecimal revenue
    ) {}

    public record AnalyticsResponse(
        BigDecimal totalRevenue,
        Map<String, Long> ordersByStatus,
        List<TopItem> topItems,
        long cancelledOrders
    ) {}
}
