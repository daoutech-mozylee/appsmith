package com.daou.allapps.controller;

import com.daou.allapps.dto.module.ModuleUploadResponseDto;
import com.daou.allapps.dto.module.ValidationResult;
import com.daou.allapps.service.ModuleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * 모듈 업로드 및 프록시 API 컨트롤러
 *
 * 중계서버의 모듈 관련 API 엔드포인트를 제공합니다.
 *
 * Endpoints:
 * - POST /relay/api/modules/upload : 모듈 JSON 파일 업로드
 * - POST /relay/api/modules/validate : 스키마 검증만 수행
 * - GET /relay/api/modules : 모듈 목록 조회 (프록시)
 * - GET /relay/api/modules/{uuid} : 모듈 상세 조회 (프록시)
 * - DELETE /relay/api/modules/{uuid} : 모듈 비활성화 (프록시)
 */
@Slf4j
@RestController
@RequestMapping("/api/modules")
@RequiredArgsConstructor
public class ModuleController {

    private final ModuleService moduleService;

    /**
     * 모듈 JSON 파일 업로드
     *
     * multipart/form-data 형식으로 JSON 파일을 업로드합니다.
     *
     * @param file      모듈 JSON 파일
     * @param version   버전 (선택)
     * @param changeLog 변경 이력 (선택)
     * @return 업로드 결과
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ModuleUploadResponseDto> uploadModule(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "version", required = false) String version,
            @RequestParam(value = "changeLog", required = false) String changeLog) {

        log.info("Module upload request: filename={}, size={}, version={}",
                file.getOriginalFilename(), file.getSize(), version);

        // 파일 유효성 검사
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(
                    ModuleUploadResponseDto.failure("File is empty", ValidationResult.failure(List.of("No file provided"))));
        }

        // Content-Type 검사
        String contentType = file.getContentType();
        if (contentType != null && !contentType.contains("json")) {
            log.warn("Invalid content type: {}", contentType);
            // 경고만 로그, 확장자로 판단
        }

        // 확장자 검사
        String filename = file.getOriginalFilename();
        if (filename != null && !filename.toLowerCase().endsWith(".json")) {
            return ResponseEntity.badRequest().body(
                    ModuleUploadResponseDto.failure("Only JSON files are allowed",
                            ValidationResult.failure(List.of("Invalid file extension"))));
        }

        ModuleUploadResponseDto response = moduleService.uploadModule(file, version, changeLog);

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * 모듈 JSON 스키마 검증만 수행
     *
     * 실제 업로드 없이 스키마 검증만 수행합니다.
     *
     * @param file 모듈 JSON 파일
     * @return 검증 결과
     */
    @PostMapping(value = "/validate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ValidationResult> validateModule(
            @RequestParam("file") MultipartFile file) {

        log.info("Module validation request: filename={}", file.getOriginalFilename());

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(
                    ValidationResult.failure(List.of("No file provided")));
        }

        ValidationResult result = moduleService.validateModule(file);

        if (result.isValid()) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(result);
        }
    }

    /**
     * 모듈 목록 조회 (프록시)
     *
     * Appsmith 서버의 모듈 목록을 프록시합니다.
     *
     * @return 모듈 목록
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getModules() {
        log.debug("Get modules request");
        try {
            List<Map<String, Object>> modules = moduleService.getModules();
            return ResponseEntity.ok(modules);
        } catch (Exception e) {
            log.error("Failed to get modules", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 모듈 상세 조회 (프록시)
     *
     * Appsmith 서버의 모듈 상세를 프록시합니다.
     *
     * @param uuid 모듈 UUID
     * @return 모듈 상세
     */
    @GetMapping("/{uuid}")
    public ResponseEntity<Map<String, Object>> getModule(@PathVariable String uuid) {
        log.debug("Get module request: uuid={}", uuid);
        try {
            Map<String, Object> module = moduleService.getModule(uuid);
            if (module == null) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(module);
        } catch (Exception e) {
            log.error("Failed to get module: {}", uuid, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 모듈 비활성화 (프록시)
     *
     * Appsmith 서버에 모듈 비활성화 요청을 프록시합니다.
     *
     * @param uuid 모듈 UUID
     * @return 성공 응답
     */
    @DeleteMapping("/{uuid}")
    public ResponseEntity<Void> deleteModule(@PathVariable String uuid) {
        log.info("Delete module request: uuid={}", uuid);
        try {
            moduleService.deleteModule(uuid);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Failed to delete module: {}", uuid, e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
