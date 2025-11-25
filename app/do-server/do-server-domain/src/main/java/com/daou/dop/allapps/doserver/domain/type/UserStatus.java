package com.daou.dop.allapps.doserver.domain.type;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Arrays;
import java.util.List;

@Getter
@AllArgsConstructor
public enum UserStatus {
    NONE("상태없음"),
    NORMAL("정상"),
    DORMANT("휴면"),
    STOP("중지"),
    DELETE("삭제");

    private final String title;

    public boolean isNormalUser() {
        return NORMAL.equals(this);
    }

    public boolean isDormantUser() {
        return DORMANT.equals(this);
    }

    public boolean isDeletedUser() {
        return DELETE.equals(this);
    }

    public boolean isStopUser() {
        return STOP.equals(this);
    }

    public boolean isActiveUser() {
        return NORMAL.equals(this) || DORMANT.equals(this);
    }

    public static List<UserStatus> getAvailableUserList() {
        return Arrays.asList(NORMAL, DORMANT);
    }

    public static UserStatus valueOfTitle(String title) {
        return Arrays.stream(values())
            .filter(status -> status.getTitle().equalsIgnoreCase(title))
            .findFirst()
            .orElse(NORMAL);
    }
}
