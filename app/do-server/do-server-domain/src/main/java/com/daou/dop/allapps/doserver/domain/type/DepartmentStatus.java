package com.daou.dop.allapps.doserver.domain.type;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum DepartmentStatus {

    ACTIVE("정상"),
    TEMPORARILY_DELETED("임시 삭제"),
    PERMANENTLY_DELETED("완전 삭제");

    private final String title;
}
