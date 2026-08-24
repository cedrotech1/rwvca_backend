import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { canManageMembers } from "../utils/roleHelpers.js";

const sequelize = db.sequelize;
const UMUSANZU_YEAR = 2025;
const SORTABLE = [
  "id",
  "company_name",
  "owner_name",
  "membership_category",
  "membership_status",
  "registration_status",
  "registration_paid_date",
  "date_joined",
];

const DETAIL_INCLUDE = [
  { model: db.ForestDetails, as: "forest_details_member_id" },
  { model: db.FurnitureDetails, as: "furniture_details_member_id" },
  { model: db.HarvestingDetails, as: "harvesting_details_member_id" },
  { model: db.NurseryDetails, as: "nursery_details_member_id" },
  { model: db.SalesDetails, as: "sales_details_member_id" },
  {
    model: db.MemberYearPayments,
    as: "member_year_payments_member_id",
    include: [{ model: db.MembershipYears, as: "year", attributes: ["id", "year_value", "label"] }],
  },
  { model: db.MembershipCategoriesPlatform, as: "platformCategory", attributes: ["id", "name"] },
];

function denyIfCannotManage(req, res) {
  if (!canManageMembers(req.user.role)) {
    fail(res, "Access denied", 403);
    return true;
  }
  return false;
}

function normalizePaidDate(status, dateValue, fallback) {
  if (status !== "Paid") return null;
  return dateValue || fallback || null;
}

function memberFields(body) {
  const registration_status = body.registration_status || "Not Paid";
  return {
    company_name: body.company_name || null,
    owner_name: body.owner_name || null,
    shareholder: body.shareholder === undefined || body.shareholder === "" ? 0 : Number(body.shareholder),
    gender: body.gender || null,
    rdb_certificate: body.rdb_certificate || null,
    tin: body.tin || null,
    national_id: body.national_id || null,
    province: body.province || null,
    district: body.district || null,
    role: body.role || null,
    has_rwvca_role: Number(body.has_rwvca_role) === 1 ? 1 : 0,
    rwvca_role: Number(body.has_rwvca_role) === 1 ? (body.rwvca_role || null) : null,
    membership_category_platform_id: body.membership_category_platform_id || null,
    membership_category: body.membership_category,
    membership_status: body.membership_status || "Not Paid",
    registration_status,
    registration_paid_date: normalizePaidDate(
      registration_status,
      body.registration_paid_date,
      body.date_joined
    ),
    employees_women: Number(body.employees_women || 0),
    employees_men: Number(body.employees_men || 0),
    employees_pwd: Number(body.employees_pwd || 0),
    phone: body.phone || null,
    email: body.email || null,
    date_joined: body.date_joined || new Date().toISOString().slice(0, 10),
    is_active: body.is_active === undefined || body.is_active === "" ? 1 : Number(body.is_active),
  };
}

async function saveYearPayments(memberId, yearPayments = {}, membershipStatus) {
  const umusanzu = await db.MembershipYears.findOne({ where: { year_value: UMUSANZU_YEAR } });
  const entries = yearPayments && typeof yearPayments === "object" ? Object.entries(yearPayments) : [];
  for (const [yearId, status] of entries) {
    const id = Number(yearId);
    if (umusanzu && id === Number(umusanzu.id)) continue;
    if (!status) {
      await db.MemberYearPayments.destroy({ where: { member_id: memberId, year_id: id } });
      continue;
    }
    const [row] = await db.MemberYearPayments.findOrCreate({
      where: { member_id: memberId, year_id: id },
      defaults: { payment_status: status },
    });
    await row.update({ payment_status: status });
  }
  if (umusanzu && membershipStatus) {
    const [row] = await db.MemberYearPayments.findOrCreate({
      where: { member_id: memberId, year_id: umusanzu.id },
      defaults: { payment_status: membershipStatus },
    });
    await row.update({ payment_status: membershipStatus });
  }
}

