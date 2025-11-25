package com.daou.dop.allapps.doserver.persistence.entity.organization;

import com.daou.dop.allapps.doserver.domain.type.UserStatus;
import com.daou.dop.allapps.doserver.persistence.entity.BaseTimeEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
    name = "\"user\"",
    indexes = {
        @Index(name = "idx1_user", columnList = "company_id"),
        @Index(name = "idx2_user", columnList = "login_id"),
        @Index(name = "idx3_user", columnList = "status"),
        @Index(name = "idx4_user", columnList = "company_id, status")
    }
)
public class User extends BaseTimeEntity {

    @Id
    private Long id;

    @NotNull
    @Column(nullable = false, name = "company_id")
    private Long companyId;

    @Column(length = 63)
    private String name;

    @Column(name = "login_id", length = 255)
    private String loginId;

    @NotNull
    @Column(nullable = false, length = 50)
    @ColumnDefault("'NORMAL'")
    @Enumerated(value = EnumType.STRING)
    private UserStatus status;

    @Column(length = 10)
    private String locale;

    @Column(name = "employee_number", length = 100)
    private String employeeNumber;

    @Column(name = "mobile_number", length = 50)
    private String mobileNumber;

    @Column(name = "profile_image_path", length = 1024)
    private String profileImagePath;

    @Column(name = "grade_code_id")
    private Long gradeCodeId;

    @Column(name = "position_code_id")
    private Long positionCodeId;

    @Column(name = "dormant_at")
    private LocalDateTime dormantAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    public boolean isDeleted() {
        return UserStatus.DELETE.equals(status);
    }

    public void markAsDeleted() {
        this.status = UserStatus.DELETE;
        this.deletedAt = LocalDateTime.now();
    }
}
