package com.daou.dop.allapps.doserver.provision.organization.service;

import com.daou.dop.allapps.doserver.domain.type.OrgSyncEventMsgStatus;
import com.daou.dop.allapps.doserver.provision.organization.OrganizationSyncUsecase;
import com.daou.dop.allapps.doserver.provision.organization.dto.OrgSyncEventMessageDto;
import com.daou.dop.allapps.doserver.provision.organization.port.OrgSyncPersistencePort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrgSyncEventService {

    private final OrganizationSyncUsecase organizationSyncUsecase;
    private final OrgSyncPersistencePort orgSyncPersistencePort;

    public void handleEvent(OrgSyncEventMessageDto event) {
        try {
            // 처리 중 상태로 변경
            orgSyncPersistencePort.updateEventStatus(event.getId(), OrgSyncEventMsgStatus.PROCESSING);

            // 동기화 실행
            organizationSyncUsecase.syncOrganizationChart(event.getCompanyUuid(), event.getLogSeq());

            // 완료 상태로 변경
            orgSyncPersistencePort.updateEventStatus(event.getId(), OrgSyncEventMsgStatus.COMPLETED);

            log.info("[이벤트 처리] 성공, uuid={}, logSeq={}", event.getCompanyUuid(), event.getLogSeq());

        } catch (Exception e) {
            log.error("[이벤트 처리] 실패, uuid={}, logSeq={}, error={}",
                event.getCompanyUuid(), event.getLogSeq(), e.getMessage(), e);

            // 실패 상태로 변경
            orgSyncPersistencePort.updateEventStatus(event.getId(), OrgSyncEventMsgStatus.FAILED);

            // 실패 로그 저장
            orgSyncPersistencePort.saveFailedLog(
                event.getCompanyUuid(),
                event.getLogSeq(),
                e.getMessage() + "\n" + getStackTraceAsString(e)
            );
        }
    }

    private String getStackTraceAsString(Exception e) {
        StringBuilder sb = new StringBuilder();
        for (StackTraceElement element : e.getStackTrace()) {
            sb.append(element.toString()).append("\n");
        }
        return sb.toString();
    }
}
