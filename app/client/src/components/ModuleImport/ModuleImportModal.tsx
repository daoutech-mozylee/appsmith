/**
 * Module Import Modal
 *
 * JSON 파일을 업로드하여 모듈을 추가/업데이트하는 모달입니다.
 *
 * @example
 * ```tsx
 * <ModuleImportModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   onSuccess={() => refreshModules()}
 * />
 * ```
 */

import React, { useState, useCallback, useRef } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalFooter,
  Callout,
  Text,
} from "@appsmith/ads";
import styled from "styled-components";
import ModuleImportApi from "api/ModuleImportApi";
import type { ModuleUploadResponse } from "api/ModuleImportApi";

interface ModuleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (response: ModuleUploadResponse) => void;
}

const UploadArea = styled.div<{ isDragOver: boolean }>`
  border: 2px dashed
    ${({ isDragOver }) =>
      isDragOver
        ? "var(--ads-v2-color-border-brand)"
        : "var(--ads-v2-color-border)"};
  border-radius: var(--ads-v2-border-radius);
  padding: 32px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: ${({ isDragOver }) =>
    isDragOver ? "var(--ads-v2-color-bg-subtle)" : "transparent"};

  &:hover {
    border-color: var(--ads-v2-color-border-brand);
    background-color: var(--ads-v2-color-bg-subtle);
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

const FileName = styled.div`
  margin-top: 12px;
  padding: 8px 12px;
  background-color: var(--ads-v2-color-bg-subtle);
  border-radius: var(--ads-v2-border-radius);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ValidationList = styled.ul`
  margin: 8px 0;
  padding-left: 20px;
  list-style: disc;

  li {
    margin: 4px 0;
    font-size: 12px;
  }
`;

const ModalContentStyled = styled(ModalContent)`
  width: 500px;
`;

const SubText = styled(Text)`
  color: var(--ads-v2-color-fg-muted);
  margin-top: 8px;
`;

const ResultContainer = styled.div`
  margin-top: 16px;
`;

const WarningCallout = styled(Callout)`
  margin-top: 8px;
`;

const ModuleImportModal: React.FC<ModuleImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ModuleUploadResponse | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (file && file.type === "application/json") {
        setSelectedFile(file);
        setUploadResult(null);
      }
    },
    [],
  );

  // 드래그 앤 드롭 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];

    if (file && file.type === "application/json") {
      setSelectedFile(file);
      setUploadResult(null);
    }
  }, []);

  // 업로드 클릭 핸들러
  const handleUploadAreaClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 파일 제거 핸들러
  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setUploadResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // 업로드 핸들러
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const result = await ModuleImportApi.uploadModule(selectedFile, {
        changeLog: "Imported via UI",
      });

      setUploadResult(result);

      if (result.success) {
        onSuccess?.(result);
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, onSuccess]);

  // 모달 닫기 핸들러
  const handleClose = useCallback(() => {
    setSelectedFile(null);
    setUploadResult(null);
    setIsDragOver(false);
    onClose();
  }, [onClose]);

  return (
    <Modal onOpenChange={handleClose} open={isOpen}>
      <ModalContentStyled>
        <ModalHeader>Import Module</ModalHeader>
        <ModalBody>
          {/* 업로드 영역 */}
          <UploadArea
            isDragOver={isDragOver}
            onClick={handleUploadAreaClick}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <Text kind="body-m">
              Drag & drop a JSON file here, or click to select
            </Text>
            <SubText kind="body-s">
              Supported: Appsmith Package Export (.json)
            </SubText>
          </UploadArea>

          <HiddenInput
            accept=".json,application/json"
            onChange={handleFileSelect}
            ref={fileInputRef}
            type="file"
          />

          {/* 선택된 파일 표시 */}
          {selectedFile && (
            <FileName>
              <Text kind="body-s">{selectedFile.name}</Text>
              <Button
                kind="tertiary"
                onClick={handleRemoveFile}
                size="sm"
                startIcon="close"
              />
            </FileName>
          )}

          {/* 업로드 결과 표시 */}
          {uploadResult && (
            <ResultContainer>
              {uploadResult.success ? (
                <Callout kind="success">
                  <Text kind="body-s">
                    Module uploaded successfully!
                    {uploadResult.moduleInfo && (
                      <>
                        <br />
                        <strong>{uploadResult.moduleInfo.moduleName}</strong> v
                        {uploadResult.moduleInfo.version}
                      </>
                    )}
                  </Text>
                </Callout>
              ) : (
                <Callout kind="error">
                  <Text kind="body-s">
                    {uploadResult.message || "Upload failed"}
                  </Text>
                  {uploadResult.validation?.errors &&
                    uploadResult.validation.errors.length > 0 && (
                      <ValidationList>
                        {uploadResult.validation.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ValidationList>
                    )}
                </Callout>
              )}

              {/* 경고 메시지 */}
              {uploadResult.validation?.warnings &&
                uploadResult.validation.warnings.length > 0 && (
                  <WarningCallout kind="warning">
                    <Text kind="body-s">Warnings:</Text>
                    <ValidationList>
                      {uploadResult.validation.warnings.map(
                        (warning, index) => (
                          <li key={index}>{warning}</li>
                        ),
                      )}
                    </ValidationList>
                  </WarningCallout>
                )}
            </ResultContainer>
          )}
        </ModalBody>

        <ModalFooter>
          <Button kind="secondary" onClick={handleClose} size="md">
            {uploadResult?.success ? "Close" : "Cancel"}
          </Button>
          {!uploadResult?.success && (
            <Button
              isDisabled={!selectedFile || isUploading}
              isLoading={isUploading}
              kind="primary"
              onClick={handleUpload}
              size="md"
            >
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          )}
        </ModalFooter>
      </ModalContentStyled>
    </Modal>
  );
};

export default ModuleImportModal;
