package com.daou.dop.allapps.doserver.provision.organization.scheduler;

import com.daou.dop.allapps.doserver.provision.organization.component.CompanyLockManager;
import com.daou.dop.allapps.doserver.provision.organization.component.OrgSyncEventMessageHelper;
import com.daou.dop.allapps.doserver.provision.organization.dto.OrgSyncEventMessageDto;
import com.daou.dop.allapps.doserver.provision.organization.service.OrgSyncEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrgSyncScheduler {

    private static final int BATCH_EVENT_MSG_COUNT = 100;

    private final TaskExecutor orgSyncTaskExecutor;
    private final OrgSyncEventService orgSyncEventService;
    private final OrgSyncEventMessageHelper orgSyncEventMessageHelper;
    private final CompanyLockManager companyLockManager;

    @Scheduled(fixedDelayString = "${org-sync.scheduler.fixed-delay:1000}")
    public void pollAndProcessCompanies() {
        String companyUuid = orgSyncEventMessageHelper.findPendingCompany();

        if (!StringUtils.hasText(companyUuid)) {
            return;
        }

        orgSyncTaskExecutor.execute(() -> {
            boolean executed = companyLockManager.executeWithLock(companyUuid, () ->
                processCompany(companyUuid)
            );

            if (!executed) {
                log.warn("[조직도 동기화 스케줄러] 다른 프로세스에서 처리 중, uuid={}", companyUuid);
            }
        });
    }

    private Void processCompany(String companyUuid) {
        log.info("[조직도 동기화 스케줄러] 처리 시작, uuid={}", companyUuid);

        List<OrgSyncEventMessageDto> events =
            orgSyncEventMessageHelper.fetchPendingBatch(companyUuid, BATCH_EVENT_MSG_COUNT);

        for (OrgSyncEventMessageDto event : events) {
            orgSyncEventService.handleEvent(event);
        }

        log.info("[조직도 동기화 스케줄러] 처리 완료, uuid={}, processedCount={}",
            companyUuid, events.size());

        return null;
    }
}
