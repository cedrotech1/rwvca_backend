import db from "../database/models/index.js";

const ABOUT_FACTS = {
  intro:
    "RWVCA is a national association representing stakeholders across Rwanda's wood value chain. It promotes collaboration, advocacy, and sustainable development by bringing together actors from forestry, processing, and trade to address sector challenges and advance members' interests.",
  objective:
    "Strengthen Rwanda's wood value chain through membership, training, market access, and advocacy for sustainable forest and furniture industries.",
  mission:
    "RWVCA unites forest owners, furniture makers, and wood-product businesses to grow a sustainable wood value chain in Rwanda.",
  vision:
    "A competitive, inclusive, and environmentally responsible wood industry that creates jobs and quality products.",
};

const DEFAULT_CONTACT = {
  email: "info@rwvca.org.rw",
  phone: "+250 791 226 612",
  address: "NR5, Kicukiro, Gahanga KK 15 Rd",
};

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value = "", length = 280) {
  const text = stripHtml(value);
  if (text.length <= length) return text;
  return `${text.slice(0, length)}...`;
}

function formatDate(value) {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(value);
  }
}

function lineList(items, emptyLabel) {
  if (!items.length) return `- ${emptyLabel}`;
  return items.map((item) => `- ${item}`).join("\n");
}

/**
 * Live public-site facts for IGITI (no repo required).
 * Pulled from CMS tables so answers stay accurate after publish.
 */
