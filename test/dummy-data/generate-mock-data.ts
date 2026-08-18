import fs from "fs";
import path from "path";

interface Subsidiary {
  name: string;
}

interface Vertical {
  name: string;
}

interface JobLevel {
  name: string;
}

interface Employee {
  eid: string;
  name: string;
  email: string;
  role: string;
  designation: string;
  vertical: string;
  subsidiary: string;
  managerEid: string | null;
}

const subsidiaries: Subsidiary[] = [{ name: "SG Forge Ltd" }];

const verticals: Vertical[] = [
  { name: "Executive" },
  { name: "Engineering" },
  { name: "Product Management" },
  { name: "Sales & Operations" },
  { name: "Human Resources" },
  { name: "Finance" },
];

const jobLevels: JobLevel[] = [
  { name: "L12 CEO" },
  { name: "L10 VP of Engineering" },
  { name: "L10 VP of Product" },
  { name: "L10 VP of Operations" },
  { name: "L8 Director of Engineering" },
  { name: "L8 Director of Product" },
  { name: "L8 Director of Operations" },
  { name: "L8 Director of HR" },
  { name: "L8 Director of Finance" },
  { name: "L6 Engineering Manager" },
  { name: "L6 Product Manager" },
  { name: "L6 Operations Manager" },
  { name: "L6 Sales Manager" },
  { name: "L6 HR Manager" },
  { name: "L6 Finance Manager" },
  { name: "L5 Senior Software Engineer" },
  { name: "L5 Senior Product Specialist" },
  { name: "L5 Senior Sales Executive" },
  { name: "L5 Senior Operations Specialist" },
  { name: "L4 Software Engineer II" },
  { name: "L4 Product Analyst" },
  { name: "L4 Operations Analyst" },
  { name: "L3 Software Engineer I" },
  { name: "L3 Associate Analyst" },
];

const maleNames = [
  "Aarav",
  "Vihaan",
  "Aditya",
  "Sai",
  "Ishaan",
  "Krishna",
  "Arjun",
  "Kabir",
  "Reyansh",
  "Aryan",
  "Aarush",
  "Vivaan",
  "Pranav",
  "Rohan",
  "Dev",
  "Rahul",
  "Karan",
  "Siddharth",
  "Aman",
  "Rishi",
  "Neil",
  "Yash",
  "Dhruv",
  "Ansh",
  "Kunwar",
  "Shaurya",
  "Kshitiz",
  "Tushar",
  "Ayush",
  "Madhav",
  "Kartik",
  "Ganesh",
  "Sanjay",
  "Suresh",
  "Ramesh",
  "Vijay",
  "Anil",
  "Sunil",
  "Rajesh",
  "Sameer",
  "Amit",
  "Nikhil",
  "Vikram",
  "Abhishek",
  "Harsh",
  "Pratham",
  "Utkarsh",
  "Varun",
  "Mayank",
];

const femaleNames = [
  "Ananya",
  "Diya",
  "Priya",
  "Riya",
  "Aadhya",
  "Saanvi",
  "Kavya",
  "Kiara",
  "Myra",
  "Aanya",
  "Pari",
  "Ira",
  "Sara",
  "Avani",
  "Prisha",
  "Shruti",
  "Sneha",
  "Aditi",
  "Pooja",
  "Meera",
  "Neha",
  "Ritu",
  "Swati",
  "Jyoti",
  "Kriti",
  "Shreya",
  "Nisha",
  "Gauri",
  "Tanya",
  "Mehak",
  "Tanvi",
  "Riddhi",
  "Siddhi",
  "Payal",
  "Kajal",
  "Aanchal",
  "Ishita",
  "Bhavna",
  "Divya",
  "Komal",
  "Priyanka",
  "Nidhi",
  "Garima",
  "Sakshi",
  "Mansha",
  "Bhumika",
  "Rashmi",
  "Alka",
];

