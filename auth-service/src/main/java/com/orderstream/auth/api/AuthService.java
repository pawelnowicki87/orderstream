package com.orderstream.auth.api;

import com.orderstream.auth.jwt.JwtService;
import com.orderstream.auth.user.AppUser;
import com.orderstream.auth.user.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(AppUserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthDtos.AuthResponse register(AuthDtos.RegisterRequest request) {
        if (users.existsByEmail(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "email already registered");
        }
        AppUser saved = users.save(new AppUser(
                request.email(),
                passwordEncoder.encode(request.password()),
                request.fullName()));
        return toResponse(saved);
    }

    public AuthDtos.AuthResponse login(AuthDtos.LoginRequest request) {
        AppUser user = users.findByEmail(request.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials");
        }
        return toResponse(user);
    }

    private AuthDtos.AuthResponse toResponse(AppUser user) {
        String token = jwtService.generateToken(user.getId(), user.getEmail());
        return new AuthDtos.AuthResponse(token, user.getId(), user.getEmail(), user.getFullName());
    }
}
