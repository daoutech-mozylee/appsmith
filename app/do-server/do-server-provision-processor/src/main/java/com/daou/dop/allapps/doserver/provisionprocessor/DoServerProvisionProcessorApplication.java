package com.daou.dop.allapps.doserver.provisionprocessor;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = {
    "com.daou.dop.allapps.doserver.provision",
    "com.daou.dop.allapps.doserver.persistence",
    "com.daou.dop.allapps.doserver.internal",
    "com.daou.dop.allapps.doserver.provisionprocessor"
})
public class DoServerProvisionProcessorApplication {

    public static void main(String[] args) {
        SpringApplication.run(DoServerProvisionProcessorApplication.class, args);
    }
}
