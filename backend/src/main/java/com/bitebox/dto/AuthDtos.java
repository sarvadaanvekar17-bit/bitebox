package com.bitebox.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {
    private AuthDtos() {}

    public record RegisterRequest(
        @NotBlank @Size(min = 2, max = 120) String name,
        @NotBlank @Email String email,
        @Size(max = 15) String phone,
        @NotBlank @Size(min = 6, max = 72) String password
    ) {}

    public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank String password
    ) {}

    public record AuthResponse(
        String token,
        Long userId,
        String name,
        String email,
        String phone,
        String role
    ) {}
}
