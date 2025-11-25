package com.daou.dop.allapps.doserver.provision.organization.component;

import com.daou.dop.allapps.doserver.provision.organization.dto.OrgSyncEventMessageDto;
import com.daou.dop.allapps.doserver.provision.organization.port.OrgSyncPersistencePort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrgSyncEventMessageHelper {

    private final OrgSyncPersistencePort orgSyncPersistencePort;

    public String findPendingCompany() {
        Optional<String> companyUuid = orgSyncPersistencePort.findPendingCompany();
        return companyUuid.orElse(null);
    }

    public List<OrgSyncEventMessageDto> fetchPendingBatch(String companyUuid, int limit) {
        return orgSyncPersistencePort.fetchPendingBatch(companyUuid, limit);
    }
}