const allNames = [...maleNames, ...femaleNames];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockCompany(count = 70): {
  subsidiaries: Subsidiary[];
  verticals: Vertical[];
  jobLevels: JobLevel[];
  employees: Employee[];
} {
  const employees: Employee[] = [];
  const subsidiary = "SG Forge Ltd";

  // 1. Separate Admins (10 Admins + 2 Super Admins)
  // E0001: Aarav (super_admin)
  // E0011: Ananya (super_admin)
  // 10 Admins: E0002, E0012 to E0020
  const superAdmins: Employee[] = [
    {
      eid: "E0001",
      name: "Aarav",
      email: "superadmin1@sgforge.com",
      role: "super_admin",
      designation: "",
      vertical: "",
      subsidiary: "",
      managerEid: null,
    },
    {
      eid: "E0011",
      name: "Ananya",
      email: "superadmin2@sgforge.com",
      role: "super_admin",
      designation: "",
      vertical: "",
      subsidiary: "",
      managerEid: null,
    },
  ];

  const admins: Employee[] = [
    {
      eid: "E0002",
      name: "Vihaan",
      email: "it-admin@sgforge.com",
      role: "admin",
      designation: "",
      vertical: "",
      subsidiary: "",
      managerEid: null,
    },
    {
      eid: "E0012",
      name: "Ishaan",
      email: "hr-admin@sgforge.com",
      role: "admin",
      designation: "",
      vertical: "",
      subsidiary: "",
      managerEid: null,
    },
    {
      eid: "E0013",
      name: "Krishna",
      email: "finance-admin@sgforge.com",
      role: "admin",
      designation: "",
      vertical: "",
      subsidiary: "",
      managerEid: null,
    },
    {
      eid: "E0014",
      name: "Arjun",
      email: "security-admin@sgforge.com",
      role: "admin",
      designation: "",
      vertical: "",
      subsidiary: "",
      managerEid: null,
    },
    {
      eid: "E0015",
      name: "Diya",
      email: "ops-admin@sgforge.com",
      role: "admin",
      designation: "",
      vertical: "",
      subsidiary: "",
      managerEid: null,
    },
    {
      eid: "E0016",
      name: "Priya",
      email: "support-admin@sgforge.com",
      role: "admin",
      designation: "",
      vertical: "",
      subsidiary: "",
      managerEid: null,
    },
    {
      eid: "E0017",
      name: "Riya",
      email: "audit-admin@sgforge.com",
      role: "read_only_admin",
      designation: "",
      vertical: "",
      subsidiary: "",
      managerEid: null,
    },
    {
      eid: "E0018",
      name: "Aadhya",
      email: "dev-admin@sgforge.com",
      role: "admin",
      designation: "",
      vertical: "",
      subsidiary: "",
      managerEid: null,
    },
    {
      eid: "E0019",
      name: "Kavya",
      email: "provision-admin@sgforge.com",
      role: "admin",
      designation: "",
      vertical: "",
      subsidiary: "",
      managerEid: null,
    },
    {
      eid: "E0020",
      name: "Kabir",
      email: "billing-admin@sgforge.com",
      role: "admin",
      designation: "",
      vertical: "",
      subsidiary: "",
      managerEid: null,
    },
  ];

  employees.push(...superAdmins);
  employees.push(...admins);

  // 2. Working Corporate Hierarchy (E0003, E0004, E0005, E0006, E0007, E0008, E0009, E0010, E0021+)
  // L12: CEO
  const ceo: Employee = {
    eid: "E0003",
    name: "Sundar Pichai",
    email: "sundar.pichai@sgforge.com",
    role: "user",
    designation: "L12 CEO",
    vertical: "Executive",
    subsidiary,
    managerEid: null,
  };
  employees.push(ceo);

  // L10: VPs
  const vpDeepMind: Employee = {
    eid: "E0004",
    name: "Demis Hassabis",
    email: "demis.hassabis@sgforge.com",
    role: "user",
    designation: "L10 VP of DeepMind",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0003",
  };
  const vpSearch: Employee = {
    eid: "E0025",
    name: "Prabhakar Raghavan",
    email: "prabhakar.raghavan@sgforge.com",
    role: "user",
    designation: "L10 VP of Search",
    vertical: "Product Management",
    subsidiary,
    managerEid: "E0003",
  };
  const vpCloud: Employee = {
    eid: "E0026",
    name: "Thomas Kurian",
    email: "thomas.kurian@sgforge.com",
    role: "user",
    designation: "L10 VP of Cloud",
    vertical: "Sales & Operations",
    subsidiary,
    managerEid: "E0003",
  };
  const vpCFO: Employee = {
    eid: "E0022",
    name: "Ruth Porat",
    email: "ruth.porat@sgforge.com",
    role: "user",
    designation: "L10 CFO & President",
    vertical: "Finance",
    subsidiary,
    managerEid: "E0003",
  };
  employees.push(vpDeepMind, vpSearch, vpCloud, vpCFO);

  // L8: Directors
  const dirResearch: Employee = {
    eid: "E0008",
    name: "Jeff Dean",
    email: "jeff.dean@sgforge.com",
    role: "user",
    designation: "L8 Director of Research",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0004",
  };
  const dirSystems: Employee = {
    eid: "E0009",
    name: "Sanjay Ghemawat",
    email: "sanjay@sgforge.com",
    role: "user",
    designation: "L8 Director of Systems",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0004",
  };
  const dirSearchExp: Employee = {
    eid: "E0010",
    name: "Ben Gomes",
    email: "ben.gomes@sgforge.com",
    role: "user",
    designation: "L8 Director of Search Experience",
    vertical: "Product Management",
    subsidiary,
    managerEid: "E0025",
  };
  const dirInfra: Employee = {
    eid: "E0021",
    name: "Urs Hölzle",
    email: "urs.holzle@sgforge.com",
    role: "user",
    designation: "L8 Director of Infrastructure",
    vertical: "Sales & Operations",
    subsidiary,
    managerEid: "E0026",
  };
  const dirHR: Employee = {
    eid: "E0023",
    name: "Fiona Cicconi",
    email: "fiona.cicconi@sgforge.com",
    role: "user",
    designation: "L8 Director of People Ops",
    vertical: "Human Resources",
    subsidiary,
    managerEid: "E0022",
  };
  employees.push(dirResearch, dirSystems, dirSearchExp, dirInfra, dirHR);

  // L6: Managers
  const mgrCloud: Employee = {
    eid: "E0005",
    name: "Diane Greene",
    email: "diane.greene@sgforge.com",
    role: "user",
    designation: "L6 Cloud Manager",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0021",
  };
  const mgrTechOps: Employee = {
    eid: "E0027",
    name: "Eric Schmidt",
    email: "eric.schmidt@sgforge.com",
    role: "user",
    designation: "L6 Tech Ops Manager",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0021",
  };
  const mgrSearchUI: Employee = {
    eid: "E0028",
    name: "Marissa Mayer",
    email: "marissa.mayer@sgforge.com",
    role: "user",
    designation: "L6 Search UI Manager",
    vertical: "Product Management",
    subsidiary,
    managerEid: "E0010",
  };
  const mgrAds: Employee = {
    eid: "E0029",
    name: "Susan Wojcicki",
    email: "susan.wojcicki@sgforge.com",
    role: "user",
    designation: "L6 Ads Manager",
    vertical: "Product Management",
    subsidiary,
    managerEid: "E0010",
  };
  const mgrRanking: Employee = {
    eid: "E0030",
    name: "Amit Singhal",
    email: "amit.singhal@sgforge.com",
    role: "user",
    designation: "L6 Ranking Manager",
    vertical: "Product Management",
    subsidiary,
    managerEid: "E0010",
  };
  const mgrML: Employee = {
    eid: "E0031",
    name: "Blaise Agüera",
    email: "blaise@sgforge.com",
    role: "user",
    designation: "L6 ML Research Manager",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0008",
  };
  const mgrDeepLearning: Employee = {
    eid: "E0032",
    name: "Ilya Sutskever",
    email: "ilya.sutskever@sgforge.com",
    role: "user",
    designation: "L6 Deep Learning Manager",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0008",
  };
  const mgrNY: Employee = {
    eid: "E0033",
    name: "Corinna Cortes",
    email: "corinna.cortes@sgforge.com",
    role: "user",
    designation: "L6 NY Research Manager",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0009",
  };
  const mgrFinance: Employee = {
    eid: "E0034",
    name: "Hal Varian",
    email: "hal.varian@sgforge.com",
    role: "user",
    designation: "L6 Chief Economist Manager",
    vertical: "Finance",
    subsidiary,
    managerEid: "E0023",
  };
  employees.push(
    mgrCloud,
    mgrTechOps,
    mgrSearchUI,
    mgrAds,
    mgrRanking,
    mgrML,
    mgrDeepLearning,
    mgrNY,
    mgrFinance,
  );

  // L5: Team Leads / Senior ICs
  const leadHinton: Employee = {
    eid: "E0006",
    name: "Geoffrey Hinton",
    email: "geoff.hinton@sgforge.com",
    role: "user",
    designation: "L5 Staff Research Scientist",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0032",
  };
  const leadLeCun: Employee = {
    eid: "E0007",
    name: "Yann LeCun",
    email: "yann.lecun@sgforge.com",
    role: "user",
    designation: "L5 Staff Scientist",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0032",
  };
  const leadBengio: Employee = {
    eid: "E0035",
    name: "Yoshua Bengio",
    email: "yoshua.bengio@sgforge.com",
    role: "user",
    designation: "L5 Staff Scientist",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0032",
  };
  const leadManning: Employee = {
    eid: "E0036",
    name: "Chris Manning",
    email: "chris.manning@sgforge.com",
    role: "user",
    designation: "L5 Staff Scientist",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0031",
  };
  const leadLi: Employee = {
    eid: "E0037",
    name: "Fei-Fei Li",
    email: "feifei.li@sgforge.com",
    role: "user",
    designation: "L5 Staff Scientist",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0031",
  };
  const leadKarpathy: Employee = {
    eid: "E0038",
    name: "Andrej Karpathy",
    email: "andrej.karpathy@sgforge.com",
    role: "user",
    designation: "L5 Staff Engineer",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0032",
  };
  const leadGoodfellow: Employee = {
    eid: "E0039",
    name: "Ian Goodfellow",
    email: "ian.goodfellow@sgforge.com",
    role: "user",
    designation: "L5 Staff Engineer",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0032",
  };
  const leadNg: Employee = {
    eid: "E0040",
    name: "Andrew Ng",
    email: "andrew.ng@sgforge.com",
    role: "user",
    designation: "L5 Staff Scientist",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0028",
  };
  const leadThrun: Employee = {
    eid: "E0041",
    name: "Sebastian Thrun",
    email: "sebastian.thrun@sgforge.com",
    role: "user",
    designation: "L5 Staff Scientist",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0028",
  };
  const leadRossum: Employee = {
    eid: "E0042",
    name: "Guido van Rossum",
    email: "guido@sgforge.com",
    role: "user",
    designation: "L5 Staff Engineer",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0005",
  };
  const leadStroustrup: Employee = {
    eid: "E0043",
    name: "Bjarne Stroustrup",
    email: "bjarne@sgforge.com",
    role: "user",
    designation: "L5 Staff Engineer",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0027",
  };
  const leadThompson: Employee = {
    eid: "E0044",
    name: "Ken Thompson",
    email: "ken@sgforge.com",
    role: "user",
    designation: "L5 Staff Engineer",
    vertical: "Engineering",
    subsidiary,
    managerEid: "E0033",
  };
  employees.push(
    leadHinton,
    leadLeCun,
    leadBengio,
    leadManning,
    leadLi,
    leadKarpathy,
    leadGoodfellow,
    leadNg,
    leadThrun,
    leadRossum,
    leadStroustrup,
    leadThompson,
  );

  // Remaining list of managers and leads to assign reporting ICs to
  const engLeads = [
    leadHinton,
    leadLeCun,
    leadBengio,
    leadManning,
    leadLi,
    leadKarpathy,
    leadGoodfellow,
    leadNg,
    leadThrun,
    leadRossum,
    leadStroustrup,
    leadThompson,
  ];
  const prodLeads = [mgrSearchUI, mgrAds, mgrRanking];
  const opsSalesLeads = [vpCloud, dirInfra, mgrCloud, mgrTechOps];
  const hrManagers = [dirHR];
  const financeManagers = [mgrFinance];

  // 3. Generate Individual Contributors (E0045 to E0085)
  let nameIndex = 0;
  for (let i = 45; i <= 85; i++) {
    const eid = `E${String(i).padStart(4, "0")}`;
    const name = allNames[nameIndex % allNames.length];
    nameIndex++;
    const email = `${name.toLowerCase()}.${i}@sgforge.com`;

    // Assign vertical and designation
    let vertical = "Engineering";
    let designation = "L4 Software Engineer II";
    let managerEid = getRandomElement(engLeads).eid;

    const randVal = Math.random();
    if (randVal < 0.6) {
      // Engineering (60%)
      vertical = "Engineering";
      designation = Math.random() < 0.5 ? "L4 Software Engineer II" : "L3 Software Engineer I";
      managerEid = getRandomElement(engLeads).eid;
    } else if (randVal < 0.75) {
      // Product Management (15%)
      vertical = "Product Management";
      designation = Math.random() < 0.5 ? "L4 Product Analyst" : "L3 Associate Analyst";
      managerEid = getRandomElement(prodLeads).eid;
    } else if (randVal < 0.9) {
      // Sales & Operations (15%)
      vertical = "Sales & Operations";
      designation = Math.random() < 0.5 ? "L4 Operations Analyst" : "L3 Associate Analyst";
      managerEid = getRandomElement(opsSalesLeads).eid;
    } else if (randVal < 0.95) {
      // Human Resources (5%)
      vertical = "Human Resources";
      designation = "L4 Operations Analyst";
      managerEid = getRandomElement(hrManagers).eid;
    } else {
      // Finance (5%)
      vertical = "Finance";
      designation = "L4 Operations Analyst";
      managerEid = getRandomElement(financeManagers).eid;
    }

    employees.push({
      eid,
      name,
      email,
      role: "user",
      designation,
      vertical,
      subsidiary,
      managerEid,
    });
  }

  return {
    subsidiaries,
    verticals,
    jobLevels,
    employees,
  };
}

function writeCSV(employees: Employee[], outputPath: string) {
  const headers = [
    "EID",
    "Name",
    "Email",
    "Role",
    "Designation",
    "Vertical",
    "Subsidiary",
    "Manager EID",
  ];
  const rows = employees.map((emp) => [
    emp.eid,
    `"${emp.name}"`,
    emp.email,
    emp.role,
    `"${emp.designation}"`,
    `"${emp.vertical}"`,
    `"${emp.subsidiary}"`,
    emp.managerEid || "",
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  fs.writeFileSync(outputPath, csvContent, "utf-8");
}

function writeJSON(data: any, outputPath: string) {
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");
}

const outputDir = path.join(__dirname);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const mockData = generateMockCompany();

writeJSON(mockData, path.join(outputDir, "company_data.json"));
writeCSV(mockData.employees, path.join(outputDir, "company_data.csv"));

console.log(`Generated mock dataset:`);
console.log(`- JSON format: test/dummy-data/company_data.json`);
console.log(`- CSV format:  test/dummy-data/company_data.csv`);
