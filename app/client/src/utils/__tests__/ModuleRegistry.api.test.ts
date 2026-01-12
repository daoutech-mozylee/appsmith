import { ModuleRegistry } from "utils/ModuleRegistry";
import type {
  ModuleDefinition,
  PartialModuleDefinition,
} from "utils/ModuleRegistry";
import ModuleApi from "api/ModuleApi";

// Mock ModuleApi
jest.mock("api/ModuleApi", () => ({
  __esModule: true,
  default: {
    fetchModules: jest.fn(),
    fetchModuleDetail: jest.fn(),
  },
}));

describe("ModuleRegistry API Integration", () => {
  const mockModuleUUID = "test-uuid-1";
  const mockPackageUUID = "package-uuid-1";

  const mockModuleListItem = {
    moduleUUID: mockModuleUUID,
    packageUUID: mockPackageUUID,
    moduleName: "TestModule",
    packageName: "TestPackage",
    version: "1.0.0",
    meta: {
      icon: "icon-test",
      color: "#FF0000",
    },
  };

  const mockModuleDetail = {
    ...mockModuleListItem,
    definition: {
      layouts: {
        dsl: {
          widgetName: "Canvas",
          type: "CANVAS_WIDGET",
          children: [
            {
              widgetName: "Button1",
              type: "BUTTON_WIDGET",
              bottomRow: 10,
            },
          ],
        },
      },
      inputsForm: [
        {
          sectionName: "Inputs",
          children: [
            {
              label: "Input1",
              propertyName: "inputs.input1",
              defaultValue: "default",
            },
          ],
        },
      ],
      outputsForm: [],
      actionList: [],
      actionCollectionList: [],
    },
  };

  beforeEach(() => {
    // 각 테스트 전에 레지스트리 초기화
    ModuleRegistry.clear();
    jest.clearAllMocks();
  });

  describe("initFromApi", () => {
    it("should load modules from API successfully", async () => {
      const mockResponse = {
        data: {
          data: [mockModuleListItem],
        },
      };

      (ModuleApi.fetchModules as jest.Mock).mockResolvedValue(mockResponse);

      await ModuleRegistry.initFromApi();

      // API가 호출되었는지 확인
      expect(ModuleApi.fetchModules).toHaveBeenCalled();

      // API 초기화 상태 확인
      expect(ModuleRegistry.isApiInitialized()).toBe(true);

      // partial 모듈이 등록되었는지 확인
      expect(ModuleRegistry.isPartial(mockModuleUUID)).toBe(true);

      // getAllPartial로 조회 가능한지 확인
      const allModules = ModuleRegistry.getAllPartial();

      expect(allModules).toHaveLength(1);
      expect(allModules[0].moduleUUID).toBe(mockModuleUUID);
    });

    it("should not call API if already initialized", async () => {
      const mockResponse = {
        data: {
          data: [mockModuleListItem],
        },
      };

      (ModuleApi.fetchModules as jest.Mock).mockResolvedValue(mockResponse);

      // 첫 번째 호출
      await ModuleRegistry.initFromApi();

      // 두 번째 호출
      await ModuleRegistry.initFromApi();

      // API는 한 번만 호출되어야 함
      expect(ModuleApi.fetchModules).toHaveBeenCalledTimes(1);
    });

    it("should handle API failure gracefully", async () => {
      (ModuleApi.fetchModules as jest.Mock).mockRejectedValue(
        new Error("Network error"),
      );

      // API 실패해도 에러를 던지지 않음
      await expect(ModuleRegistry.initFromApi()).resolves.not.toThrow();

      // 초기화되지 않음 (재시도 가능)
      expect(ModuleRegistry.isApiInitialized()).toBe(false);
    });

    it("should handle concurrent calls correctly", async () => {
      const mockResponse = {
        data: {
          data: [mockModuleListItem],
        },
      };

      // 약간의 지연 추가
      (ModuleApi.fetchModules as jest.Mock).mockImplementation(
        async () =>
          new Promise((resolve) => setTimeout(() => resolve(mockResponse), 10)),
      );

      // 동시에 여러 번 호출
      const promises = [
        ModuleRegistry.initFromApi(),
        ModuleRegistry.initFromApi(),
        ModuleRegistry.initFromApi(),
      ];

      await Promise.all(promises);

      // API는 한 번만 호출되어야 함
      expect(ModuleApi.fetchModules).toHaveBeenCalledTimes(1);
    });
  });

  describe("getAsync", () => {
    it("should return cached module immediately", async () => {
      // 미리 full definition 등록
      const fullDefinition: ModuleDefinition = {
        moduleUUID: mockModuleUUID,
        packageUUID: mockPackageUUID,
        moduleName: "TestModule",
        packageName: "TestPackage",
        icon: "icon-test",
        color: "#FF0000",
        inputsForm: [],
        outputsForm: [],
        dsl: { widgetName: "Canvas", type: "CANVAS_WIDGET" },
        actions: [],
        actionCollections: [],
        originalSize: { columns: 64, rows: 40 },
      };

      ModuleRegistry.register(fullDefinition);

      const result = await ModuleRegistry.getAsync(mockModuleUUID);

      // API가 호출되지 않아야 함
      expect(ModuleApi.fetchModuleDetail).not.toHaveBeenCalled();

      // 캐시된 결과 반환
      expect(result).toEqual(fullDefinition);
    });

    it("should fetch from API if not cached", async () => {
      const mockResponse = {
        data: {
          data: mockModuleDetail,
        },
      };

      (ModuleApi.fetchModuleDetail as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      const result = await ModuleRegistry.getAsync(mockModuleUUID);

      // API가 호출되어야 함
      expect(ModuleApi.fetchModuleDetail).toHaveBeenCalledWith(mockModuleUUID);

      // 결과 검증
      expect(result).toBeDefined();
      expect(result?.moduleUUID).toBe(mockModuleUUID);
      expect(result?.inputsForm).toBeDefined();
      expect(result?.dsl).toBeDefined();
    });

    it("should convert API response to ModuleDefinition correctly", async () => {
      const mockResponse = {
        data: {
          data: mockModuleDetail,
        },
      };

      (ModuleApi.fetchModuleDetail as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      const result = await ModuleRegistry.getAsync(mockModuleUUID);

      // 변환된 필드 검증
      expect(result?.moduleUUID).toBe(mockModuleUUID);
      expect(result?.packageUUID).toBe(mockPackageUUID);
      expect(result?.moduleName).toBe("TestModule");
      expect(result?.icon).toBe("icon-test");
      expect(result?.color).toBe("#FF0000");
      expect(result?.inputsForm).toHaveLength(1);
      expect(result?.dsl.widgetName).toBe("Canvas");
      expect(result?.originalSize).toBeDefined();
      expect(result?.originalSize.rows).toBe(10); // Button1의 bottomRow
    });

    it("should handle API failure", async () => {
      (ModuleApi.fetchModuleDetail as jest.Mock).mockRejectedValue(
        new Error("Not found"),
      );

      const result = await ModuleRegistry.getAsync("non-existent-uuid");

      expect(result).toBeUndefined();
    });

    it("should cache result after fetching from API", async () => {
      const mockResponse = {
        data: {
          data: mockModuleDetail,
        },
      };

      (ModuleApi.fetchModuleDetail as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      // 첫 번째 호출
      await ModuleRegistry.getAsync(mockModuleUUID);

      // 두 번째 호출
      await ModuleRegistry.getAsync(mockModuleUUID);

      // API는 한 번만 호출되어야 함
      expect(ModuleApi.fetchModuleDetail).toHaveBeenCalledTimes(1);

      // 이제 동기 get으로도 조회 가능
      const syncResult = ModuleRegistry.get(mockModuleUUID);

      expect(syncResult).toBeDefined();
    });

    it("should handle concurrent calls for same module", async () => {
      const mockResponse = {
        data: {
          data: mockModuleDetail,
        },
      };

      // 약간의 지연 추가
      (ModuleApi.fetchModuleDetail as jest.Mock).mockImplementation(
        async () =>
          new Promise((resolve) => setTimeout(() => resolve(mockResponse), 10)),
      );

      // 동시에 같은 모듈 요청
      const promises = [
        ModuleRegistry.getAsync(mockModuleUUID),
        ModuleRegistry.getAsync(mockModuleUUID),
        ModuleRegistry.getAsync(mockModuleUUID),
      ];

      const results = await Promise.all(promises);

      // API는 한 번만 호출되어야 함
      expect(ModuleApi.fetchModuleDetail).toHaveBeenCalledTimes(1);

      // 모든 결과가 동일해야 함
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });
  });

  describe("registerLazy", () => {
    it("should register partial module", () => {
      ModuleRegistry.registerLazy(mockModuleListItem);

      expect(ModuleRegistry.isPartial(mockModuleUUID)).toBe(true);

      const allPartial = ModuleRegistry.getAllPartial();

      expect(allPartial).toHaveLength(1);
      expect((allPartial[0] as PartialModuleDefinition)._isPartial).toBe(true);
    });

    it("should not overwrite full definition with partial", () => {
      // 먼저 full definition 등록
      const fullDefinition: ModuleDefinition = {
        moduleUUID: mockModuleUUID,
        packageUUID: mockPackageUUID,
        moduleName: "TestModule",
        packageName: "TestPackage",
        inputsForm: [],
        outputsForm: [],
        dsl: { widgetName: "Canvas", type: "CANVAS_WIDGET" },
        actions: [],
        actionCollections: [],
        originalSize: { columns: 64, rows: 40 },
      };

      ModuleRegistry.register(fullDefinition);

      // partial 등록 시도
      ModuleRegistry.registerLazy(mockModuleListItem);

      // full definition이 유지되어야 함
      expect(ModuleRegistry.isPartial(mockModuleUUID)).toBe(false);

      const result = ModuleRegistry.get(mockModuleUUID);

      expect(result).toEqual(fullDefinition);
    });
  });

  describe("getAllPartial", () => {
    it("should return both full and partial modules", () => {
      // full definition 등록
      const fullDefinition: ModuleDefinition = {
        moduleUUID: "full-uuid",
        packageUUID: "package-uuid",
        moduleName: "FullModule",
        packageName: "TestPackage",
        inputsForm: [],
        outputsForm: [],
        dsl: { widgetName: "Canvas", type: "CANVAS_WIDGET" },
        actions: [],
        actionCollections: [],
        originalSize: { columns: 64, rows: 40 },
      };

      ModuleRegistry.register(fullDefinition);

      // partial 등록
      ModuleRegistry.registerLazy(mockModuleListItem);

      const allModules = ModuleRegistry.getAllPartial();

      expect(allModules).toHaveLength(2);

      // full 모듈 확인
      const fullModule = allModules.find((m) => m.moduleUUID === "full-uuid");

      expect(fullModule).toBeDefined();
      expect("_isPartial" in fullModule!).toBe(false);

      // partial 모듈 확인
      const partialModule = allModules.find(
        (m) => m.moduleUUID === mockModuleUUID,
      );

      expect(partialModule).toBeDefined();
      expect((partialModule as PartialModuleDefinition)._isPartial).toBe(true);
    });
  });

  describe("fallback behavior", () => {
    it("should use preloaded modules when API fails", async () => {
      // 미리 preloaded 모듈 등록 (빌드 시점 시뮬레이션)
      const preloadedDefinition: ModuleDefinition = {
        moduleUUID: "preloaded-uuid",
        packageUUID: "package-uuid",
        moduleName: "PreloadedModule",
        packageName: "TestPackage",
        inputsForm: [],
        outputsForm: [],
        dsl: { widgetName: "Canvas", type: "CANVAS_WIDGET" },
        actions: [],
        actionCollections: [],
        originalSize: { columns: 64, rows: 40 },
      };

      ModuleRegistry.register(preloadedDefinition);

      // API 실패 모킹
      (ModuleApi.fetchModules as jest.Mock).mockRejectedValue(
        new Error("Network error"),
      );

      // API 초기화 시도 (실패)
      await ModuleRegistry.initFromApi();

      // preloaded 모듈은 여전히 사용 가능
      const result = ModuleRegistry.get("preloaded-uuid");

      expect(result).toEqual(preloadedDefinition);
    });
  });
});
