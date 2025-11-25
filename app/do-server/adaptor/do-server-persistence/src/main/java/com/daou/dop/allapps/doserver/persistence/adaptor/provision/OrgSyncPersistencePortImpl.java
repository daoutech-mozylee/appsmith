package com.daou.dop.allapps.doserver.persistence.adaptor.provision;

import com.daou.dop.allapps.doserver.domain.type.OrgSyncEventMsgStatus;
import com.daou.dop.allapps.doserver.persistence.entity.organization.*;
import com.daou.dop.allapps.doserver.persistence.entity.provision.OrgSyncEventMessage;
import com.daou.dop.allapps.doserver.persistence.entity.provision.OrgSyncFailedEventLog;
import com.daou.dop.allapps.doserver.persistence.repository.organization.*;
import com.daou.dop.allapps.doserver.persistence.repository.provision.OrgSyncEventMessageRepository;
import com.daou.dop.allapps.doserver.persistence.repository.provision.OrgSyncFailedEventLogRepository;
import com.daou.dop.allapps.doserver.provision.organization.dto.*;
import com.daou.dop.allapps.doserver.provision.organization.port.OrgSyncPersistencePort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class OrgSyncPersistencePortImpl implements OrgSyncPersistencePort {

    private final OrgSyncEventMessageRepository eventMessageRepository;
    private final OrgSyncFailedEventLogRepository failedEventLogRepository;
    private final OrganizationCodeRepository organizationCodeRepository;
    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final MemberRepository memberRepository;

    @Override
    @Transactional
    public void saveEventMessage(OrgSyncEventMessageDto dto) {
        OrgSyncEventMessage entity = OrgSyncEventMessage.builder()
            .companyUuid(dto.getCompanyUuid())
            .logSeq(dto.getLogSeq())
            .status(OrgSyncEventMsgStatus.PENDING)
            .retryCount(0)
            .build();

        eventMessageRepository.save(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<String> findPendingCompany() {
        return eventMessageRepository.findFirstPendingCompanyUuid(OrgSyncEventMsgStatus.PENDING.name());
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrgSyncEventMessageDto> fetchPendingBatch(String companyUuid, int limit) {
        List<OrgSyncEventMessage> entities = eventMessageRepository
            .findTop100ByCompanyUuidAndStatusOrderByLogSeqAsc(
                companyUuid,
                OrgSyncEventMsgStatus.PENDING
            );

        return entities.stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void updateEventStatus(Long id, OrgSyncEventMsgStatus status) {
        eventMessageRepository.findById(id).ifPresent(entity -> {
            entity.setStatus(status);
            eventMessageRepository.save(entity);
        });
    }

    @Override
    @Transactional
    public void saveFailedLog(String companyUuid, Long logSeq, String errorMessage) {
        OrgSyncFailedEventLog log = OrgSyncFailedEventLog.builder()
            .companyUuid(companyUuid)
            .logSeq(logSeq)
            .errorMessage(errorMessage)
            .build();

        failedEventLogRepository.save(log);
    }

    private OrgSyncEventMessageDto toDto(OrgSyncEventMessage entity) {
        return OrgSyncEventMessageDto.builder()
            .id(entity.getId())
            .companyUuid(entity.getCompanyUuid())
            .logSeq(entity.getLogSeq())
            .status(entity.getStatus())
            .retryCount(entity.getRetryCount())
            .build();
    }

    // OrganizationCode
    @Override
    @Transactional(readOnly = true)
    public List<Long> getOrgCodeIdsByCompanyId(Long companyId) {
        return organizationCodeRepository.findAllIdsByCompanyId(companyId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrgOrganizationCodeDto> getAllOrgCodesByIdsAndCompany(Long companyId, Collection<Long> orgCodeIds) {
        if (orgCodeIds == null || orgCodeIds.isEmpty()) {
            return new ArrayList<>();
        }
        List<OrganizationCode> entities = organizationCodeRepository.findAllById(orgCodeIds);
        return entities.stream()
            .filter(e -> e.getCompanyId().equals(companyId))
            .map(this::toOrgCodeDto)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> findExistingOrgCodeIdsByCompany(Long companyId, Collection<Long> orgCodeIds) {
        if (orgCodeIds == null || orgCodeIds.isEmpty()) {
            return new ArrayList<>();
        }
        return organizationCodeRepository.findExistingIdsByCompanyIdAndIds(companyId, new ArrayList<>(orgCodeIds));
    }

    // Department
    @Override
    @Transactional(readOnly = true)
    public List<Long> getDeptIdsByCompanyId(Long companyId) {
        return departmentRepository.findAllIdsByCompanyId(companyId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrgDepartmentDto> getAllDeptsByIdsAndCompany(Long companyId, Collection<Long> departmentIds) {
        if (departmentIds == null || departmentIds.isEmpty()) {
            return new ArrayList<>();
        }
        List<Department> entities = departmentRepository.findAllById(departmentIds);
        return entities.stream()
            .filter(e -> e.getCompanyId().equals(companyId))
            .map(this::toDeptDto)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> findExistingDeptIdsByCompany(Long companyId, List<Long> deptIds) {
        if (deptIds == null || deptIds.isEmpty()) {
            return new ArrayList<>();
        }
        return departmentRepository.findExistingIdsByCompanyIdAndIds(companyId, deptIds);
    }

    // User
    @Override
    @Transactional(readOnly = true)
    public List<Long> getUserIdsByCompanyId(Long companyId) {
        return userRepository.findAllIdsByCompanyId(companyId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrgUserDto> getAllUsersByIdsAndCompany(Long companyId, Collection<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return new ArrayList<>();
        }
        List<User> entities = userRepository.findAllById(userIds);
        return entities.stream()
            .filter(e -> e.getCompanyId().equals(companyId))
            .map(this::toUserDto)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> findExistingUserIdsByCompany(Long companyId, List<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return new ArrayList<>();
        }
        return userRepository.findExistingIdsByCompanyIdAndIds(companyId, userIds);
    }

    // Member
    @Override
    @Transactional(readOnly = true)
    public List<OrgMemberDto> getAllMemberByIds(Collection<Long> memberIds) {
        if (memberIds == null || memberIds.isEmpty()) {
            return new ArrayList<>();
        }
        List<Member> entities = memberRepository.findAllById(memberIds);
        return entities.stream()
            .map(this::toMemberDto)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> findExistingMemberIds(List<Long> memberIds) {
        if (memberIds == null || memberIds.isEmpty()) {
            return new ArrayList<>();
        }
        List<Member> entities = memberRepository.findAllById(memberIds);
        return entities.stream()
            .map(Member::getId)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> getMemberIdsByDeptIds(List<Long> deptIds) {
        if (deptIds == null || deptIds.isEmpty()) {
            return new ArrayList<>();
        }
        List<Member> members = memberRepository.findByDepartmentIdIn(deptIds);
        return members.stream()
            .map(Member::getId)
            .collect(Collectors.toList());
    }

    // Entity to DTO converters
    private OrgOrganizationCodeDto toOrgCodeDto(OrganizationCode entity) {
        return OrgOrganizationCodeDto.builder()
            .id(entity.getId())
            .companyId(entity.getCompanyId())
            .name(entity.getName())
            .code(entity.getCode())
            .type(entity.getType())
            .sortOrder(entity.getSortOrder())
            .build();
    }

    private OrgDepartmentDto toDeptDto(Department entity) {
        return OrgDepartmentDto.builder()
            .id(entity.getId())
            .companyId(entity.getCompanyId())
            .name(entity.getName())
            .parentId(entity.getParentId())
            .code(entity.getCode())
            .alias(entity.getAlias())
            .email(entity.getEmail())
            .status(entity.getStatus())
            .sortOrder(entity.getSortOrder())
            .departmentPath(entity.getDepartmentPath())
            .deletedAt(entity.getDeletedAt())
            .build();
    }

    private OrgUserDto toUserDto(User entity) {
        return OrgUserDto.builder()
            .id(entity.getId())
            .companyId(entity.getCompanyId())
            .name(entity.getName())
            .loginId(entity.getLoginId())
            .status(entity.getStatus())
            .locale(entity.getLocale())
            .employeeNumber(entity.getEmployeeNumber())
            .mobileNumber(entity.getMobileNumber())
            .profileImagePath(entity.getProfileImagePath())
            .gradeCodeId(entity.getGradeCodeId())
            .positionCodeId(entity.getPositionCodeId())
            .dormantAt(entity.getDormantAt())
            .deletedAt(entity.getDeletedAt())
            .build();
    }

    private OrgMemberDto toMemberDto(Member entity) {
        return OrgMemberDto.builder()
            .id(entity.getId())
            .userId(entity.getUserId())
            .departmentId(entity.getDepartmentId())
            .dutyCodeId(entity.getDutyCodeId())
            .memberType(entity.getMemberType())
            .sortOrder(entity.getSortOrder())
            .departmentOrder(entity.getDepartmentOrder())
            .build();
    }
}
