package com.bitebox.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public final class MenuDtos {
    private MenuDtos() {}

    public record MenuItemRequest(
        @NotBlank String name,
        String description,
        @NotNull @DecimalMin("0.01") BigDecimal price,
        String category,
        String imageUrl,
        Boolean available,
        Double rating,
        Integer reviews
    ) {}

    public record MenuItemResponse(
        Long id,
        String name,
        String description,
        BigDecimal price,
        String category,
        String imageUrl,
        Boolean available,
        Double rating,
        Integer reviews
    ) {}
}