async function saveCategoryDetails(memberId, body) {
  const categoryId = Number(body.membership_category_platform_id || 0);
  await Promise.all([
    db.NurseryDetails.destroy({ where: { member_id: memberId } }),
    db.ForestDetails.destroy({ where: { member_id: memberId } }),
    db.HarvestingDetails.destroy({ where: { member_id: memberId } }),
    db.FurnitureDetails.destroy({ where: { member_id: memberId } }),
    db.SalesDetails.destroy({ where: { member_id: memberId } }),
  ]);
  if (categoryId === 1) {
    await db.NurseryDetails.create({
      member_id: memberId,
      land_size: body.land_size || null,
      seed_type: body.seed_type || null,
      seed_quantity: body.seed_quantity || null,
      land_ownership: body.land_ownership || null,
    });
  } else if (categoryId === 2) {
    await db.ForestDetails.create({
      member_id: memberId,
      forest_area: body.forest_area || null,
      forest_type: body.forest_type || null,
    });
  } else if (categoryId === 3) {
    await db.HarvestingDetails.create({
      member_id: memberId,
      cluster: body.harvesting_cluster || body.cluster || null,
    });
  } else if (categoryId === 4) {
    await db.FurnitureDetails.create({
      member_id: memberId,
      products: body.furniture_products || body.products || null,
      cluster: body.furniture_cluster || null,
    });
  } else if (categoryId === 5) {
    await db.SalesDetails.create({
      member_id: memberId,
      products: body.sales_products || body.products || null,
      cluster: body.sales_cluster || body.cluster || null,
    });
  }
}

async function loadMember(id) {
  return db.Members.findByPk(id, { include: DETAIL_INCLUDE });
}

function groupCount(rows, key = "count") {
  return (rows || []).map((row) => ({
    ...row,
    count: Number(row[key] || 0),
  }));
}

export const getMemberMeta = asyncHandler(async (req, res) => {
  const [years, platforms] = await Promise.all([
    db.MembershipYears.findAll({ where: { is_active: 1 }, order: [["year_value", "ASC"]] }),
    db.MembershipCategoriesPlatform.findAll({ order: [["id", "ASC"]] }),
  ]);
  return ok(res, { years, platforms, umusanzu_year: UMUSANZU_YEAR });
});

export const getMembers = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req, { page: 1, limit: 50, max: 500 });
  const where = {};
  const search = String(req.query.search || "").trim();
  if (search) {
    where[Op.or] = [
      { company_name: { [Op.iLike]: `%${search}%` } },
      { owner_name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } },
    ];
  }
  if (req.query.membership_status) where.membership_status = req.query.membership_status;
  if (req.query.registration_status) where.registration_status = req.query.registration_status;
  if (req.query.membership_category) where.membership_category = req.query.membership_category;
  if (req.query.membership_category_platform_id) {
    where.membership_category_platform_id = req.query.membership_category_platform_id;
  }
  if (req.query.is_active !== undefined && req.query.is_active !== "") {
    where.is_active = Number(req.query.is_active);
  }
  if (req.query.year_id && req.query.year_payment_status) {
    const paid = await db.MemberYearPayments.findAll({
      attributes: ["member_id"],
      where: {
        year_id: req.query.year_id,
        payment_status: req.query.year_payment_status,
      },
      raw: true,
    });
    where.id = { [Op.in]: paid.map((row) => row.member_id).concat(0) };
  }

  const sortBy = SORTABLE.includes(String(req.query.sort_by)) ? req.query.sort_by : "date_joined";
  const sortOrder = String(req.query.sort_order || "").toUpperCase() === "ASC" ? "ASC" : "DESC";

  const { rows, count } = await db.Members.findAndCountAll({
    where,
    include: [{ model: db.MembershipCategoriesPlatform, as: "platformCategory", attributes: ["id", "name"] }],
    order: [[sortBy, sortOrder]],
    limit,
    offset,
    distinct: true,
  });

  const [total, paid, active] = await Promise.all([
    db.Members.count(),
    db.Members.count({ where: { membership_status: "Paid" } }),
    db.Members.count({ where: { is_active: 1 } }),
  ]);

  return ok(res, {
    items: rows,
    pagination: paginationMeta(count, page, limit),
    summary: { total, paid, active, showing: count },
  });
});

