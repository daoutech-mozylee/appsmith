package com.appsmith.server.services;

import com.appsmith.server.clients.DoExternalGatewayClient;
import com.appsmith.server.domains.LoginSource;
import com.appsmith.server.domains.User;
import com.appsmith.server.dtos.SsoLoginRequestDTO;
import com.appsmith.server.dtos.SsoResponseDTO;
import com.appsmith.server.dtos.UserSignupDTO;
import com.appsmith.server.exceptions.AppsmithError;
import com.appsmith.server.exceptions.AppsmithException;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Slf4j
@Service
@RequiredArgsConstructor
public class SsoServiceImpl implements SsoService {

    private final DoExternalGatewayClient externalGatewayClient;
    private final UserService userService;

    @Override
    public Mono<User> loginOrSignup(SsoLoginRequestDTO request, ServerWebExchange exchange) {
        return externalGatewayClient.loginWithSsoToken(request.getToken())
            .flatMap(this::getUserMono);
//        SsoResponseDTO response = SsoResponseDTO.fixture();
//        return getUserMono(response);
    }

    private Mono<User> getUserMono(SsoResponseDTO ssoResponse) {
        if (ssoResponse.getEmail() == null || ssoResponse.getEmail().isBlank()) {
            return Mono.error(new AppsmithException(AppsmithError.INTERNAL_SERVER_ERROR, "Email not provided by SSO provider."));
        }

        // 2. Check if user exists
        return userService.findByEmail(ssoResponse.getEmail())
            .switchIfEmpty(Mono.defer(() -> createNewUser(ssoResponse)))
            .doOnNext(user -> log.info("User found or created: {}", user.getEmail()));
    }

    private Mono<User> createNewUser(SsoResponseDTO ssoResponse) {
        log.info("User with email {} not found. Creating a new user.", ssoResponse.getEmail());
        User newUser = new User();
        newUser.setEmail(ssoResponse.getEmail());
        newUser.setName(ssoResponse.getName());
        newUser.setSource(LoginSource.SSO);
        return userService.createUser(newUser)
            .map(UserSignupDTO::getUser);
    }
}
