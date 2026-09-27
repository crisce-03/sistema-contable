const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/load-ts.cjs");
const previous = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY };
before(() => { process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"; process.env.SUPABASE_SECRET_KEY = "test-server-key"; });
after(() => {
  for (const [key, value] of [["NEXT_PUBLIC_SUPABASE_URL", previous.url], ["SUPABASE_SECRET_KEY", previous.key]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
function harness(valid = true) {
  const calls = [];
  const sdk = { createClient: () => ({
    auth: { getUser: async token => { calls.push({ token }); return valid ? { data: { user: { id: "authenticated-user" } }, error: null } : { data: { user: null }, error: new Error("invalid") }; } },
    rpc: async (name, args) => { calls.push({ name, args }); return { data: [], error: null }; },
  }) };
  return { route: loadTs("app/api/accounting/route.ts", { "server-only": {}, "@supabase/supabase-js": sdk }), calls };
}
test("API rejects unauthenticated requests without touching the database", async () => {
  const { route, calls } = harness();
  const response = await route.GET(new Request("http://localhost/api/accounting"));
  assert.equal(response.status, 401); assert.deepEqual(calls, []);
});
test("API verifies bearer token with getUser before any accounting RPC", async () => {
  const { route, calls } = harness(false);
  const response = await route.GET(new Request("http://localhost/api/accounting?archives=1", { headers: { Authorization: "Bearer forged" } }));
  assert.equal(response.status, 401); assert.deepEqual(calls, [{ token: "forged" }]);
});
test("archive access always uses verified user identity, ignoring supplied user IDs", async () => {
  const { route, calls } = harness();
  const response = await route.GET(new Request("http://localhost/api/accounting?archives=1&p_user_id=victim", { headers: { Authorization: "Bearer verified" } }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls[1], { name: "accounting_archives", args: { p_user_id: "authenticated-user" } });
  assert.equal(response.headers.get("cache-control"), "no-store, private");
});
test("write requests require a current book revision and reject malformed data", async () => {
  const { route, calls } = harness();
  const response = await route.POST(new Request("http://localhost/api/accounting", {
    method: "POST", headers: { Authorization: "Bearer verified", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "period", data: { anio: 2026 }, userId: "victim" }),
  }));
  assert.equal(response.status, 400); assert.equal(calls.length, 1);
});
