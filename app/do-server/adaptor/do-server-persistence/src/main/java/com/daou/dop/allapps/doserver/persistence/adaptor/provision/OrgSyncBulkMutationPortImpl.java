package com.daou.dop.allapps.doserver.persistence.adaptor.provision;

import com.daou.dop.allapps.doserver.persistence.entity.organization.*;
import com.daou.dop.allapps.doserver.persistence.mapper.*;
import com.daou.dop.allapps.doserver.persistence.repository.organization.*;
import com.daou.dop.allapps.doserver.provision.organization.dto.*;
import com.daou.dop.allapps.doserver.provision.organization.port.OrgSyncBulkMutationPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrgSyncBulkMutationPortImpl implements OrgSyncBulkMutationPort {

    private final OrganizationCodeRepository organizationCodeRepository;
    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final MemberRepository memberRepository;

    // ========== OrganizationCode ==========

    @Override
    @Transactional
    public void bulkOrgCodeChanges(Long companyId, List<OrgOrganizationCodeDto> modifiedOrgCodes) {
        bulkChanges(modifiedOrgCodes,
            this::bulkInsertOrgCodes,
            toUpdate -> bulkUpdateOrgCodes(companyId, toUpdate),
            toDelete -> bulkDeleteOrgCodes(companyId, toDelete));
    }

    @Override
    @Transactional
    public void bulkInsertOrgCodes(List<OrgOrganizationCodeDto> newOrgCodes) {
        if (newOrgCodes == null || newOrgCodes.isEmpty()) {
            return;
        }
        List<OrganizationCode> entities = newOrgCodes.stream()
            .map(OrganizationCodeMapper::toEntity)
            .collect(Collectors.toList());
        organizationCodeRepository.saveAll(entities);
        organizationCodeRepository.flush();
        log.info("[조직도 동기화] 신규 조직코드 {}건 batch insert 완료", newOrgCodes.size());
    }

    @Override
    @Transactional
    public void bulkUpdateOrgCodes(Long companyId, List<OrgOrganizationCodeDto> existingOrgCodes) {
        if (existingOrgCodes == null || existingOrgCodes.isEmpty()) {
            return;
        }
        Map<Long, OrgOrganizationCodeDto> dtoMap = existingOrgCodes.stream()
            .collect(Collectors.toMap(OrgOrganizationCodeDto::getId, Function.identity(), (a, b) -> a));

        List<OrganizationCode> entities = organizationCodeRepository.findAllById(dtoMap.keySet());
        entities.forEach(entity -> {
            OrgOrganizationCodeDto dto = dtoMap.get(entity.getId());
            if (dto != null && entity.getCompanyId().equals(companyId)) {
                OrganizationCodeMapper.applyToEntity(entity, dto);
            }
        });

        organizationCodeRepository.saveAll(entities);
        log.info("[조직도 동기화] 기존 조직코드 {}건 batch update 완료", existingOrgCodes.size());
    }

    @Override
    @Transactional
    public void bulkDeleteOrgCodes(Long companyId, List<Long> deleteIds) {
        if (deleteIds == null || deleteIds.isEmpty()) {
            return;
        }
        organizationCodeRepository.deleteAllById(deleteIds);
        log.info("[조직도 동기화] 기존 조직코드 {}건 batch delete 완료", deleteIds.size());
    }

    // ========== Department ==========

    @Override
    @Transactional
    public void bulkDeptChanges(Long companyId, List<OrgDepartmentDto> modifiedDepts) {
        bulkChanges(modifiedDepts,
            this::bulkInsertDepts,
            this::bulkUpdateDepts,
            ids -> bulkDeleteDepts(companyId, ids));
    }

    @Override
    @Transactional
    public void bulkInsertDepts(List<OrgDepartmentDto> newDepts) {
        if (newDepts == null || newDepts.isEmpty()) {
            return;
        }
        List<Department> entities = newDepts.stream()
            .sorted(Comparator.comparing(OrgDepartmentDto::getId))
            .map(dto -> {
                Department dept = DepartmentMapper.toEntity(dto);
                departmentRepository.saveAndFlush(dept);
                return dept;
            })
            .collect(Collectors.toList());

        log.info("[조직도 동기화] 신규 부서 {}건 batch insert 완료", entities.size());
    }

    @Override
    @Transactional
    public void bulkUpdateDepts(List<OrgDepartmentDto> existingDepts) {
        if (existingDepts == null || existingDepts.isEmpty()) {
            return;
        }
        Map<Long, OrgDepartmentDto> dtoMap = existingDepts.stream()
            .collect(Collectors.toMap(OrgDepartmentDto::getId, Function.identity(), (a, b) -> a));

        List<Department> entities = departmentRepository.findAllById(dtoMap.keySet());
        entities.forEach(entity -> {
            OrgDepartmentDto dto = dtoMap.get(entity.getId());
            if (dto != null) {
                DepartmentMapper.applyToEntity(entity, dto);
            }
        });

        departmentRepository.saveAll(entities);
        log.info("[조직도 동기화] 기존 부서 {}건 batch update 완료", existingDepts.size());
    }

    @Override
    @Transactional
    public void bulkDeleteDepts(Long companyId, List<Long> deleteDeptIds) {
        if (deleteDeptIds == null || deleteDeptIds.isEmpty()) {
            return;
        }
        // 멤버 먼저 삭제 (외래키 관계)
        memberRepository.deleteAll(memberRepository.findByDepartmentIdIn(deleteDeptIds));
        // 부서 삭제
        departmentRepository.deleteAllById(deleteDeptIds);
        log.info("[조직도 동기화] 기존 부서 {}건 batch delete 완료", deleteDeptIds.size());
    }

    // ========== User ==========

    @Override
    @Transactional
    public void bulkUserChanges(Long companyId, List<OrgUserDto> modifiedUsers) {
        bulkChanges(modifiedUsers,
            toInsert -> bulkInsertUsers(companyId, toInsert),
            this::bulkUpdateUsers,
            ids -> bulkDeleteUsers(companyId, ids));
    }

    @Override
    @Transactional
    public void bulkInsertUsers(Long companyId, List<OrgUserDto> newUsers) {
        if (newUsers == null || newUsers.isEmpty()) {
            return;
        }
        List<User> entities = newUsers.stream()
            .map(UserMapper::toEntity)
            .collect(Collectors.toList());
        userRepository.saveAll(entities);
        userRepository.flush();
        log.info("[조직도 동기화] 신규 사용자 {}건 batch insert 완료", newUsers.size());
    }

    @Override
    @Transactional
    public void bulkUpdateUsers(List<OrgUserDto> existingUsers) {
        if (existingUsers == null || existingUsers.isEmpty()) {
            return;
        }
        Map<Long, OrgUserDto> dtoMap = existingUsers.stream()
            .collect(Collectors.toMap(OrgUserDto::getId, Function.identity(), (a, b) -> a));

        List<User> entities = userRepository.findAllById(dtoMap.keySet());
        entities.forEach(entity -> {
            OrgUserDto dto = dtoMap.get(entity.getId());
            if (dto != null) {
                UserMapper.applyToEntity(entity, dto);
            }
        });

        userRepository.saveAll(entities);
        log.info("[조직도 동기화] 기존 사용자 {}건 batch update 완료", existingUsers.size());
    }

    @Override
    @Transactional
    public void bulkDeleteUsers(Long companyId, List<Long> deleteUserIds) {
        if (deleteUserIds == null || deleteUserIds.isEmpty()) {
            return;
        }
        // 사용자 삭제 마킹 (실제 삭제가 아닌 deletedAt 설정)
        List<User> users = userRepository.findAllById(deleteUserIds);
        users.forEach(User::markAsDeleted);
        userRepository.saveAll(users);
        log.info("[조직도 동기화] 기존 사용자 {}건 batch markAsDeleted 완료", deleteUserIds.size());
    }

    // ========== Member ==========

    @Override
    @Transactional
    public void bulkMemberChanges(Long companyId, List<OrgMemberDto> modifiedMembers) {
        bulkChanges(modifiedMembers,
            this::bulkInsertMembers,
            this::bulkUpdateMembers,
            this::bulkDeleteMembers);
    }

    @Override
    @Transactional
    public void bulkInsertMembers(List<OrgMemberDto> newMembers) {
        if (newMembers == null || newMembers.isEmpty()) {
            return;
        }
        List<Member> entities = newMembers.stream()
            .map(MemberMapper::toEntity)
            .collect(Collectors.toList());
        memberRepository.saveAll(entities);
        log.info("[조직도 동기화] 신규 멤버 {}건 batch insert 완료", newMembers.size());
    }

    @Override
    @Transactional
    public void bulkUpdateMembers(List<OrgMemberDto> existingMembers) {
        if (existingMembers == null || existingMembers.isEmpty()) {
            return;
        }
        Map<Long, OrgMemberDto> dtoMap = existingMembers.stream()
            .collect(Collectors.toMap(OrgMemberDto::getId, Function.identity(), (a, b) -> a));

        List<Member> entities = memberRepository.findAllById(dtoMap.keySet());
        entities.forEach(entity -> {
            OrgMemberDto dto = dtoMap.get(entity.getId());
            if (dto != null) {
                MemberMapper.applyToEntity(entity, dto);
            }
        });

        memberRepository.saveAll(entities);
        log.info("[조직도 동기화] 기존 멤버 {}건 batch update 완료", existingMembers.size());
    }

    @Override
    @Transactional
    public void bulkDeleteMembers(List<Long> deleteMemberIds) {
        if (deleteMemberIds == null || deleteMemberIds.isEmpty()) {
            return;
        }
        memberRepository.deleteAllById(deleteMemberIds);
        log.info("[조직도 동기화] 기존 멤버 {}건 batch delete 완료", deleteMemberIds.size());
    }

    // ========== Common ==========

    private <T> void bulkChanges(List<T> modifiedDtos,
                                 Consumer<List<T>> insertAction,
                                 Consumer<List<T>> updateAction,
                                 Consumer<List<Long>> deleteAction) {
        List<T> toInsert = new ArrayList<>();
        List<T> toUpdate = new ArrayList<>();
        List<Long> toDelete = new ArrayList<>();

        for (T dto : modifiedDtos) {
            if (dto instanceof OrgOrganizationCodeDto orgDto) {
                if (orgDto.isNewTarget()) {
                    toInsert.add(dto);
                } else if (orgDto.isDeleteTarget()) {
                    toDelete.add(orgDto.getId());
                } else {
                    toUpdate.add(dto);
                }
            } else if (dto instanceof OrgDepartmentDto deptDto) {
                if (deptDto.isNewTarget()) {
                    toInsert.add(dto);
                } else if (deptDto.isDeleteTarget()) {
                    toDelete.add(deptDto.getId());
                } else {
                    toUpdate.add(dto);
                }
            } else if (dto instanceof OrgUserDto userDto) {
                if (userDto.isNewTarget()) {
                    toInsert.add(dto);
                } else if (userDto.isDeleteTarget()) {
                    toDelete.add(userDto.getId());
                } else {
                    toUpdate.add(dto);
                }
            } else if (dto instanceof OrgMemberDto memberDto) {
                if (memberDto.isNewTarget()) {
                    toInsert.add(dto);
                } else if (memberDto.isDeleteTarget()) {
                    toDelete.add(memberDto.getId());
                } else {
                    toUpdate.add(dto);
                }
            }
        }

        if (!toInsert.isEmpty()) insertAction.accept(toInsert);
        if (!toUpdate.isEmpty()) updateAction.accept(toUpdate);
        if (!toDelete.isEmpty()) deleteAction.accept(toDelete);
    }
}
