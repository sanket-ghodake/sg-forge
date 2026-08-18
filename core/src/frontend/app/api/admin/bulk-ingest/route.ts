import { getSession } from "@backend/auth/sessionManager";
import { logEvent } from "@backend/utils/logger";
import { db } from "@database/connection";
import { structuralMetadata, users } from "@database/schema";
import bcrypt from "bcryptjs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const ipAddress =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";

  try {
    // 1. Verify admin session
    const session = await getSession(request as any);
    if (!session || (session.role !== "super_admin" && session.role !== "admin")) {
      return NextResponse.json(
        { error: "Unauthorized: Admin privileges required" },
        { status: 401 },
      );
    }

    const { data } = await request.json();
    if (!Array.isArray(data)) {
      return NextResponse.json(
        { error: "Invalid payload: Expected an array of rows" },
        { status: 400 },
      );
    }

    const defaultPasswordHash = await bcrypt.hash("password123", 12);
    const results = [];

    // Resolve existing designations and verticals into in-memory maps
    const existingMetadata = await db.select().from(structuralMetadata);
    const designationMap = new Map<string, string>(); // name -> id
    const verticalMap = new Map<string, string>(); // name -> id
    for (const item of existingMetadata) {
      if (item.type === "job_level") {
        designationMap.set(item.name.toLowerCase().trim(), item.id);
      } else if (item.type === "vertical") {
        verticalMap.set(item.name.toLowerCase().trim(), item.id);
      }
    }

    // Deduplicate and identify new designations and verticals to insert
    const newDesignationsToInsert = new Set<string>();
    const newVerticalsToInsert = new Set<string>();
    for (const row of data) {
      if (row.designation) {
        const dName = row.designation.trim();
        if (!designationMap.has(dName.toLowerCase())) {
          newDesignationsToInsert.add(dName);
        }
      }
      if (row.vertical) {
        const vName = row.vertical.trim();
        if (!verticalMap.has(vName.toLowerCase())) {
          newVerticalsToInsert.add(vName);
        }
      }
    }

    // Batch insert new designations if any
    if (newDesignationsToInsert.size > 0) {
      const newDesRows = await db
        .insert(structuralMetadata)
        .values(
          Array.from(newDesignationsToInsert).map((name) => ({
            type: "job_level" as const,
            name,
            sortOrder: 0,
          })),
        )
        .returning();
      for (const r of newDesRows) {
        designationMap.set(r.name.toLowerCase().trim(), r.id);
      }
    }

    // Batch insert new verticals if any
    if (newVerticalsToInsert.size > 0) {
      const newVertRows = await db
        .insert(structuralMetadata)
        .values(
          Array.from(newVerticalsToInsert).map((name) => ({
            type: "vertical" as const,
            name,
            sortOrder: 0,
          })),
        )
        .returning();
      for (const r of newVertRows) {
        verticalMap.set(r.name.toLowerCase().trim(), r.id);
      }
    }

    // Resolve target EIDs in data to query existing users in a single query
    const targetEids = new Set<string>();
    for (const row of data) {
      if (row.eid) targetEids.add(row.eid.toLowerCase().trim());
      if (row.managerEid) targetEids.add(row.managerEid.toLowerCase().trim());
    }

    const existingUsersList =
      targetEids.size > 0
        ? await db
            .select({
              id: users.id,
              eid: users.eid,
              role: users.role,
              designationId: users.designationId,
              verticalId: users.verticalId,
              managerId: users.managerId,
            })
            .from(users)
            .where(inArray(sql`lower(${users.eid})`, Array.from(targetEids)))
        : [];

    const userEidMap = new Map<string, string>(); // EID -> ID
    const userDetailsMap = new Map<string, any>(); // EID -> user record
    for (const u of existingUsersList) {
      const cleanEid = u.eid.toLowerCase().trim();
      userEidMap.set(cleanEid, u.id);
      userDetailsMap.set(cleanEid, u);
    }

    for (const row of data) {
      const { eid, name, email, role, designation, vertical, managerEid } = row;

      // Validate required fields
      if (!eid || !name || !email) {
        results.push({ eid, status: "error", error: "Missing EID, Name, or Email" });
        continue;
      }

      try {
        // Resolve Designation ID from map
        const designationId = designation
          ? designationMap.get(designation.toLowerCase().trim()) || null
          : null;

        // Resolve Vertical ID from map
        const verticalId = vertical ? verticalMap.get(vertical.toLowerCase().trim()) || null : null;

        // Resolve Manager ID from map
        const managerId = managerEid
          ? userEidMap.get(managerEid.toLowerCase().trim()) || null
          : null;

        // Check if user already exists from map
        const existingUser = userDetailsMap.get(eid.toLowerCase().trim());

        if (existingUser) {
          // Update existing user
          await db
            .update(users)
            .set({
              name: name.trim(),
              email: email.toLowerCase().trim(),
              role: role ? role.toLowerCase().trim() : existingUser.role,
              designationId: designationId || existingUser.designationId,
              verticalId: verticalId || existingUser.verticalId,
              managerId: managerId || existingUser.managerId,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingUser.id));

          results.push({ eid, status: "updated" });
        } else {
          // Insert new user
          const [newUser] = await db
            .insert(users)
            .values({
              eid: eid.trim(),
              name: name.trim(),
              email: email.toLowerCase().trim(),
              passwordHash: defaultPasswordHash,
              isPasswordChanged: false, // force password reset on first login
              role: role ? role.toLowerCase().trim() : "user",
              designationId,
              verticalId,
              managerId,
            })
            .returning();

          // Add new user to maps so subsequent records can reference them as manager
          if (newUser) {
            const cleanEid = newUser.eid.toLowerCase().trim();
            userEidMap.set(cleanEid, newUser.id);
            userDetailsMap.set(cleanEid, newUser);
          }

          results.push({ eid, status: "created" });
        }
      } catch (err: any) {
        results.push({ eid, status: "error", error: err.message || "Database execution error" });
      }
    }

    // Log the bulk ingestion event
    await logEvent(session.id, "Bulk Ingest Processed", "INFO", { count: data.length }, ipAddress);

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Bulk ingestion error:", error);
    return NextResponse.json(
      { error: "Internal server error during bulk ingestion" },
      { status: 500 },
    );
  }
}
