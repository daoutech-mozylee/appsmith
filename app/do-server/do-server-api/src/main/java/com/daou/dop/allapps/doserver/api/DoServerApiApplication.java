package com.daou.dop.allapps.doserver.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;

@SpringBootApplication(
    scanBasePackages = "com.daou.dop.allapps.doserver",
    exclude = {SecurityAutoConfiguration.class}
)
public class DoServerApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(DoServerApiApplication.class, args);
    }

}
