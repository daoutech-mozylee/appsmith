package com.daou.dop.allapps.doserver.provision.organization.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrgSequenceDto {
    private Long logSeq;
    private boolean needSnapshot;
    private List<Long> snapshotIdList;
    private boolean needUpdateNextLog;
}
