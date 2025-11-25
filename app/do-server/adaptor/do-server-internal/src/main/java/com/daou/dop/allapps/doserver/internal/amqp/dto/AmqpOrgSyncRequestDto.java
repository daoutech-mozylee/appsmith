package com.daou.dop.allapps.doserver.internal.amqp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AmqpOrgSyncRequestDto {
    private String companyUuid;
    private Long logSeq;
}
