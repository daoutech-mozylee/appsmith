/**
 * ModuleRegistry - 모듈 정의 싱글톤 레지스트리
 *
 * 빌드 시점에 로드된 모듈 정의를 중앙에서 관리합니다.
 * UUID 또는 이름으로 모듈 정의를 O(1) 시간 복잡도로 조회할 수 있습니다.
 *
 * API 연동:
 * - initFromApi(): API에서 모듈 목록을 로드하여 레지스트리 초기화
 * - getAsync(): 캐시된 모듈 조회 또는 API에서 지연 로딩
 *
 * @example
 * ```typescript
 * // 초기화 (usePackageModules.ts에서 빌드 시점에 호출)
 * ModuleRegistry.register(moduleDefinition);
 *
 * // API 초기화 (런타임에 호출)
 * await ModuleRegistry.initFromApi();
 *
 * // 조회 (saga, component에서)
 * const definition = ModuleRegistry.get(moduleUUID);
 * if (!definition) {
 *   // 모듈 없음 에러 처리
 * }
 *
 * // 비동기 조회 (definition 지연 로딩)
 * const definition = await ModuleRegistry.getAsync(moduleUUID);
 * ```
 */

import type {
  ModuleInputSection,
  ModuleOutputSection,
  ModuleDSL,
  ActionConfig,
  ActionCollectionConfig,
} from "constants/PackageModuleConstants";
import ModuleApi from "api/ModuleApi";
import type { UIModuleListItem, UIModuleDetail } from "api/ModuleApi";

/**
 * 모듈 원본 크기 정보 - 동적 스케일링에 사용
 */
export interface ModuleOriginalSize {
  /** 원본 DSL의 rightColumn (보통 64) */
  columns: number;
  /** 원본 DSL의 bottomRow (내부 위젯들의 최대 bottomRow) */
  rows: number;
}

/**
 * 모듈 정의 - 레지스트리에 저장되는 공통 데이터
 */
export interface ModuleDefinition {
  // 식별자
  moduleUUID: string;
  packageUUID: string;
  moduleName: string;
  packageName: string;

  // 메타데이터
  icon?: string;
  color?: string;

  // 인터페이스 스키마
  inputsForm: ModuleInputSection[];
  outputsForm: ModuleOutputSection[];

  // 구조 (위젯 트리)
  dsl: ModuleDSL;

  // 로직
  actions: ActionConfig[];
  actionCollections: ActionCollectionConfig[];

  /**
   * 원본 크기 정보 - 동적 스케일링에 사용
   * 모듈 컨테이너 리사이즈 시 내부 위젯들의 height 비례 조정에 사용됨
   */
  originalSize: ModuleOriginalSize;
}

/**
 * 부분 모듈 정의 - API 목록 조회 시 반환되는 경량 데이터
 * definition이 없으며, 상세 조회 시 로드됨
 */
export interface PartialModuleDefinition {
  moduleUUID: string;
  packageUUID: string;
  moduleName: string;
  packageName: string;
  version?: string;
  icon?: string;
  color?: string;
  // definition 관련 필드는 없음 (지연 로딩)
  _isPartial: true;
}

/**
 * ModuleRegistry 인터페이스
 */
export interface IModuleRegistry {
  register(definition: ModuleDefinition): void;
  registerLazy(item: UIModuleListItem): void;
  get(moduleUUID: string): ModuleDefinition | undefined;
  getAsync(moduleUUID: string): Promise<ModuleDefinition | undefined>;
  getByName(moduleName: string): ModuleDefinition | undefined;
  getAll(): ModuleDefinition[];
  getAllPartial(): (ModuleDefinition | PartialModuleDefinition)[];
  has(moduleUUID: string): boolean;
  isPartial(moduleUUID: string): boolean;
  size(): number;
  clear(): void;
  initFromApi(): Promise<void>;
  isApiInitialized(): boolean;
}

/**
 * ModuleRegistry 싱글톤 구현
 *
 * 모듈 정의를 중앙에서 관리하는 레지스트리입니다.
 * 빌드 시점에 모든 모듈이 등록되고, 런타임에 UUID로 조회됩니다.
 *
 * API 연동:
 * - initFromApi()로 API에서 모듈 목록 로드
 * - getAsync()로 개별 모듈 지연 로딩
 */
