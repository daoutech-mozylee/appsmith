package com.daou.dop.allapps.doserver.persistence.repository.organization;

import com.daou.dop.allapps.doserver.domain.type.UserStatus;
import com.daou.dop.allapps.doserver.persistence.entity.organization.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    List<User> findByCompanyId(Long companyId);

    List<User> findByCompanyIdAndStatus(Long companyId, UserStatus status);

    Optional<User> findByCompanyIdAndLoginId(Long companyId, String loginId);

    @Query("SELECT u.id FROM User u WHERE u.companyId = :companyId AND u.id IN :ids")
    List<Long> findExistingIdsByCompanyIdAndIds(@Param("companyId") Long companyId, @Param("ids") List<Long> ids);

    @Query("SELECT u.id FROM User u WHERE u.companyId = :companyId")
    List<Long> findAllIdsByCompanyId(@Param("companyId") Long companyId);
}
