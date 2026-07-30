import type { PackageDependency, PackageListing, PackageVersion } from "./types.js";
import { PackageRegistry } from "./PackageRegistry.js";

export class DependencyManager {
  private registry: PackageRegistry;

  constructor(registry: PackageRegistry) {
    this.registry = registry;
  }

  resolveDependencies(version: PackageVersion): ResolveResult {
    const resolved: PackageDependency[] = [];
    const missing: PackageDependency[] = [];
    const conflicts: string[] = [];

    this.resolveRecursive(version.dependencies, new Set(), resolved, missing, conflicts);

    return {
      resolved,
      missing,
      conflicts,
      success: missing.length === 0 && conflicts.length === 0,
    };
  }

  checkCompatibility(version: PackageVersion): CompatibilityResult {
    const issues: string[] = [];
    let compatible = true;

    for (const dep of version.dependencies) {
      const pkg = this.registry.get(dep.name);
      if (!pkg) {
        issues.push(`Missing dependency: ${dep.name}@${dep.version}`);
        compatible = false;
        continue;
      }

      const hasMatch = pkg.versions.some(v => this.matchSimple(v.version, dep.version));
      if (!hasMatch) {
        issues.push(`Dependency ${dep.name} requires version ${dep.version}, available: ${pkg.versions.map(v => v.version).join(", ")}`);
        compatible = false;
      }
    }

    return { compatible, issues };
  }

  findConflicts(packageName: string, newDeps: PackageDependency[], existingDeps: PackageDependency[]): string[] {
    const conflicts: string[] = [];

    for (const newDep of newDeps) {
      const existing = existingDeps.find(d => d.name === newDep.name);
      if (existing && existing.version !== newDep.version) {
        conflicts.push(`Version conflict for ${newDep.name}: ${existing.version} vs ${newDep.version}`);
      }
    }

    return conflicts;
  }

  getDependencyTree(version: PackageVersion, depth = 0, maxDepth = 3): DependencyTreeNode {
    const node: DependencyTreeNode = {
      name: version.manifest.name,
      version: version.version,
      dependencies: [],
    };

    if (depth >= maxDepth) return node;

    for (const dep of version.dependencies) {
      const pkg = this.registry.get(dep.name);
      if (pkg) {
        const depVersion = pkg.versions.find(v => this.matchSimple(v.version, dep.version)) ?? pkg.versions[0];
        if (depVersion) {
          node.dependencies.push(this.getDependencyTree(depVersion, depth + 1, maxDepth));
        }
      } else {
        node.dependencies.push({ name: dep.name, version: dep.version, dependencies: [] });
      }
    }

    return node;
  }

  private resolveRecursive(
    deps: PackageDependency[],
    visited: Set<string>,
    resolved: PackageDependency[],
    missing: PackageDependency[],
    conflicts: string[],
  ): void {
    for (const dep of deps) {
      if (visited.has(dep.name)) continue;
      visited.add(dep.name);

      const pkg = this.registry.get(dep.name);
      if (!pkg) {
        missing.push(dep);
        continue;
      }

      const match = pkg.versions.find(v => this.matchSimple(v.version, dep.version));
      if (!match) {
        conflicts.push(`${dep.name}: required ${dep.version}, not found in ${pkg.versions.map(v => v.version).join(", ")}`);
        continue;
      }

      resolved.push(dep);
      this.resolveRecursive(match.dependencies, visited, resolved, missing, conflicts);
    }
  }

  private matchSimple(version: string, constraint: string): boolean {
    return version.startsWith(constraint.replace(/[^\d.]/g, ""));
  }
}

export interface ResolveResult {
  resolved: PackageDependency[];
  missing: PackageDependency[];
  conflicts: string[];
  success: boolean;
}

export interface CompatibilityResult {
  compatible: boolean;
  issues: string[];
}

export interface DependencyTreeNode {
  name: string;
  version: string;
  dependencies: DependencyTreeNode[];
}
