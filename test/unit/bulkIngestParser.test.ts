import { describe, expect, test } from "bun:test";

// Exact parser logic from page.tsx to run unit tests against
function parseIngestionData(text: string) {
  const trimmed = text.trim();
  const parsed: any[] = [];
  const errors: { [key: number]: string[] } = {};

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed);
      const rawRows = Array.isArray(json) ? json : [json];

      rawRows.forEach((row: any) => {
        const rowData: any = {
          eid: "",
          name: "",
          email: "",
          role: "user",
          designation: "",
          vertical: "",
          managerEid: "",
        };

        Object.keys(row).forEach((k) => {
          const val = String(row[k] ?? "").trim();
          const lowerK = k.toLowerCase().replace(/_/g, "");
          if (lowerK === "eid") rowData.eid = val;
          else if (lowerK === "name") rowData.name = val;
          else if (lowerK === "email") rowData.email = val;
          else if (lowerK === "role") rowData.role = val;
          else if (lowerK === "designation") rowData.designation = val;
          else if (lowerK === "vertical") rowData.vertical = val;
          else if (lowerK === "managereid" || lowerK === "manager") rowData.managerEid = val;
        });

        parsed.push(rowData);
      });
    } catch (err: any) {
      throw new Error("Invalid JSON structure: " + err.message);
    }
  } else {
    const lines = trimmed.split("\n");
    if (lines.length === 0 || !lines[0].trim()) return { parsed, errors };

    const parseCSVLine = (line: string) => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map((v) => v.replace(/^"|"$/g, ""));
    };

    const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/_/g, ""));

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cells = parseCSVLine(lines[i]);

      const rowData: any = {
        eid: "",
        name: "",
        email: "",
        role: "user",
        designation: "",
        vertical: "",
        managerEid: "",
      };

      headers.forEach((h, index) => {
        const val = cells[index] || "";
        if (h === "eid") rowData.eid = val;
        else if (h === "name") rowData.name = val;
        else if (h === "email") rowData.email = val;
        else if (h === "role") rowData.role = val;
        else if (h === "designation") rowData.designation = val;
        else if (h === "vertical") rowData.vertical = val;
        else if (h === "managereid" || h === "manager") rowData.managerEid = val;
      });

      parsed.push(rowData);
    }
  }

  // Duplicate checks & validations
  const eidRegex = /^E\d{4}$/;
  const eidCounts = new Map<string, number>();
  const emailCounts = new Map<string, number>();

  parsed.forEach((row) => {
    if (row.eid) {
      const clean = row.eid.toLowerCase().trim();
      eidCounts.set(clean, (eidCounts.get(clean) || 0) + 1);
    }
    if (row.email) {
      const clean = row.email.toLowerCase().trim();
      emailCounts.set(clean, (emailCounts.get(clean) || 0) + 1);
    }
  });

  parsed.forEach((rowData, i) => {
    const rowErrors: string[] = [];
    if (!rowData.eid || !eidRegex.test(rowData.eid)) {
      rowErrors.push("EID format invalid (Must be E followed by 4 digits)");
    } else {
      const clean = rowData.eid.toLowerCase().trim();
      if ((eidCounts.get(clean) || 0) > 1) {
        rowErrors.push(`Duplicate EID "${rowData.eid}" within this upload batch`);
      }
    }

    if (!rowData.name) {
      rowErrors.push("Name field is missing");
    }

    if (!rowData.email || !rowData.email.includes("@")) {
      rowErrors.push("Email address invalid");
    } else {
      const clean = rowData.email.toLowerCase().trim();
      if ((emailCounts.get(clean) || 0) > 1) {
        rowErrors.push(`Duplicate Email "${rowData.email}" within this upload batch`);
      }
    }

    if (!rowData.designation) {
      rowErrors.push("Missing Designation");
    }
    if (rowData.managerEid && !eidRegex.test(rowData.managerEid)) {
      rowErrors.push("Manager EID format invalid (Must be E followed by 4 digits)");
    }

    if (rowErrors.length > 0) {
      errors[i] = rowErrors;
    }
  });

  return { parsed, errors };
}

describe("Roster Ingestion Parser Unit Tests", () => {
  test("Parse valid CSV data with quotes and commas", () => {
    const csvData = `EID,Name,Email,Role,Designation,Vertical,ManagerEID
E1001,"Ghodake, Sanket",sanket@org.com,admin,Tech Lead,HQ,E1002
E1002,John Doe,john@org.com,user,Director,HQ,`;

    const { parsed, errors } = parseIngestionData(csvData);

    expect(Object.keys(errors)).toHaveLength(0);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].eid).toBe("E1001");
    expect(parsed[0].name).toBe("Ghodake, Sanket");
    expect(parsed[0].email).toBe("sanket@org.com");
    expect(parsed[0].managerEid).toBe("E1002");
    expect(parsed[1].managerEid).toBe("");
  });

  test("Parse JSON roster with flexible case-insensitive keys", () => {
    const jsonData = `[
      {
        "EID": "E1001",
        "name": "Sanket",
        "Email": "sanket@org.com",
        "role": "admin",
        "Designation": "Architect",
        "vertical": "Platform",
        "manager_eid": "E1002"
      }
    ]`;

    const { parsed, errors } = parseIngestionData(jsonData);

    expect(Object.keys(errors)).toHaveLength(0);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].eid).toBe("E1001");
    expect(parsed[0].name).toBe("Sanket");
    expect(parsed[0].email).toBe("sanket@org.com");
    expect(parsed[0].role).toBe("admin");
    expect(parsed[0].designation).toBe("Architect");
    expect(parsed[0].vertical).toBe("Platform");
    expect(parsed[0].managerEid).toBe("E1002");
  });

  test("Flag validation errors on invalid EID, Name, Email, and Manager EID formats", () => {
    const badData = `EID,Name,Email,Role,Designation,Vertical,ManagerEID
E99,Sanket,bad-email,user,Staff,Engineering,E789`;

    const { parsed, errors } = parseIngestionData(badData);

    expect(parsed).toHaveLength(1);
    expect(errors[0]).toBeDefined();
    expect(errors[0]).toContain("EID format invalid (Must be E followed by 4 digits)");
    expect(errors[0]).toContain("Email address invalid");
    expect(errors[0]).toContain("Manager EID format invalid (Must be E followed by 4 digits)");
  });

  test("Flag duplicate EIDs and duplicate Emails within the uploaded batch", () => {
    const dupData = `EID,Name,Email,Role,Designation,Vertical,ManagerEID
E1001,Sanket Ghodake,sanket@org.com,admin,Tech Lead,HQ,
E1001,John Doe,john@org.com,user,Director,HQ,
E1002,Jane Smith,sanket@org.com,user,Manager,HQ,`;

    const { parsed, errors } = parseIngestionData(dupData);

    expect(parsed).toHaveLength(3);
    // E1001 is duplicated on lines 0 and 1
    expect(errors[0]).toContain('Duplicate EID "E1001" within this upload batch');
    expect(errors[1]).toContain('Duplicate EID "E1001" within this upload batch');
    // sanket@org.com is duplicated on lines 0 and 2
    expect(errors[0]).toContain('Duplicate Email "sanket@org.com" within this upload batch');
    expect(errors[2]).toContain('Duplicate Email "sanket@org.com" within this upload batch');
  });
});
