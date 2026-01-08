package com.external.plugins.actions;

import com.appsmith.external.models.ActionConfiguration;
import com.appsmith.external.models.ActionExecutionResult;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

/**
 * DaouofficePlugin의 모든 액션에 대한 기본 인터페이스입니다.
 * 각 액션(메일, 메시지, 알림, 전자결재 등)은 이 인터페이스를 구현합니다.
 */
public interface BaseAction {

    /**
     * 액션을 실행합니다.
     *
     * @param connection          WebClient 연결
     * @param actionConfiguration 액션 설정 (FormData 포함)
     * @return 실행 결과
     */
    Mono<ActionExecutionResult> execute(WebClient connection, ActionConfiguration actionConfiguration);

    /**
     * 이 액션이 처리할 수 있는 액션 식별자를 반환합니다.
     *
     * @return 액션 식별자 (예: "send_mail", "send_message")
     */
    String getActionIdentifier();
}
