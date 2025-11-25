-- organization_code 테이블 생성
CREATE TABLE IF NOT EXISTS organization_code (
    id BIGINT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    name VARCHAR(255),
    code VARCHAR(100),
    type VARCHAR(50),
    sort_order INT DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx1_organization_code ON organization_code (company_id);
CREATE INDEX IF NOT EXISTS idx2_organization_code ON organization_code (company_id, type);

-- department 테이블 생성
CREATE TABLE IF NOT EXISTS department (
    id BIGINT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    name VARCHAR(255),
    parent_id BIGINT,
    code VARCHAR(100),
    alias VARCHAR(255),
    email VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    sort_order INT DEFAULT 1,
    department_path VARCHAR(1024),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx1_department ON department (company_id);
CREATE INDEX IF NOT EXISTS idx2_department ON department (parent_id);
CREATE INDEX IF NOT EXISTS idx3_department ON department (status);
CREATE INDEX IF NOT EXISTS idx4_department ON department (company_id, status);

-- user 테이블 생성
CREATE TABLE IF NOT EXISTS "user" (
    id BIGINT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    name VARCHAR(63),
    login_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
    locale VARCHAR(10),
    employee_number VARCHAR(100),
    mobile_number VARCHAR(50),
    profile_image_path VARCHAR(1024),
    grade_code_id BIGINT,
    position_code_id BIGINT,
    dormant_at TIMESTAMP,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx1_user ON "user" (company_id);
CREATE INDEX IF NOT EXISTS idx2_user ON "user" (login_id);
CREATE INDEX IF NOT EXISTS idx3_user ON "user" (status);
CREATE INDEX IF NOT EXISTS idx4_user ON "user" (company_id, status);

-- member 테이블 생성
CREATE TABLE IF NOT EXISTS member (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    department_id BIGINT NOT NULL,
    duty_code_id BIGINT,
    member_type VARCHAR(50) DEFAULT 'TEAM_MEMBER',
    sort_order INT DEFAULT 1,
    department_order INT DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx1_member ON member (user_id);
CREATE INDEX IF NOT EXISTS idx2_member ON member (department_id);
CREATE INDEX IF NOT EXISTS idx3_member ON member (user_id, department_id);

-- 외래 키 제약 조건 추가 (선택 사항)
-- ALTER TABLE department ADD CONSTRAINT fk_department_parent FOREIGN KEY (parent_id) REFERENCES department(id);
-- ALTER TABLE "user" ADD CONSTRAINT fk_user_grade_code FOREIGN KEY (grade_code_id) REFERENCES organization_code(id);
-- ALTER TABLE "user" ADD CONSTRAINT fk_user_position_code FOREIGN KEY (position_code_id) REFERENCES organization_code(id);
-- ALTER TABLE member ADD CONSTRAINT fk_member_user FOREIGN KEY (user_id) REFERENCES "user"(id);
-- ALTER TABLE member ADD CONSTRAINT fk_member_department FOREIGN KEY (department_id) REFERENCES department(id);
-- ALTER TABLE member ADD CONSTRAINT fk_member_duty_code FOREIGN KEY (duty_code_id) REFERENCES organization_code(id);
