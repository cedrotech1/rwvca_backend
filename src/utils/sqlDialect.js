import { col, fn } from "sequelize";

export function isMysql(sequelize) {
  return sequelize.getDialect() === "mysql";
}

export function monthExpr(sequelize, column = "created_at") {
  if (isMysql(sequelize)) {
    return fn("date_format", col(column), "%Y-%m-01");
  }
  return fn("date_trunc", "month", col(column));
}
