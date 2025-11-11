package com.appsmith.server.clients;

import com.appsmith.server.dtos.SsoResponseDTO;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Slf4j
@Component
public class DoExternalGatewayClient {

    private final WebClient webClient;

    public DoExternalGatewayClient() {
        this.webClient = WebClient.builder()
            // TODO: Replace with actual external gateway URL
            .baseUrl("https://dev-exgate.daouoffice.com")
            // TODO: Replace with actual authentication header
            .defaultHeader("X-DaouOffice-Auth",
                "{ \"mac\": \"Pyk+DCZPn85LzIOyCuwazOnWurBdS8rQChkd11ayF+8=\", \"message\": \"test-message\", \"clientId\": \"1\" }")
            .build();
    }

    public Mono<SsoResponseDTO> loginWithSsoToken(String token) {
        return webClient.post()
            .uri("/api/auth/login")
            .bodyValue(Map.of("token", token))
            .retrieve()
            .bodyToMono(SsoResponseDTO.class)
            .doOnError(error -> log.error("Error verifying SSO token", error));
    }

}
