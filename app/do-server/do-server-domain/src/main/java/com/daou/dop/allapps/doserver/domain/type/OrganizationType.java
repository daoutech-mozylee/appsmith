package com.daou.dop.allapps.doserver.domain.type;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Arrays;

@Getter
@RequiredArgsConstructor
public enum OrganizationType {
    GRADE("grade", "직급"),
    POSITION("position", "직위"),
    USER_GROUP("user_group", "사용자그룹"),
    DUTY("duty", "직책");

    private final String title;
    private final String description;

    public static OrganizationType valueOfTitle(String title) {
        return Arrays.stream(values())
            .filter(type -> type.getTitle().equalsIgnoreCase(title))
            .findFirst()
            .orElse(null);
    }
}
