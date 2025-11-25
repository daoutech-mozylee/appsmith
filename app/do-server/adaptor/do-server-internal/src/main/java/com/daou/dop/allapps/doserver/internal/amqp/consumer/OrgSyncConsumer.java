package com.daou.dop.allapps.doserver.internal.amqp.consumer;

import com.daou.dop.allapps.doserver.internal.amqp.config.queue.OrgSyncQueueConfig;
import com.daou.dop.allapps.doserver.internal.amqp.dto.AmqpOrgSyncRequestDto;
import com.daou.dop.allapps.doserver.provision.organization.OrganizationSyncUsecase;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrgSyncConsumer {

    private final OrganizationSyncUsecase organizationSyncUsecase;
    private final ObjectMapper objectMapper;

    @RabbitListener(queues = OrgSyncQueueConfig.QUEUE_NAME)
    public void consumeOrgSyncEvent(Message message) {
        String messageStr = new String(message.getBody());

        try {
            AmqpOrgSyncRequestDto dto = objectMapper.readValue(messageStr, AmqpOrgSyncRequestDto.class);

            if (dto == null || dto.getCompanyUuid() == null) {
                log.error("[조직도 동기화] 유효하지 않은 메시지: {}", messageStr);
                return;
            }

            organizationSyncUsecase.createNewEventMsg(dto.getCompanyUuid(), dto.getLogSeq());
            log.info("[조직도 동기화] 이벤트 저장 완료, uuid={}, logSeq={}", dto.getCompanyUuid(), dto.getLogSeq());

        } catch (DataIntegrityViolationException e) {
            // UNIQUE KEY 충돌 = 중복 이벤트
            log.warn("[조직도 동기화] 중복 이벤트 무시, message={}", messageStr);
        } catch (Exception e) {
            log.error("[조직도 동기화] 처리 중 오류 발생, message={}, error={}", messageStr, e.getMessage(), e);
        }
    }
}
