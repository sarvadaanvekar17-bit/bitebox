package com.bitebox.service;

import com.bitebox.dto.AuthDtos.AuthResponse;
import com.bitebox.dto.AuthDtos.LoginRequest;
import com.bitebox.dto.AuthDtos.RegisterRequest;
import com.bitebox.entity.Role;
import com.bitebox.entity.User;
import com.bitebox.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthService(UserRepository users, PasswordEncoder encoder, JwtService jwt) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    public AuthResponse register(RegisterRequest req) {
        if (users.existsByEmailIgnoreCase(req.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists.");
        }
        User u = new User();
        u.setName(req.name().trim());
        u.setEmail(req.email().trim().toLowerCase());
        u.setPhone(req.phone());
        u.setPasswordHash(encoder.encode(req.password()));
        u.setRole(Role.CUSTOMER);
        users.save(u);
        return toResponse(u);
    }

    public AuthResponse login(LoginRequest req) {
        User u = users.findByEmailIgnoreCase(req.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password."));
        if (!encoder.matches(req.password(), u.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
        }
        return toResponse(u);
    }

    private AuthResponse toResponse(User u) {
        return new AuthResponse(
                jwt.generate(u), u.getId(), u.getName(), u.getEmail(), u.getPhone(),
                u.getRole().name());
    }
}
