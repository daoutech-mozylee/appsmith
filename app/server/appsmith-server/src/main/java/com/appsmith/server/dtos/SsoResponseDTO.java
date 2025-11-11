package com.appsmith.server.dtos;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Getter
@ToString
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class SsoResponseDTO {

    private String loginId;
    private String email;
    private String name;
    private Long userId;
    private String companyUuid;
    private String siteUrl;
    private String domainName;

    @Builder(access = AccessLevel.PRIVATE)
    private SsoResponseDTO(
        String loginId,
        String email,
        String name,
        Long userId,
        String companyUuid,
        String siteUrl,
        String domainName
    ) {
        this.loginId = loginId;
        this.email = email;
        this.name = name;
        this.userId = userId;
        this.companyUuid = companyUuid;
        this.siteUrl = siteUrl;
        this.domainName = domainName;
    }

    public static SsoResponseDTO of(
        String loginId,
        String email,
        String name,
        Long userId,
        String companyUuid,
        String siteUrl,
        String domainName
    ) {
        return SsoResponseDTO.builder()
            .loginId(loginId)
            .email(email)
            .name(name)
            .userId(userId)
            .companyUuid(companyUuid)
            .siteUrl(siteUrl)
            .domainName(domainName)
            .build();
    }

}
