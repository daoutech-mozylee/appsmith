package com.daou.allapps.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.Getter;
import lombok.ToString;

import java.util.List;

@ToString
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserMyInfoDto {
    private Long userId;
    private String companyUuid;
    private String userName;
    private String position;
    private List<String> myApps;
}
