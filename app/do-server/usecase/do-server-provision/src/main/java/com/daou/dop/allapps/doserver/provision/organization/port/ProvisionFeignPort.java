package com.daou.dop.allapps.doserver.provision.organization.port;

import com.daou.dop.allapps.doserver.provision.organization.dto.OrgSequenceDto;
import com.daou.dop.allapps.doserver.provision.organization.dto.OrgSnapshotDto;

import java.util.List;

/**
 * 프로비저닝 서버 API 호출을 위한 Port
 * 실제 구현은 Feign Client로 진행 (현재는 TODO)
 */
public interface ProvisionFeignPort {

    OrgSequenceDto getSequenceData(String companyUuid, Long logSeq);

    OrgSnapshotDto getSnapshotData(String companyUuid, Long snapshotId);
}
