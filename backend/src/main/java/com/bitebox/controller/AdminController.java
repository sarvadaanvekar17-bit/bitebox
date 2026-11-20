package com.bitebox.controller;

import com.bitebox.dto.AdminDtos.AnalyticsResponse;
import com.bitebox.dto.AdminDtos.CustomerSummary;
import com.bitebox.dto.OrderDtos.AdminStatsResponse;
import com.bitebox.dto.OrderDtos.OrderResponse;
import com.bitebox.dto.OrderDtos.StatusUpdateRequest;
import com.bitebox.service.AdminService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService admin;

    public AdminController(AdminService admin) {
        this.admin = admin;
    }

    @GetMapping("/stats")
    public AdminStatsResponse stats() {
        return admin.stats();
    }

    @GetMapping("/orders")
    public List<OrderResponse> orders() {
        return admin.allOrders();
    }

    @PatchMapping("/orders/{orderRef}/status")
    public OrderResponse updateStatus(@PathVariable String orderRef,
                                      @Valid @RequestBody StatusUpdateRequest req) {
        return admin.updateStatus(orderRef, req);
    }

    @GetMapping("/customers")
    public List<CustomerSummary> customers() {
        return admin.customers();
    }

    @GetMapping("/analytics")
    public AnalyticsResponse analytics() {
        return admin.analytics();
    }
}
