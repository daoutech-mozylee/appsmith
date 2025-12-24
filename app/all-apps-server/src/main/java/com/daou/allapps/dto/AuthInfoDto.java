package com.daou.allapps.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.List;

@ToString
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthInfoDto {
    private String device;
    private String userIpaddr;
    private Long requestId;
    private Long userId;
    private String companyUuid;
    private String tokenUuid;
    private List<String> integrates;
    private List<String> companyGroups;
    private Long representativeUserId;
}
