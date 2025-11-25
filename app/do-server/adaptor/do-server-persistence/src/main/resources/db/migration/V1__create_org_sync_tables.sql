-- org_sync_event_message 테이블 생성
CREATE TABLE IF NOT EXISTS org_sync_event_message (
    id BIGSERIAL PRIMARY KEY,
    company_uuid VARCHAR(255) NOT NULL,
    log_seq BIGINT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk1_org_sync_event_msg UNIQUE (company_uuid, log_seq)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx1_org_sync_event_msg ON org_sync_event_message (status);
CREATE INDEX IF NOT EXISTS idx2_org_sync_event_msg ON org_sync_event_message (company_uuid, status);
CREATE INDEX IF NOT EXISTS idx3_org_sync_event_msg ON org_sync_event_message (company_uuid, status, log_seq);
CREATE INDEX IF NOT EXISTS idx4_org_sync_event_msg ON org_sync_event_message (status, company_uuid, updated_at);

-- org_sync_company_lock 테이블 생성
CREATE TABLE IF NOT EXISTS org_sync_company_lock (
    company_uuid VARCHAR(255) PRIMARY KEY,
    locked_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- org_sync_failed_event_log 테이블 생성
CREATE TABLE IF NOT EXISTS org_sync_failed_event_log (
    id BIGSERIAL PRIMARY KEY,
    company_uuid VARCHAR(255) NOT NULL,
    log_seq BIGINT,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx1_org_sync_failed_event_log ON org_sync_failed_event_log (created_at);
CREATE INDEX IF NOT EXISTS idx2_org_sync_failed_event_log ON org_sync_failed_event_log (company_uuid);
