import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { assertTransition, calculateLine, csvCell, deliveryTransitions, money } from "../src/dropshipping/domain.js";

const migration = fs.readFileSync(new URL("../supabase/migrations/010_icare_dropshipping.sql", import.meta.url), "utf8");
const portal = fs.readFileSync(new URL("../src/routes/dropshipping.js", import.meta.url), "utf8");
const admin = fs.readFileSync(new URL("../src/routes/adminDropshipping.js", import.meta.url), "utf8");

test("pending marketer access is guarded by approved profile",()=>assert.match(portal,/profileFor\(req, \{ approved: true \}\)/));
test("products query only returns enabled products",()=>assert.match(portal,/enabled=true/));
test("own orders are scoped by dropshipper derived from the profile",()=>assert.match(portal,/dropshipper_id=\$2/));
test("tenant is sourced from req.companyId",()=>{assert.doesNotMatch(portal,/req\.body\.company/);assert.match(portal,/req\.companyId/)});
test("browser profit is not accepted",()=>{assert.doesNotMatch(portal,/req\.body\.(profit|marketerProfit)/);assert.match(portal,/calculateLine/)});
test("selling price bounds are server enforced",()=>assert.match(portal,/customerPrice < minimum \|\| customerPrice > maximum/));
test("stock is locked and validated",()=>{assert.match(portal,/for update/);assert.match(portal,/exceeds available stock/)});
test("valid order transitions are explicit",()=>{assert.doesNotThrow(()=>assertTransition("new","confirmed"));assert.doesNotThrow(()=>assertTransition("delivered","returned"))});
test("invalid order transitions are rejected",()=>assert.throws(()=>assertTransition("new","delivered"),/Invalid order transition/));
test("cancelled and returned statuses are terminal",()=>{assert.deepEqual(deliveryTransitions.cancelled,[]);assert.deepEqual(deliveryTransitions.returned,[])});
test("profit calculation includes fixed and percentage fees",()=>assert.deepEqual(calculateLine({quantity:2,customerUnitPrice:"100.00",dropshippingUnitPrice:"60.00",fixedFee:"5.00",percentageFee:10}),{sellingTotal:"200.00",costTotal:"120.00",fees:"25.00",profit:"55.00"}));
test("money rejects floating point and excess precision inputs",()=>{assert.equal(money("12.30"),"12.30");assert.throws(()=>money("1.234"));assert.throws(()=>money(-1))});
test("wallet mutations use transactions and row locks",()=>{assert.match(portal,/withDropshippingTransaction/);assert.match(admin,/for update/)});
test("ledger entries have immutable idempotency keys",()=>{assert.match(migration,/unique\(company_id,idempotency_key\)/);assert.match(admin,/order:\$\{order\.id\}:approved/)});
test("only one active withdrawal is allowed",()=>assert.match(migration,/uq_withdrawal_active[\s\S]*status in \('pending','approved'\)/));
test("withdrawal overspending is guarded under wallet lock",()=>{assert.match(portal,/Insufficient available balance/);assert.match(portal,/select \* from public\.dropshipper_wallets[\s\S]*for update/)});
test("CSV export neutralizes spreadsheet formulas",()=>{assert.equal(csvCell("=2+2"),"\"'=2+2\"");assert.equal(csvCell("safe"),'"safe"')});
test("all financial tables carry tenant scope",()=>{for(const table of ["dropshipping_orders","dropshipping_order_items","dropshipper_wallets","dropshipper_transactions","withdrawal_requests"])assert.match(migration,new RegExp(`create table if not exists public\\.${table} \\([\\s\\S]*?company_id text not null`))});
test("status history and activity auditing are append-only inserts",()=>{assert.match(admin,/insert into public\.dropshipping_order_status_history/);assert.match(admin,/insert into public\.company_activity_logs/)});

