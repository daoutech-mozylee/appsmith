package com.daou.dop.allapps.doserver.provision.organization.dto;

import com.daou.dop.allapps.doserver.domain.type.OrgSyncEventMsgStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrgSyncEventMessageDto {
    private Long id;
    private String companyUuid;
    private Long logSeq;
    private OrgSyncEventMsgStatus status;
    private int retryCount;
}
