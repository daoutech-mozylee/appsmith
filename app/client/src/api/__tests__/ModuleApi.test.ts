import ModuleApi from "api/ModuleApi";
import Api from "api/Api";
import type { UIModuleListItem, UIModuleDetail } from "api/ModuleApi";

// Mock the Api module with a class that can be extended
jest.mock("api/Api", () => {
  return {
    __esModule: true,
    default: class MockApi {
      static get: jest.Mock = jest.fn();
    },
  };
});

describe("ModuleApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchModules", () => {
    it("should call the correct API endpoint", async () => {
      // Setup mock API response
      const mockModules: UIModuleListItem[] = [
        {
          moduleUUID: "test-uuid-1",
          packageUUID: "package-uuid-1",
          moduleName: "TestModule1",
          packageName: "TestPackage",
          version: "1.0.0",
          meta: {
            icon: "icon-test",
            color: "#FF0000",
          },
        },
        {
          moduleUUID: "test-uuid-2",
          packageUUID: "package-uuid-2",
          moduleName: "TestModule2",
          packageName: "TestPackage",
          version: "1.0.1",
        },
      ];

      const mockResponse = {
        data: {
          responseMeta: {
            success: true,
            status: 200,
          },
          data: mockModules,
        },
      };

      (Api.get as jest.Mock).mockResolvedValue(mockResponse);

      // Call the function
      const result = await ModuleApi.fetchModules();

      // Verify API was called correctly
      expect(Api.get).toHaveBeenCalledWith(ModuleApi.url);

      // Verify response matches mock
      expect(result).toEqual(mockResponse);
      expect(result.data.data).toHaveLength(2);
      expect(result.data.data[0].moduleUUID).toBe("test-uuid-1");
    });

    it("should handle API errors", async () => {
      // Setup mock API to throw error
      const mockError = new Error("API error");

      (Api.get as jest.Mock).mockRejectedValue(mockError);

      // Call the function and expect it to throw
      await expect(ModuleApi.fetchModules()).rejects.toThrow(mockError);

      // Verify API was called
      expect(Api.get).toHaveBeenCalledWith(ModuleApi.url);
    });

    it("should handle empty module list", async () => {
      const mockResponse = {
        data: {
          responseMeta: {
            success: true,
            status: 200,
          },
          data: [],
        },
      };

      (Api.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ModuleApi.fetchModules();

      expect(result.data.data).toHaveLength(0);
    });
  });

  describe("fetchModuleDetail", () => {
    it("should call the correct API endpoint with moduleUUID", async () => {
      const moduleUUID = "test-uuid-1";

      // Setup mock API response
      const mockDetail: UIModuleDetail = {
        moduleUUID,
        packageUUID: "package-uuid-1",
        moduleName: "TestModule",
        packageName: "TestPackage",
        version: "1.0.0",
        meta: {
          icon: "icon-test",
          color: "#FF0000",
          description: "Test module description",
        },
        definition: {
          layouts: {
            dsl: {
              widgetName: "Canvas",
              type: "CANVAS_WIDGET",
              children: [],
            },
          },
          inputsForm: [],
          outputsForm: [],
          actionList: [],
          actionCollectionList: [],
        },
      };

      const mockResponse = {
        data: {
          responseMeta: {
            success: true,
            status: 200,
          },
          data: mockDetail,
        },
      };

      (Api.get as jest.Mock).mockResolvedValue(mockResponse);

      // Call the function
      const result = await ModuleApi.fetchModuleDetail(moduleUUID);

      // Verify API was called correctly
      expect(Api.get).toHaveBeenCalledWith(`${ModuleApi.url}/${moduleUUID}`);

      // Verify response matches mock
      expect(result).toEqual(mockResponse);
      expect(result.data.data.moduleUUID).toBe(moduleUUID);
      expect(result.data.data.definition).toBeDefined();
      expect(result.data.data.definition.layouts).toBeDefined();
    });

    it("should handle API errors", async () => {
      const moduleUUID = "non-existent-uuid";
      const mockError = new Error("Module not found");

      (Api.get as jest.Mock).mockRejectedValue(mockError);

      await expect(ModuleApi.fetchModuleDetail(moduleUUID)).rejects.toThrow(
        mockError,
      );

      expect(Api.get).toHaveBeenCalledWith(`${ModuleApi.url}/${moduleUUID}`);
    });

    it("should handle 404 response", async () => {
      const moduleUUID = "non-existent-uuid";
      const mockResponse = {
        data: {
          responseMeta: {
            success: false,
            status: 404,
            error: {
              message: "UIModule not found",
            },
          },
          data: null,
        },
      };

      (Api.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ModuleApi.fetchModuleDetail(moduleUUID);

      expect(result.data.responseMeta.success).toBe(false);
      expect(result.data.data).toBeNull();
    });
  });

  describe("fetchModulesNoCache", () => {
    it("should call API with cache-busting parameter", async () => {
      const mockResponse = {
        data: {
          responseMeta: {
            success: true,
            status: 200,
          },
          data: [],
        },
      };

      (Api.get as jest.Mock).mockResolvedValue(mockResponse);

      const beforeCall = Date.now();

      await ModuleApi.fetchModulesNoCache();
      const afterCall = Date.now();

      // Verify API was called with cache-busting parameter
      expect(Api.get).toHaveBeenCalledWith(
        ModuleApi.url,
        expect.objectContaining({
          _t: expect.any(Number),
        }),
      );

      // Verify the timestamp is recent
      const callArgs = (Api.get as jest.Mock).mock.calls[0];
      const timestamp = callArgs[1]._t;

      expect(timestamp).toBeGreaterThanOrEqual(beforeCall);
      expect(timestamp).toBeLessThanOrEqual(afterCall);
    });
  });
});
