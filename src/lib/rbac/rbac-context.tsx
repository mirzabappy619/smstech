"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { BranchInfo, UserBranchContext, ResolvedUserRBAC } from "./rbac-service";

interface RBACContextType {
	userId: string;
	email: string;
	fullName: string;
	role: string;
	roleName: string;
	isOwner: boolean;
	isAdmin: boolean;
	permissions: string[];
	branchContext: UserBranchContext;
	activeBranch: BranchInfo | null;
	setActiveBranch: (branch: BranchInfo | null) => void;
	hasPermission: (permissionCode: string) => boolean;
	hasBranchAccess: (branchId: string) => boolean;
}

const RBACContext = createContext<RBACContextType | null>(null);

interface RBACProviderProps {
	children: React.ReactNode;
	initialRBAC: ResolvedUserRBAC;
}

export function RBACProvider({ children, initialRBAC }: RBACProviderProps) {
	const [rbac] = useState<ResolvedUserRBAC>(initialRBAC);
	
	// Deterministic initial state matching server render
	const defaultBranch =
		initialRBAC.branchContext.branches.find(
			(b) => b.id === initialRBAC.branchContext.defaultBranchId,
		) || initialRBAC.branchContext.branches[0] || null;

	const [activeBranch, setActiveBranchState] = useState<BranchInfo | null>(defaultBranch);

	// Sync saved branch from cookie after client hydration
	useEffect(() => {
		const savedBranchId = document.cookie
			.split("; ")
			.find((row) => row.startsWith("smstech_active_branch="))
			?.split("=")[1];

		if (savedBranchId) {
			const found = initialRBAC.branchContext.branches.find(
				(b) => b.id === savedBranchId,
			);
			if (found) {
				setActiveBranchState(found);
			}
		}
	}, [initialRBAC.branchContext.branches]);

	const setActiveBranch = (branch: BranchInfo | null) => {
		setActiveBranchState(branch);
		if (typeof document !== "undefined") {
			if (branch) {
				document.cookie = `smstech_active_branch=${branch.id}; path=/; max-age=2592000; SameSite=Lax`;
			} else {
				document.cookie = `smstech_active_branch=; path=/; max-age=0; SameSite=Lax`;
			}
		}
	};

	const hasPerm = (permissionCode: string) => {
		if (rbac.isOwner) return true;
		if (rbac.permissions.includes("*")) return true;
		return rbac.permissions.includes(permissionCode);
	};

	const hasBranch = (branchId: string) => {
		if (rbac.isOwner || rbac.branchContext.isAllBranches) return true;
		return rbac.branchContext.branchIds.includes(branchId);
	};

	return (
		<RBACContext.Provider
			value={{
				userId: rbac.userId,
				email: rbac.email,
				fullName: rbac.fullName,
				role: rbac.role,
				roleName: rbac.roleName,
				isOwner: rbac.isOwner,
				isAdmin: rbac.isAdmin,
				permissions: rbac.permissions,
				branchContext: rbac.branchContext,
				activeBranch,
				setActiveBranch,
				hasPermission: hasPerm,
				hasBranchAccess: hasBranch,
			}}>
			{children}
		</RBACContext.Provider>
	);
}

export function useRBAC() {
	const context = useContext(RBACContext);
	if (!context) {
		throw new Error("useRBAC must be used within an RBACProvider");
	}
	return context;
}

export const usePermissions = useRBAC;

interface PermissionGateProps {
	permission: string;
	branchId?: string;
	fallback?: React.ReactNode;
	children: React.ReactNode;
}

export function PermissionGate({
	permission,
	branchId,
	fallback = null,
	children,
}: PermissionGateProps) {
	const { hasPermission, hasBranchAccess } = useRBAC();

	const hasPerm = hasPermission(permission);
	const hasBranch = branchId ? hasBranchAccess(branchId) : true;

	if (!hasPerm || !hasBranch) {
		return <>{fallback}</>;
	}

	return <>{children}</>;
}