export const getMember = asyncHandler(async (req, res) => {
  const member = await loadMember(req.params.id);
  if (!member) return fail(res, "Member not found", 404);
  return ok(res, member);
});

export const createMember = asyncHandler(async (req, res) => {
  if (denyIfCannotManage(req, res)) return;
  if (!req.body.company_name || !req.body.owner_name) return fail(res, "company_name and owner_name are required");
  if (!req.body.membership_category) return fail(res, "membership_category is required");
  if (!req.body.membership_category_platform_id) return fail(res, "membership_category_platform_id is required");
  const member = await db.Members.create(memberFields(req.body));
  await saveYearPayments(member.id, req.body.year_payments, member.membership_status);
  await saveCategoryDetails(member.id, req.body);
  await createLog(req.user.id, "create_member", `Created member #${member.id}`);
  return created(res, await loadMember(member.id), "Member added successfully");
});

export const updateMember = asyncHandler(async (req, res) => {
  if (denyIfCannotManage(req, res)) return;
  const member = await db.Members.findByPk(req.params.id);
  if (!member) return fail(res, "Member not found", 404);
  if (!req.body.membership_category) return fail(res, "membership_category is required");
  await member.update(memberFields(req.body));
  await saveYearPayments(member.id, req.body.year_payments, req.body.membership_status || member.membership_status);
  await saveCategoryDetails(member.id, req.body);
  await createLog(req.user.id, "update_member", `Updated member #${member.id}`);
  return ok(res, await loadMember(member.id), "Member updated successfully");
});

export const deleteMember = asyncHandler(async (req, res) => {
  if (denyIfCannotManage(req, res)) return;
  const member = await db.Members.findByPk(req.params.id);
  if (!member) return fail(res, "Member not found", 404);
  await Promise.all([
    db.NurseryDetails.destroy({ where: { member_id: member.id } }),
    db.ForestDetails.destroy({ where: { member_id: member.id } }),
    db.HarvestingDetails.destroy({ where: { member_id: member.id } }),
    db.FurnitureDetails.destroy({ where: { member_id: member.id } }),
    db.SalesDetails.destroy({ where: { member_id: member.id } }),
    db.MemberYearPayments.destroy({ where: { member_id: member.id } }),
  ]);
  await member.destroy();
  await createLog(req.user.id, "delete_member", `Deleted member #${member.id}`);
  return ok(res, null, "Member deleted");
});

export const upsertMemberYearPayment = asyncHandler(async (req, res) => {
  if (denyIfCannotManage(req, res)) return;
  const member = await db.Members.findByPk(req.params.id);
  if (!member) return fail(res, "Member not found", 404);
  const year_id = req.body.year_id;
  if (!year_id) return fail(res, "year_id is required");
  await saveYearPayments(member.id, { [year_id]: req.body.payment_status }, member.membership_status);
  const payment = await db.MemberYearPayments.findOne({ where: { member_id: member.id, year_id } });
  return ok(res, payment, "Member year payment updated");
});

