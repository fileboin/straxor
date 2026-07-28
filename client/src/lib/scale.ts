import { api } from "./api.js";

export interface RuntimeNode {
  id: string;
  name: string;
  url: string | null;
  status: string;
  capabilities: string;
  region: string;
  version: string;
  config: string;
  priority: number;
  lastHeartbeat: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoadBalancerConfig {
  id: string;
  name: string;
  provider: string | null;
  strategy: string;
  targets: string;
  rules: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FailoverConfig {
  id: string;
  name: string;
  provider: string;
  primaryEndpoint: string | null;
  backupEndpoints: string;
  strategy: string;
  healthCheckInterval: number;
  maxRetries: number;
  cooldownPeriod: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScalingPolicy {
  id: string;
  name: string;
  target: string;
  metric: string;
  minInstances: number;
  maxInstances: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownSeconds: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClusterStatus {
  nodes: { total: number; online: number; offline: number; list: RuntimeNode[] };
  loadBalancers: { total: number; active: number; list: LoadBalancerConfig[] };
  failover: { total: number; active: number; list: FailoverConfig[] };
  scalingPolicies: { total: number; active: number; list: ScalingPolicy[] };
  health: string;
}

export const scaleApi = {
  getStatus: () => api<ClusterStatus>("GET", "/api/scale/status"),

  // Nodes
  getNodes: () => api<RuntimeNode[]>("GET", "/api/scale/nodes"),
  createNode: (data: { name: string; url?: string; region?: string; capabilities?: string[]; version?: string; config?: string; priority?: number }) =>
    api<RuntimeNode>("POST", "/api/scale/nodes", data),
  updateNode: (id: string, data: Partial<RuntimeNode>) =>
    api<RuntimeNode>("PUT", `/api/scale/nodes/${id}`, data),
  deleteNode: (id: string) => api<{ success: boolean }>("DELETE", `/api/scale/nodes/${id}`),
  heartbeat: (id: string) => api<{ success: boolean; node: RuntimeNode }>("POST", `/api/scale/nodes/${id}/heartbeat`),

  // Load Balancers
  getLoadBalancers: () => api<LoadBalancerConfig[]>("GET", "/api/scale/load-balancers"),
  createLoadBalancer: (data: { name: string; provider?: string; strategy?: string; targets?: string[]; rules?: string[] }) =>
    api<LoadBalancerConfig>("POST", "/api/scale/load-balancers", data),
  updateLoadBalancer: (id: string, data: Partial<LoadBalancerConfig>) =>
    api<LoadBalancerConfig>("PUT", `/api/scale/load-balancers/${id}`, data),
  deleteLoadBalancer: (id: string) => api<{ success: boolean }>("DELETE", `/api/scale/load-balancers/${id}`),

  // Failover
  getFailoverConfigs: () => api<FailoverConfig[]>("GET", "/api/scale/failover"),
  createFailoverConfig: (data: { name: string; provider: string; primaryEndpoint?: string; backupEndpoints?: string[]; strategy?: string; healthCheckInterval?: number; maxRetries?: number; cooldownPeriod?: number }) =>
    api<FailoverConfig>("POST", "/api/scale/failover", data),
  updateFailoverConfig: (id: string, data: Partial<FailoverConfig>) =>
    api<FailoverConfig>("PUT", `/api/scale/failover/${id}`, data),
  deleteFailoverConfig: (id: string) => api<{ success: boolean }>("DELETE", `/api/scale/failover/${id}`),
  triggerFailover: (id: string) => api<{ message: string; primary: string | null; activatedBackup: string | null; strategy: string; timestamp: string }>("POST", `/api/scale/failover/${id}/trigger`),

  // Scaling Policies
  getScalingPolicies: () => api<ScalingPolicy[]>("GET", "/api/scale/scaling-policies"),
  createScalingPolicy: (data: { name: string; target?: string; metric?: string; minInstances?: number; maxInstances?: number; scaleUpThreshold?: number; scaleDownThreshold?: number; cooldownSeconds?: number }) =>
    api<ScalingPolicy>("POST", "/api/scale/scaling-policies", data),
  updateScalingPolicy: (id: string, data: Partial<ScalingPolicy>) =>
    api<ScalingPolicy>("PUT", `/api/scale/scaling-policies/${id}`, data),
  deleteScalingPolicy: (id: string) => api<{ success: boolean }>("DELETE", `/api/scale/scaling-policies/${id}`),
};
