import { Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { projectCollaborators, projects } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

export type ProjectRole = "owner" | "admin" | "member" | "viewer";

interface ProjectPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
  canDeploy: boolean;
}

const ROLE_PERMISSIONS: Record<ProjectRole, ProjectPermissions> = {
  owner: { canEdit: true, canDelete: true, canManageMembers: true, canDeploy: true },
  admin: { canEdit: true, canDelete: true, canManageMembers: true, canDeploy: true },
  member: { canEdit: true, canDelete: false, canManageMembers: false, canDeploy: true },
  viewer: { canEdit: false, canDelete: false, canManageMembers: false, canDeploy: false },
};

export function getPermissions(role: ProjectRole): ProjectPermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
}

// Middleware: check project access + return user's role
export function requireProjectAccess(allowedRoles: ProjectRole[] = ["owner", "admin", "member", "viewer"]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).userId;
    const projectId = req.params.projectId || req.body.projectId || req.query.projectId;

    if (!projectId) {
      res.status(400).json({ error: "projectId required" });
      return;
    }

    try {
      // Check if user is the project owner
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      if (project.userId === userId) {
        (req as any).projectRole = "owner";
        (req as any).permissions = getPermissions("owner");
        next();
        return;
      }

      // Check collaborator access
      const [collab] = await db
        .select()
        .from(projectCollaborators)
        .where(and(eq(projectCollaborators.projectId, projectId), eq(projectCollaborators.userId, userId)))
        .limit(1);

      if (!collab) {
        res.status(403).json({ error: "No access to this project" });
        return;
      }

      const role = collab.role as ProjectRole;
      if (!allowedRoles.includes(role)) {
        res.status(403).json({ error: `Insufficient permissions. Required: ${allowedRoles.join(" or ")}` });
        return;
      }

      (req as any).projectRole = role;
      (req as any).permissions = getPermissions(role);
      next();
    } catch (error) {
      console.error("RBAC error:", error);
      res.status(500).json({ error: "Authorization check failed" });
    }
  };
}