export const getMemberStatistics = asyncHandler(async (req, res) => {
  const now = new Date();
  const selectedYear = Number(req.query.payment_year) || UMUSANZU_YEAR;
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const yearAgo = new Date(now);
  yearAgo.setMonth(yearAgo.getMonth() - 12);

  const [
    total_members,
    active_members,
    by_category,
    by_status,
    by_registration,
    rwvca_role_count,
    yearPaymentRows,
    selectedYearRows,
    by_province,
    by_district,
    by_month,
    by_gender,
    shareholder,
    employeesRow,
    recent_members,
    this_year,
    last_year,
    years,
  ] = await Promise.all([
    db.Members.count(),
    db.Members.count({ where: { is_active: 1 } }),
    db.MembershipCategoriesPlatform.findAll({
      attributes: [
        "id",
        "name",
        [sequelize.fn("count", sequelize.col("members.id")), "count"],
      ],
      include: [{ model: db.Members, as: "members", attributes: [], required: false }],
      group: ["MembershipCategoriesPlatform.id", "MembershipCategoriesPlatform.name"],
      order: [[sequelize.fn("count", sequelize.col("members.id")), "DESC"]],
      raw: true,
    }).catch(async () => {
      const rows = await db.Members.findAll({
        attributes: [
          "membership_category_platform_id",
          [sequelize.fn("count", sequelize.col("id")), "count"],
        ],
        group: ["membership_category_platform_id"],
        raw: true,
      });
      const platforms = await db.MembershipCategoriesPlatform.findAll({ raw: true });
      return platforms.map((item) => ({
        name: item.name,
        count: Number(rows.find((row) => Number(row.membership_category_platform_id) === Number(item.id))?.count || 0),
      }));
    }),
    db.Members.findAll({
      attributes: ["membership_status", [sequelize.fn("count", sequelize.col("id")), "count"]],
      group: ["membership_status"],
      raw: true,
    }),
    db.Members.findAll({
      attributes: ["registration_status", [sequelize.fn("count", sequelize.col("id")), "count"]],
      group: ["registration_status"],
      raw: true,
    }),
    db.Members.count({ where: { has_rwvca_role: 1 } }),
    db.MemberYearPayments.findAll({
      attributes: ["payment_status", [sequelize.fn("count", sequelize.col("MemberYearPayments.id")), "count"]],
      include: [{ model: db.MembershipYears, as: "year", attributes: ["year_value"] }],
      group: ["payment_status", "year.id", "year.year_value"],
      raw: true,
      nest: true,
    }).catch(() => []),
    db.MemberYearPayments.findAll({
      attributes: ["payment_status", [sequelize.fn("count", sequelize.col("MemberYearPayments.id")), "count"]],
      include: [{
        model: db.MembershipYears,
        as: "year",
        attributes: [],
        where: { year_value: selectedYear },
      }],
      group: ["payment_status"],
      raw: true,
    }).catch(() => []),
    db.Members.findAll({
      attributes: ["province", [sequelize.fn("count", sequelize.col("id")), "count"]],
      where: { province: { [Op.ne]: null } },
      group: ["province"],
      order: [[sequelize.fn("count", sequelize.col("id")), "DESC"]],
      limit: 10,
      raw: true,
    }),
    db.Members.findAll({
      attributes: ["district", [sequelize.fn("count", sequelize.col("id")), "count"]],
      where: { district: { [Op.ne]: null } },
      group: ["district"],
      order: [[sequelize.fn("count", sequelize.col("id")), "DESC"]],
      limit: 15,
      raw: true,
    }),
    db.Members.findAll({
      attributes: [
        [sequelize.fn("to_char", sequelize.col("date_joined"), "YYYY-MM"), "month"],
        [sequelize.fn("count", sequelize.col("id")), "count"],
      ],
      where: { date_joined: { [Op.gte]: yearAgo.toISOString().slice(0, 10) } },
      group: [sequelize.fn("to_char", sequelize.col("date_joined"), "YYYY-MM")],
      order: [[sequelize.fn("to_char", sequelize.col("date_joined"), "YYYY-MM"), "ASC"]],
      raw: true,
    }).catch(() => []),
    db.Members.findAll({
      attributes: ["gender", [sequelize.fn("count", sequelize.col("id")), "count"]],
      group: ["gender"],
      raw: true,
    }),
    db.Members.findAll({
      attributes: ["shareholder", [sequelize.fn("count", sequelize.col("id")), "count"]],
      group: ["shareholder"],
      raw: true,
    }),
    db.Members.findOne({
      attributes: [
        [sequelize.fn("coalesce", sequelize.fn("sum", sequelize.col("employees_women")), 0), "women"],
        [sequelize.fn("coalesce", sequelize.fn("sum", sequelize.col("employees_men")), 0), "men"],
        [sequelize.fn("coalesce", sequelize.fn("sum", sequelize.col("employees_pwd")), 0), "pwd"],
      ],
      raw: true,
    }),
    db.Members.count({ where: { date_joined: { [Op.gte]: monthAgo.toISOString().slice(0, 10) } } }),
    db.Members.count({
      where: sequelize.where(sequelize.fn("date_part", "year", sequelize.col("date_joined")), now.getFullYear()),
    }),
    db.Members.count({
      where: sequelize.where(sequelize.fn("date_part", "year", sequelize.col("date_joined")), now.getFullYear() - 1),
    }),
    db.MembershipYears.findAll({ where: { is_active: 1 }, order: [["year_value", "ASC"]] }),
  ]);

  const yearMap = {};
  (yearPaymentRows || []).forEach((row) => {
    const year = Number(row.year?.year_value || row["year.year_value"] || 0);
    if (!year) return;
    if (!yearMap[year]) yearMap[year] = { year, Paid: 0, Partial: 0, "Not Paid": 0, total: 0 };
    const status = row.payment_status;
    const count = Number(row.count || 0);
    if (yearMap[year][status] !== undefined) yearMap[year][status] = count;
    yearMap[year].total += count;
  });
  const by_year_payments = Object.values(yearMap).sort((a, b) => b.year - a.year);

  const selected_year_payments = { Paid: 0, Partial: 0, "Not Paid": 0, total: 0 };
  (selectedYearRows || []).forEach((row) => {
    const status = row.payment_status;
    const count = Number(row.count || 0);
    if (selected_year_payments[status] !== undefined) selected_year_payments[status] = count;
    selected_year_payments.total += count;
  });

  const paidCount = Number((by_status || []).find((row) => row.membership_status === "Paid")?.count || 0);
  const registrationPaid = Number((by_registration || []).find((row) => row.registration_status === "Paid")?.count || 0);
  let growth_rate = 0;
  if (last_year > 0) growth_rate = ((this_year - last_year) / last_year) * 100;
  else if (this_year > 0) growth_rate = 100;

  const districtRows = groupCount(by_district).map((row) => ({
    ...row,
    percent: total_members ? Math.round((row.count / total_members) * 1000) / 10 : 0,
    level: total_members && (row.count / total_members) >= 0.1 ? "High" : total_members && (row.count / total_members) >= 0.05 ? "Medium" : "Low",
  }));

  return ok(res, {
    umusanzu_year: UMUSANZU_YEAR,
    selected_year: selectedYear,
    available_years: years,
    total_members,
    active_members,
    inactive_members: Math.max(0, total_members - active_members),
    recent_members,
    this_year,
    last_year,
    growth_rate: Math.round(growth_rate * 100) / 100,
    active_percentage: total_members ? Math.round((active_members / total_members) * 1000) / 10 : 0,
    paid_percentage: total_members ? Math.round((paidCount / total_members) * 1000) / 10 : 0,
    registration_paid_percentage: total_members ? Math.round((registrationPaid / total_members) * 1000) / 10 : 0,
    rwvca_role_count,
    by_category: groupCount(by_category).map((row) => ({ name: row.name, count: row.count })),
    by_status: groupCount(by_status),
    by_registration: groupCount(by_registration),
    by_year_payments,
    selected_year_payments,
    by_province: groupCount(by_province),
    by_district: districtRows,
    by_month: groupCount(by_month),
    by_gender: groupCount(by_gender),
    shareholder: groupCount(shareholder),
    employees: {
      women: Number(employeesRow?.women || 0),
      men: Number(employeesRow?.men || 0),
      pwd: Number(employeesRow?.pwd || 0),
    },
  });
});
