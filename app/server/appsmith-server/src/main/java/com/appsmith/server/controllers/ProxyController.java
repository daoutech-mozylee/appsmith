package com.appsmith.server.controllers;

import com.appsmith.server.constants.Url;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Slf4j
@RestController
@RequestMapping(Url.PROXY_URL)
@RequiredArgsConstructor
public class ProxyController {

    private final WebClient.Builder webClientBuilder;

    @PostMapping
    public Mono<ResponseEntity<String>> proxy(
            @RequestParam HttpMethod method, @RequestParam String host, @RequestParam String uri) {

        String targetUrl = host + uri;
        log.debug("Proxying {} request to: {}", method, targetUrl);

        WebClient webClient = webClientBuilder.build();

        return webClient
                .method(method)
                .uri(targetUrl)
                .retrieve()
                .toEntity(String.class)
                .map(response -> ResponseEntity.status(response.getStatusCode())
                        .headers(headers -> headers.addAll(response.getHeaders()))
                        .body(response.getBody()))
                .onErrorResume(e -> {
                    log.error("Proxy request failed: {}", e.getMessage());
                    return Mono.just(
                            ResponseEntity.internalServerError().body("Proxy request failed: " + e.getMessage()));
                });
    }
}
