package com.appsmith.server.filters;

import com.appsmith.server.constants.Url;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

/**
 * 서비스 토큰 인증 필터
 *
 * UIModule API의 쓰기 작업(POST, DELETE)에 대해 X-Service-Token 헤더를 검증합니다.
 * GET 요청은 인증 없이 접근 가능합니다.
 */
@Slf4j
@Component
public class ServiceTokenAuthFilter implements WebFilter {

    private static final String SERVICE_TOKEN_HEADER = "X-Service-Token";

    @Value("${appsmith.service.token:}")
    private String serviceToken;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getPath().toString();
        HttpMethod method = exchange.getRequest().getMethod();

        // UIModule API 경로만 검사
        if (!path.startsWith(Url.UI_MODULE_URL)) {
            return chain.filter(exchange);
        }

        // GET 요청은 인증 없이 허용
        if (HttpMethod.GET.equals(method)) {
            return chain.filter(exchange);
        }

        // 서비스 토큰이 설정되지 않은 경우 모든 요청 허용 (개발 환경)
        if (serviceToken == null || serviceToken.isEmpty()) {
            log.warn("Service token is not configured. All write requests to UIModule API are allowed.");
            return chain.filter(exchange);
        }

        // POST, DELETE 요청은 서비스 토큰 검증
        String requestToken = exchange.getRequest().getHeaders().getFirst(SERVICE_TOKEN_HEADER);

        if (requestToken == null || !serviceToken.equals(requestToken)) {
            log.warn("Invalid or missing service token for UIModule API: path={}, method={}", path, method);
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        return chain.filter(exchange);
    }
}
