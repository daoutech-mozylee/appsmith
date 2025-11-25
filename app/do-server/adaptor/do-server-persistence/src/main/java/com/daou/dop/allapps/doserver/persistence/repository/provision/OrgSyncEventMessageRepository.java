package com.daou.dop.allapps.doserver.persistence.repository.provision;

import com.daou.dop.allapps.doserver.domain.type.OrgSyncEventMsgStatus;
import com.daou.dop.allapps.doserver.persistence.entity.provision.OrgSyncEventMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OrgSyncEventMessageRepository extends JpaRepository<OrgSyncEventMessage, Long> {

    @Query(value = "SELECT company_uuid FROM org_sync_event_message WHERE status = :status GROUP BY company_uuid ORDER BY MIN(updated_at) ASC LIMIT 1", nativeQuery = true)
    Optional<String> findFirstPendingCompanyUuid(@Param("status") String status);

    List<OrgSyncEventMessage> findTop100ByCompanyUuidAndStatusOrderByLogSeqAsc(
        String companyUuid,
        OrgSyncEventMsgStatus status
    );
}
