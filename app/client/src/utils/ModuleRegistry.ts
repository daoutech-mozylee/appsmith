/**
 * ModuleRegistry - 모듈 정의 싱글톤 레지스트리
 *
 * 빌드 시점에 로드된 모듈 정의를 중앙에서 관리합니다.
 * UUID 또는 이름으로 모듈 정의를 O(1) 시간 복잡도로 조회할 수 있습니다.
 *
 * @example
 * ```typescript
 * // 초기화 (usePackageModules.ts에서 빌드 시점에 호출)
 * ModuleRegistry.register(moduleDefinition);
 *
 * // 조회 (saga, component에서)
 * const definition = ModuleRegistry.get(moduleUUID);
 * if (!definition) {
 *   // 모듈 없음 에러 처리
 * }
 * ```
 */

import type {
  ModuleInputSection,
  ModuleOutputSection,
  ModuleDSL,
  ActionConfig,
  ActionCollectionConfig,
} from "constants/PackageModuleConstants";

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
}

/**
 * ModuleRegistry 인터페이스
 */
export interface IModuleRegistry {
  register(definition: ModuleDefinition): void;
  get(moduleUUID: string): ModuleDefinition | undefined;
  getByName(moduleName: string): ModuleDefinition | undefined;
  getAll(): ModuleDefinition[];
  has(moduleUUID: string): boolean;
  size(): number;
  clear(): void;
}

/**
 * ModuleRegistry 싱글톤 구현
 *
 * 모듈 정의를 중앙에서 관리하는 레지스트리입니다.
 * 빌드 시점에 모든 모듈이 등록되고, 런타임에 UUID로 조회됩니다.
 */
class ModuleRegistryImpl implements IModuleRegistry {
  private static instance: ModuleRegistryImpl;
  private modules: Map<string, ModuleDefinition> = new Map();
  private nameIndex: Map<string, string> = new Map(); // moduleName → moduleUUID

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
    this.nameIndex.clear();
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
   * UUID로 모듈 조회
   */
  get(moduleUUID: string): ModuleDefinition | undefined {
    return ModuleRegistryImpl.getInstance().get(moduleUUID);
  },

  /**
   * 이름으로 모듈 조회
   */
  getByName(moduleName: string): ModuleDefinition | undefined {
    return ModuleRegistryImpl.getInstance().getByName(moduleName);
  },

  /**
   * 모든 등록된 모듈 목록 반환
   */
  getAll(): ModuleDefinition[] {
    return ModuleRegistryImpl.getInstance().getAll();
  },

  /**
   * 모듈 존재 여부 확인
   */
  has(moduleUUID: string): boolean {
    return ModuleRegistryImpl.getInstance().has(moduleUUID);
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
   * 싱글톤 인스턴스 접근 (고급 사용 시)
   */
  getInstance(): IModuleRegistry {
    return ModuleRegistryImpl.getInstance();
  },
};

export default ModuleRegistry;
