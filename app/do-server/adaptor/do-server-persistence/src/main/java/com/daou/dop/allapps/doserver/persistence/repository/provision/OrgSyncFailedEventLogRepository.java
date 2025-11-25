package com.daou.dop.allapps.doserver.persistence.repository.provision;

import com.daou.dop.allapps.doserver.persistence.entity.provision.OrgSyncFailedEventLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrgSyncFailedEventLogRepository extends JpaRepository<OrgSyncFailedEventLog, Long> {
}
