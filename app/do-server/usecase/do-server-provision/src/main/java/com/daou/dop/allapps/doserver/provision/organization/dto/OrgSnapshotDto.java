package com.daou.dop.allapps.doserver.provision.organization.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrgSnapshotDto {
    private Long snapshotId;
    private Long logSeq;
    // TODO: 실제 스냅샷 데이터 필드 추가 필요
    // organizationCodeSnapshot, departmentSnapshot, userSnapshot, memberSnapshot 등
}
