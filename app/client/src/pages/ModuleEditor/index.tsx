import React, { useCallback, useEffect } from "react";
import type { RouteComponentProps } from "react-router";
import PageWrapper from "pages/common/PageWrapper";
import { Button, Spinner, Text, toast } from "@appsmith/ads";
import { useDispatch, useSelector } from "react-redux";
import { fetchModule, saveModule } from "ee/actions/moduleActions";
import {
  getIsModuleEditorLoading,
  getModuleEditorError,
  getModuleEditorModule,
  getIsModuleSaving,
} from "ee/selectors/modulesSelector";
import WidgetsEditor from "pages/Editor/WidgetsEditor";
import GlobalHotKeys from "pages/Editor/GlobalHotKeys";
import { editorInitializer } from "utils/editor/EditorUtils";
import { widgetInitialisationSuccess } from "actions/widgetActions";
import { resetEditorRequest } from "actions/initActions";
import styled from "styled-components";
import {
  getCurrentPageId,
  getIsWidgetConfigBuilt,
} from "selectors/editorSelectors";
import store from "store";
import { fetchAllPageEntityCompletion } from "actions/pageActions";
import { ReduxActionTypes } from "ee/constants/ReduxActionConstants";

type ModuleEditorRouteParams = {
  moduleId: string;
};

const PlaceholderContainer = ({ children }: React.PropsWithChildren) => (
  <div className="flex flex-col items-center justify-center w-full h-full py-20">
    {children}
  </div>
);

const EditorShell = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const ModuleEditorToolbar = styled.div`
  padding: 16px 24px;
  border-bottom: 1px solid var(--ads-v2-color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--ads-v2-color-bg);
`;

const EditorBody = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

function ModuleEditorPage({
  match,
}: RouteComponentProps<ModuleEditorRouteParams>) {
  const moduleId = match.params.moduleId;
  const dispatch = useDispatch();
  const isLoading = useSelector(getIsModuleEditorLoading);
  const moduleData = useSelector(getModuleEditorModule);
  const error = useSelector(getModuleEditorError);
  const isSaving = useSelector(getIsModuleSaving);
  const isWidgetConfigBuilt = useSelector(getIsWidgetConfigBuilt);
  const currentPageId = useSelector(getCurrentPageId);

  useEffect(() => {
    let isMounted = true;

    editorInitializer()
      .then(() => {
        if (!isMounted) {
          return;
        }
        dispatch(widgetInitialisationSuccess());
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error("Failed to initialize module editor", error);
      });

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  useEffect(() => {
    if (moduleId && isWidgetConfigBuilt) {
      dispatch(fetchModule(moduleId));
    }
  }, [dispatch, moduleId, isWidgetConfigBuilt]);

  // 모듈 편집 초기 평가 플로우: 페이지와 동일하게 첫 평가를 트리거
  useEffect(() => {
    if (moduleData && isWidgetConfigBuilt) {
      dispatch(
        fetchAllPageEntityCompletion([
          // 페이지 로드시 실행과 동일한 액션 호출
          // 실제 온로드 액션은 없지만 평가 파이프라인을 시작시키기 위함
          { type: ReduxActionTypes.EXECUTE_PAGE_LOAD_ACTIONS, payload: {} },
        ]),
      );
      dispatch({ type: ReduxActionTypes.TRIGGER_EVAL });
    }
  }, [dispatch, moduleData, isWidgetConfigBuilt]);

  useEffect(() => {
    // 개발 시 상태 확인 편의를 위해 window.store 에 주입
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (window as any).store = store;

    const state = store.getState();
    const widgets = state.entities?.canvasWidgets || {};
    const rootId =
      state.ui?.editor?.pageWidgetId ||
      state.entities?.pageList?.currentPageId ||
      "0";
    const root = widgets[rootId];
    const childTypes = (root?.children || []).map(
      (id: string) => widgets[id]?.type,
    );
    // eslint-disable-next-line no-console
    console.log("ModuleEditor widget debug", {
      rootId,
      rootType: root?.type,
      rootChildren: root?.children,
      childTypes,
    });
  }, [moduleData, isWidgetConfigBuilt]);

  const handleSave = useCallback(() => {
    if (!moduleId) {
      return;
    }

    dispatch(
      saveModule({
        moduleId,
        data: { unpublishedModule: {} },
        onSuccess: () =>
          toast.show("Module saved successfully", { kind: "success" }),
        onError: () => toast.show("Failed to save module", { kind: "error" }),
      }),
    );
  }, [dispatch, moduleId]);

  const content = (() => {
    if (error) {
      return (
        <>
          <Text className="!mb-2" kind="heading-m">
            Failed to load module
          </Text>
          <Text kind="body-m">{error}</Text>
        </>
      );
    }

    if (isLoading || !moduleData || !isWidgetConfigBuilt) {
      return (
        <>
          <Spinner size="lg" />
          <Text className="!mt-4" kind="body-m">
            Loading module…
          </Text>
        </>
      );
    }

    return (
      <EditorShell>
        <ModuleEditorToolbar>
          <Text kind="heading-s">
            {moduleData?.unpublishedModule?.name ||
              moduleData?.publishedModule?.name ||
              "Untitled module"}
          </Text>
          <Button
            className="t--module-save-button"
            isLoading={isSaving}
            kind="primary"
            onClick={handleSave}
            size="md"
            isDisabled={isSaving}
          >
            Save module
          </Button>
        </ModuleEditorToolbar>
        <EditorBody>
          <WidgetsEditor />
          <GlobalHotKeys />
        </EditorBody>
      </EditorShell>
    );
  })();

  const shouldShowPlaceholder =
    isLoading || !moduleData || !isWidgetConfigBuilt || !!error;

  return (
    <PageWrapper displayName="ModuleEditor">
      {process.env.NODE_ENV !== "production" && (
        <Text className="!mb-2" kind="body-s">
          Debug: currentPageId={currentPageId}
        </Text>
      )}
      {shouldShowPlaceholder ? (
        <PlaceholderContainer>{content}</PlaceholderContainer>
      ) : (
        content
      )}
    </PageWrapper>
  );
}

export default ModuleEditorPage;
