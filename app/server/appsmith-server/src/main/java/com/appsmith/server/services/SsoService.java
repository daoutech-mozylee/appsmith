package com.appsmith.server.services;

import com.appsmith.server.domains.User;
import com.appsmith.server.dtos.SsoLoginRequestDTO;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

public interface SsoService {
    Mono<User> loginOrSignup(SsoLoginRequestDTO request, ServerWebExchange exchange);
}