export async function buildPublicKnowledgePack() {
  const [
    company,
    events,
    programs,
    platforms,
    membershipCategories,
    membershipServices,
    membershipApp,
    orgUnits,
    memberProducts,
  ] = await Promise.all([
    db.CompanyInfo.findOne({ order: [["id", "DESC"]] }).catch(() => null),
    db.Events.findAll({
      where: { status: "published" },
      order: [["date", "DESC"]],
      limit: 12,
      attributes: ["id", "title", "description", "date"],
    }).catch(() => []),
    db.Programs.findAll({
      where: { status: "active" },
      order: [["id", "DESC"]],
      limit: 12,
      attributes: ["id", "title", "description", "category", "application_deadline", "application_link"],
    }).catch(() => []),
    db.Platforms.findAll({
      where: { status: "published" },
      order: [["display_order", "ASC"], ["id", "ASC"]],
      limit: 10,
      attributes: ["id", "name", "description"],
    }).catch(() => []),
    db.MembershipCategories.findAll({
      include: [{ model: db.Fees, as: "fees" }],
      order: [["display_order", "ASC"], ["category_id", "ASC"]],
    }).catch(() => []),
    db.Services.findAll({
      order: [["display_order", "ASC"], ["service_id", "ASC"]],
      limit: 20,
    }).catch(() => []),
    db.MembershipApplicationSettings.findOne({
      where: { is_active: 1 },
      order: [["id", "DESC"]],
    }).catch(() => null),
    db.OrganizationStructure.findAll({
      where: { is_active: 1 },
      order: [["display_order", "ASC"], ["id", "ASC"]],
      attributes: ["unit_name", "title", "level"],
      limit: 20,
    }).catch(() => []),
    db.MemberProducts.findAll({
      where: { is_active: 1 },
      order: [["product_id", "DESC"]],
      limit: 10,
      attributes: ["product_name", "company_name", "description"],
    }).catch(() => []),
  ]);

  const contact = {
    companyName: company?.company_name || "Rwanda Wood Value Chain Association (RWVCA)",
    email: company?.email || DEFAULT_CONTACT.email,
    phone: company?.phone || DEFAULT_CONTACT.phone,
    address: company?.address || DEFAULT_CONTACT.address,
    website: company?.website || "https://rwvca.org.rw",
  };

  const eventLines = (events || []).map((event) => {
    const plain = event.get ? event.get({ plain: true }) : event;
    return `${plain.title} (date: ${formatDate(plain.date)})${
      plain.description ? ` — ${truncate(plain.description, 180)}` : ""
    }`;
  });

  const programLines = (programs || []).map((program) => {
    const plain = program.get ? program.get({ plain: true }) : program;
    const deadline = plain.application_deadline
      ? ` deadline ${formatDate(plain.application_deadline)}`
      : "";
    return `${plain.title} [${plain.category || "program"}${deadline}] — ${truncate(
      plain.description,
      180
    )}`;
  });

  const platformLines = (platforms || []).map((platform) => {
    const plain = platform.get ? platform.get({ plain: true }) : platform;
    const title = plain.name || `Platform #${plain.id}`;
    return `${title}${plain.description ? ` — ${truncate(plain.description, 160)}` : ""}`;
  });

  const membershipLines = (membershipCategories || []).map((category) => {
    const plain = category.get ? category.get({ plain: true }) : category;
    const fee = plain.fees?.[0];
    const amount = fee?.fee_amount != null
      ? ` — annual fee about ${Number(fee.fee_amount).toLocaleString("en-US")} RWF`
      : "";
    return `${plain.category_name}${amount}${
      plain.description ? ` — ${truncate(plain.description, 160)}` : ""
    }`;
  });

  const serviceLines = (membershipServices || []).map((service) => {
    const plain = service.get ? service.get({ plain: true }) : service;
    return plain.service_name || plain.name;
  }).filter(Boolean);

  const orgLines = (orgUnits || []).map((unit) => {
    const plain = unit.get ? unit.get({ plain: true }) : unit;
    return `${plain.unit_name || plain.title}${plain.level ? ` (${plain.level})` : ""}`;
  });

  const productLines = (memberProducts || []).map((product) => {
    const plain = product.get ? product.get({ plain: true }) : product;
    const title = plain.product_name || "Member product";
    const company = plain.company_name ? ` (${plain.company_name})` : "";
    return `${title}${company}${plain.description ? ` — ${truncate(plain.description, 120)}` : ""}`;
  });

  const applicationLink = membershipApp?.application_link
    ? String(membershipApp.application_link)
    : "";

  return `
## RWVCA website knowledge pack (authoritative — use this; do not invent facts)

### Who we are
- Full name: Rwanda Wood Value Chain Association (RWVCA)
- ${ABOUT_FACTS.intro}
- Objective: ${ABOUT_FACTS.objective}
- Mission: ${ABOUT_FACTS.mission}
- Vision: ${ABOUT_FACTS.vision}

### Contact
- Organization: ${contact.companyName}
- Email: ${contact.email}
- Phone: ${contact.phone}
- Address: ${contact.address}
- Website: ${contact.website}
- Visitors can also use the Contact page form on the public website.

### Public pages to recommend
- Home, About Us, Programs, Membership / Join Us, Members Products, Events, Gallery, Platforms, Contact, Login (staff only)

### Membership
${lineList(membershipLines, "Membership categories are managed in the Membership page; invite visitors to open Membership or call the contact phone.")}
- Membership benefits / services listed on the site:
${lineList(serviceLines, "See the Membership page for benefit details.")}
${applicationLink ? `- Membership application link: ${applicationLink}` : "- Membership application: open the Membership page and use Become a Member when the link is published, or call the contact phone."}
- Typical join guidance: read Membership, then call ${contact.phone} or email ${contact.email} for guidance.

### Published events (including promotions / tests currently live on the site)
${lineList(eventLines, "No published events right now. Suggest the Events page for updates.")}

### Active programs
${lineList(programLines, "No active programs listed right now. Suggest the Programs page.")}

### Platforms
${lineList(platformLines, "No published platforms right now. Suggest the Platforms section of the website.")}

### Member products (sample)
${lineList(productLines, "Member products appear on the Members Products page when published.")}

### Organization structure (high level)
${lineList(orgLines, "RWVCA is governed through its General Assembly, Executive Committee, Permanent Secretariat, and support organs — see About Us.")}
`.trim();
}
