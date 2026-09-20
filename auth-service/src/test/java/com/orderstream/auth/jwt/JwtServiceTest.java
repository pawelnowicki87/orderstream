package com.orderstream.auth.jwt;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private static final String SECRET = "test-secret-key-that-is-long-enough-for-hs256-algorithm";

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(SECRET, 120);
    }

    @Test
    void generatesTokenContainingUserIdAndEmail() {
        String token = jwtService.generateToken(42L, "pawel@example.com");

        assertNotNull(token);
        assertEquals(42L, jwtService.extractUserId(token));
        assertEquals("pawel@example.com", jwtService.extractEmail(token));
    }

    @Test
    void rejectsTokenSignedWithDifferentSecret() {
        JwtService otherService = new JwtService("a-completely-different-secret-key-also-long-enough", 120);
        String foreignToken = otherService.generateToken(1L, "attacker@example.com");

        assertThrows(Exception.class, () -> jwtService.extractUserId(foreignToken));
    }
}
