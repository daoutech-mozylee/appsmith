package com.daou.dop.allapps.doserver.persistence.entity.provision;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

import java.time.ZonedDateTime;

@Entity
@Getter
@Builder
@AllArgsConstructor(access = AccessLevel.PROTECTED)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "org_sync_company_lock")
public class OrgSyncCompanyLock {

    @Id
    private String companyUuid;

    private ZonedDateTime lockedAt;
}
