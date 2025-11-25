package com.daou.dop.allapps.doserver.provisionprocessor.config;

import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@Configuration
@EnableJpaAuditing
@EnableJpaRepositories(basePackages = "com.daou.dop.allapps.doserver.persistence.repository")
@EntityScan(basePackages = "com.daou.dop.allapps.doserver.persistence.entity")
public class JpaConfig {
}
