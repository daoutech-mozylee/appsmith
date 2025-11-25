package com.daou.dop.allapps.doserver.persistence.entity.provision;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Getter
@Builder
@AllArgsConstructor(access = AccessLevel.PROTECTED)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
@Table(
    name = "org_sync_failed_event_log",
    indexes = {
        @Index(name = "idx1_org_sync_failed_event_log", columnList = "created_at"),
        @Index(name = "idx2_org_sync_failed_event_log", columnList = "company_uuid")
    }
)
public class OrgSyncFailedEventLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NonNull
    @Column(nullable = false, name = "company_uuid")
    private String companyUuid;

    @Column(name = "log_seq")
    private Long logSeq;

    @Column(columnDefinition = "TEXT", name = "error_message")
    private String errorMessage;

    @CreatedDate
    @Column(nullable = false, updatable = false, name = "created_at")
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(nullable = false, name = "updated_at")
    private LocalDateTime updatedAt;
}
