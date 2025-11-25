package com.daou.dop.allapps.doserver.domain.type;

import lombok.Getter;

import java.util.Arrays;

@Getter
public enum MemberType {

    DEPARTMENT_HEAD("department_head", "부서장"),
    ASSISTANT_HEAD("assistant_head", "부부서장"),
    TEAM_MEMBER("team_member", "부서원");

    private final String code;
    private final String title;

    MemberType(String code, String title) {
        this.code = code;
        this.title = title;
    }

    public static MemberType valueOfTitle(String title) {
        return Arrays.stream(values())
            .filter(type -> type.getTitle().equalsIgnoreCase(title))
            .findFirst()
            .orElse(TEAM_MEMBER);
    }
}