class ModuleRegistryImpl implements IModuleRegistry {
  private static instance: ModuleRegistryImpl;
  private modules: Map<string, ModuleDefinition> = new Map();
  private partialModules: Map<string, PartialModuleDefinition> = new Map();
  private nameIndex: Map<string, string> = new Map(); // moduleName → moduleUUID

  // API 로딩 상태
  private apiInitialized = false;
  private loadingPromise: Promise<void> | null = null;
  private detailLoadingPromises: Map<
    string,
    Promise<ModuleDefinition | undefined>
  > = new Map();

  private constructor() {}

  /**
   * 싱글톤 인스턴스 반환
   */
  static getInstance(): ModuleRegistryImpl {
    if (!ModuleRegistryImpl.instance) {
      ModuleRegistryImpl.instance = new ModuleRegistryImpl();
    }

    return ModuleRegistryImpl.instance;
  }

  /**
   * 모듈 정의 등록
   * @param definition - 등록할 모듈 정의
   */
  register(definition: ModuleDefinition): void {
    if (this.modules.has(definition.moduleUUID)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ModuleRegistry] Module ${definition.moduleName} (${definition.moduleUUID}) already registered. Overwriting.`,
      );
    }

    this.modules.set(definition.moduleUUID, definition);
    this.nameIndex.set(definition.moduleName, definition.moduleUUID);

    // partial에서 제거 (full definition으로 업그레이드)
    this.partialModules.delete(definition.moduleUUID);
  }

  /**
   * 지연 로딩용 부분 모듈 등록 (API 목록 조회 결과)
   * @param item - API에서 반환된 모듈 목록 아이템
   */
  registerLazy(item: UIModuleListItem): void {
    // 이미 full definition이 있으면 스킵
    if (this.modules.has(item.moduleUUID)) {
      return;
    }

    const partial: PartialModuleDefinition = {
      moduleUUID: item.moduleUUID,
      packageUUID: item.packageUUID,
      moduleName: item.moduleName,
      packageName: item.packageName,
      version: item.version,
      icon: item.meta?.icon,
      color: item.meta?.color,
      _isPartial: true,
    };

    this.partialModules.set(item.moduleUUID, partial);
    this.nameIndex.set(item.moduleName, item.moduleUUID);
  }

  /**
   * UUID로 모듈 조회
   * @param moduleUUID - 조회할 모듈 UUID
   * @returns 모듈 정의 또는 undefined
   */
  get(moduleUUID: string): ModuleDefinition | undefined {
    return this.modules.get(moduleUUID);
  }

  /**
   * 이름으로 모듈 조회
   * @param moduleName - 조회할 모듈 이름
   * @returns 모듈 정의 또는 undefined
   */
  getByName(moduleName: string): ModuleDefinition | undefined {
    const uuid = this.nameIndex.get(moduleName);

    return uuid ? this.modules.get(uuid) : undefined;
  }

  /**
   * 모든 등록된 모듈 목록 반환
   * @returns 모듈 정의 배열
   */
  getAll(): ModuleDefinition[] {
    return Array.from(this.modules.values());
  }

  /**
   * 모듈 존재 여부 확인
   * @param moduleUUID - 확인할 모듈 UUID
   * @returns 존재 여부
   */
  has(moduleUUID: string): boolean {
    return this.modules.has(moduleUUID);
  }

  /**
   * 등록된 모듈 수 반환
   * @returns 모듈 수
   */
  size(): number {
    return this.modules.size;
  }

  /**
   * 모든 등록된 모듈 제거 (테스트용)
   */
  clear(): void {
    this.modules.clear();
    this.partialModules.clear();
    this.nameIndex.clear();
    this.apiInitialized = false;
    this.loadingPromise = null;
    this.detailLoadingPromises.clear();
  }

  /**
   * 비동기 모듈 조회 (지연 로딩)
   *
   * 캐시된 full definition이 있으면 즉시 반환하고,
   * partial만 있거나 없으면 API에서 상세 조회하여 반환합니다.
   *
   * @param moduleUUID - 조회할 모듈 UUID
   * @returns 모듈 정의 또는 undefined
   */
  async getAsync(moduleUUID: string): Promise<ModuleDefinition | undefined> {
    // 1. 캐시된 full definition 확인
    const cached = this.modules.get(moduleUUID);

    if (cached) {
      return cached;
    }

    // 2. 이미 로딩 중인 요청이 있으면 재사용
    const existingPromise = this.detailLoadingPromises.get(moduleUUID);

    if (existingPromise) {
      return existingPromise;
    }

    // 3. API에서 상세 조회
    const loadPromise = this.loadModuleDetail(moduleUUID);

    this.detailLoadingPromises.set(moduleUUID, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this.detailLoadingPromises.delete(moduleUUID);
    }
  }

  /**
   * 모든 모듈 반환 (full + partial)
   *
   * 위젯 사이드바 등에서 목록 표시용으로 사용됩니다.
   * partial 모듈은 definition이 없으므로 메타데이터만 사용 가능합니다.
   *
   * @returns 모든 모듈 (full + partial) 배열
   */
  getAllPartial(): (ModuleDefinition | PartialModuleDefinition)[] {
    const fullModules = Array.from(this.modules.values());
    const partials = Array.from(this.partialModules.values());

    return [...fullModules, ...partials];
  }

  /**
   * 모듈이 partial인지 확인
   * @param moduleUUID - 확인할 모듈 UUID
   * @returns partial 여부
   */
  isPartial(moduleUUID: string): boolean {
    return this.partialModules.has(moduleUUID);
  }

  /**
   * API에서 모듈 목록 로드하여 레지스트리 초기화
   *
   * 최초 1회만 실행되며, 이미 초기화되었으면 즉시 반환합니다.
   * 로딩 중에 다시 호출되면 기존 Promise를 재사용합니다.
   */
  async initFromApi(): Promise<void> {
    // 이미 초기화됨
    if (this.apiInitialized) {
      return;
    }

    // 로딩 중이면 기존 Promise 재사용
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.doInitFromApi();

    try {
      await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  /**
   * API 초기화 여부 확인
   */
  isApiInitialized(): boolean {
    return this.apiInitialized;
  }

  /**
   * API에서 모듈 목록 로드 (내부 구현)
   */
  private async doInitFromApi(): Promise<void> {
    try {
      const response = await ModuleApi.fetchModules();

      if (response.data?.data) {
        const modules = response.data.data;

        // eslint-disable-next-line no-console
        console.log(
          `[ModuleRegistry] Loaded ${modules.length} modules from API`,
        );

        for (const module of modules) {
          this.registerLazy(module);
        }

        this.apiInitialized = true;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(
        "[ModuleRegistry] Failed to load modules from API, using preloaded modules",
        error,
      );
      // 폴백: 기존 빌드 시점 모듈 사용 (이미 등록된 상태)
      // apiInitialized는 false로 유지하여 재시도 가능
    }
  }

  /**
   * API에서 모듈 상세 조회 (내부 구현)
   */
  private async loadModuleDetail(
    moduleUUID: string,
  ): Promise<ModuleDefinition | undefined> {
    try {
      const response = await ModuleApi.fetchModuleDetail(moduleUUID);

      if (response.data?.data) {
        const detail = response.data.data;
        const definition = this.convertApiResponseToDefinition(detail);

        // 레지스트리에 등록
        this.register(definition);

        return definition;
      }

      return undefined;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `[ModuleRegistry] Failed to load module detail: ${moduleUUID}`,
        error,
      );

      return undefined;
    }
  }

  /**
   * API 응답을 ModuleDefinition으로 변환
   */
  private convertApiResponseToDefinition(
    detail: UIModuleDetail,
  ): ModuleDefinition {
    const def = detail.definition;

    // DSL에서 원본 크기 계산
    const dsl = def.layouts?.dsl;
    const originalSize: ModuleOriginalSize = {
      columns: dsl?.rightColumn ?? 64,
      rows: this.calculateMaxBottomRow(dsl),
    };

    return {
      moduleUUID: detail.moduleUUID,
      packageUUID: detail.packageUUID,
      moduleName: detail.moduleName,
      packageName: detail.packageName,
      icon: detail.meta?.icon,
      color: detail.meta?.color,
      inputsForm: def.inputsForm ?? [],
      outputsForm: def.outputsForm ?? [],
      dsl: def.layouts?.dsl ?? {
        widgetName: "Canvas",
        type: "CANVAS_WIDGET",
        children: [],
      },
      actions: def.actionList ?? [],
      actionCollections: def.actionCollectionList ?? [],
      originalSize,
    };
  }

  /**
   * DSL에서 최대 bottomRow 계산
   */
  private calculateMaxBottomRow(dsl: ModuleDSL | undefined): number {
    if (!dsl?.children?.length) {
      return 0;
    }

    let maxRow = 0;

    const traverse = (widgets: ModuleDSL[]): void => {
      for (const widget of widgets) {
        if (typeof widget.bottomRow === "number" && widget.bottomRow > maxRow) {
          maxRow = widget.bottomRow;
        }

        if (widget.children?.length) {
          traverse(widget.children);
        }
      }
    };

    traverse(dsl.children);

    return maxRow;
  }
}

/**
 * ModuleRegistry 정적 메서드들
 * 편의를 위해 인스턴스 메서드를 정적 메서드로 노출
 */
export const ModuleRegistry = {
  /**
   * 모듈 정의 등록
   */
  register(definition: ModuleDefinition): void {
    ModuleRegistryImpl.getInstance().register(definition);
  },

  /**
   * 지연 로딩용 부분 모듈 등록 (API 목록 조회 결과)
   */
  registerLazy(item: UIModuleListItem): void {
    ModuleRegistryImpl.getInstance().registerLazy(item);
  },

  /**
   * UUID로 모듈 조회 (동기)
   */
  get(moduleUUID: string): ModuleDefinition | undefined {
    return ModuleRegistryImpl.getInstance().get(moduleUUID);
  },

  /**
   * UUID로 모듈 조회 (비동기, 지연 로딩)
   *
   * 캐시된 full definition이 있으면 즉시 반환하고,
   * 없으면 API에서 상세 조회하여 반환합니다.
   */
  async getAsync(moduleUUID: string): Promise<ModuleDefinition | undefined> {
    return ModuleRegistryImpl.getInstance().getAsync(moduleUUID);
  },

  /**
   * 이름으로 모듈 조회
   */
  getByName(moduleName: string): ModuleDefinition | undefined {
    return ModuleRegistryImpl.getInstance().getByName(moduleName);
  },

  /**
   * 모든 등록된 모듈 목록 반환 (full definition만)
   */
  getAll(): ModuleDefinition[] {
    return ModuleRegistryImpl.getInstance().getAll();
  },

  /**
   * 모든 모듈 반환 (full + partial)
   *
   * 위젯 사이드바 등에서 목록 표시용으로 사용됩니다.
   */
  getAllPartial(): (ModuleDefinition | PartialModuleDefinition)[] {
    return ModuleRegistryImpl.getInstance().getAllPartial();
  },

  /**
   * 모듈 존재 여부 확인
   */
  has(moduleUUID: string): boolean {
    return ModuleRegistryImpl.getInstance().has(moduleUUID);
  },

  /**
   * 모듈이 partial인지 확인
   */
  isPartial(moduleUUID: string): boolean {
    return ModuleRegistryImpl.getInstance().isPartial(moduleUUID);
  },

  /**
   * 등록된 모듈 수 반환
   */
  size(): number {
    return ModuleRegistryImpl.getInstance().size();
  },

  /**
   * 모든 등록된 모듈 제거 (테스트용)
   */
  clear(): void {
    ModuleRegistryImpl.getInstance().clear();
  },

  /**
   * API에서 모듈 목록 로드하여 레지스트리 초기화
   *
   * 최초 1회만 실행되며, 이미 초기화되었으면 즉시 반환합니다.
   */
  async initFromApi(): Promise<void> {
    return ModuleRegistryImpl.getInstance().initFromApi();
  },

  /**
   * API 초기화 여부 확인
   */
  isApiInitialized(): boolean {
    return ModuleRegistryImpl.getInstance().isApiInitialized();
  },

  /**
   * 싱글톤 인스턴스 접근 (고급 사용 시)
   */
  getInstance(): IModuleRegistry {
    return ModuleRegistryImpl.getInstance();
  },
};

export default ModuleRegistry;
