package com.daou.dop.allapps.doserver.persistence.repository.provision;

import com.daou.dop.allapps.doserver.persistence.entity.provision.OrgSyncCompanyLock;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrgSyncCompanyLockRepository extends JpaRepository<OrgSyncCompanyLock, String> {
}
