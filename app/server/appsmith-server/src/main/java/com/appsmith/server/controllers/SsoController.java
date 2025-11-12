package com.appsmith.server.controllers;

import com.appsmith.server.constants.Url;
import com.appsmith.server.dtos.SsoLoginRequestDTO;
import com.appsmith.server.services.SsoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.web.server.authentication.ServerAuthenticationSuccessHandler;
import org.springframework.security.web.server.context.ServerSecurityContextRepository;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Slf4j
@RestController
@RequestMapping(Url.SSO_URL)
@RequiredArgsConstructor
public class SsoController {

    private final SsoService ssoService;
    private final ServerSecurityContextRepository securityContextRepository;

    @PostMapping("/login")
    public Mono<Void> login(@RequestBody SsoLoginRequestDTO request, ServerWebExchange exchange) {
        return ssoService.loginOrSignup(request, exchange)
            .flatMap(user -> {
                // Programmatically log the user in
                Authentication authentication = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());

                SecurityContext securityContext = new SecurityContextImpl();
                securityContext.setAuthentication(authentication);

                // Save the security context in the session
                return securityContextRepository.save(exchange, securityContext);
            });
    }

}
