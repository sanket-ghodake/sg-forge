import { getSession } from "@backend/auth/sessionManager";
import { logEvent } from "@backend/utils/logger";
import { db } from "@database/connection";
import { structuralMetadata } from "@database/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const metadata = await db
      .select()
      .from(structuralMetadata)
      .orderBy(structuralMetadata.sortOrder);

    return NextResponse.json({ metadata });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ipAddress =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";

  try {
    const session = await getSession(request as any);
    if (!session || (session.role !== "super_admin" && session.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, parentId, sortOrder, name, type, extendedAttributes } = body;

    // Check if modifying branding row
    let isBrandingChange = false;
    if (id) {
      const existing = await db
        .select()
        .from(structuralMetadata)
        .where(eq(structuralMetadata.id, id))
        .limit(1);
      if (existing.length > 0 && existing[0].type === "company_name") {
        isBrandingChange = true;
      }
    } else if (type === "company_name") {
      isBrandingChange = true;
    }

    if (isBrandingChange && session.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only super admins can modify platform branding" },
        { status: 403 },
      );
    }

    if (id) {
      // Update metadata row
      await db
        .update(structuralMetadata)
        .set({
          parentId: parentId !== undefined ? parentId || null : undefined,
          sortOrder: typeof sortOrder === "number" ? sortOrder : undefined,
          name: name ? name.trim() : undefined,
          extendedAttributes: extendedAttributes !== undefined ? extendedAttributes : undefined,
          updatedAt: new Date(),
        })
        .where(eq(structuralMetadata.id, id));

      if (isBrandingChange) {
        await logEvent(
          session.id,
          "Platform Branding Updated",
          "INFO",
          { id, name, hasLogo: !!extendedAttributes?.logo },
          ipAddress,
        );
      } else {
        await logEvent(session.id, "Metadata Updated", "INFO", { id, name }, ipAddress);
      }
      return NextResponse.json({ success: true });
    } else {
      // Create new metadata row
      if (!name || !type) {
        return NextResponse.json({ error: "Missing name or type" }, { status: 400 });
      }

      const [newMeta] = await db
        .insert(structuralMetadata)
        .values({
          type: type.trim(),
          name: name.trim(),
          parentId: parentId || null,
          sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
          extendedAttributes: extendedAttributes || {},
        })
        .returning();

      if (isBrandingChange) {
        await logEvent(
          session.id,
          "Platform Branding Updated",
          "INFO",
          { id: newMeta.id, name: newMeta.name, hasLogo: !!extendedAttributes?.logo },
          ipAddress,
        );
      } else {
        await logEvent(
          session.id,
          "Metadata Created",
          "INFO",
          { id: newMeta.id, name: newMeta.name },
          ipAddress,
        );
      }
      return NextResponse.json({ success: true, metadata: newMeta });
    }
  } catch (error: any) {
    console.error("Metadata API error:", error);
    return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const ipAddress =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";

  try {
    const session = await getSession(request as any);
    if (!session || (session.role !== "super_admin" && session.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing ID param" }, { status: 400 });
    }

    // Check if trying to delete branding row
    const existing = await db
      .select()
      .from(structuralMetadata)
      .where(eq(structuralMetadata.id, id))
      .limit(1);

    if (existing.length > 0 && existing[0].type === "company_name") {
      return NextResponse.json(
        { error: "Cannot delete primary platform branding metadata" },
        { status: 400 },
      );
    }

    await db.delete(structuralMetadata).where(eq(structuralMetadata.id, id));

    await logEvent(session.id, "Metadata Deleted", "INFO", { id }, ipAddress);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Metadata delete error:", error);
    return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
  }
}
