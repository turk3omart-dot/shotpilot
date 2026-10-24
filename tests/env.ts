process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://shotpilot:shotpilot@localhost:5432/shotpilot_test";
process.env.SHOTPILOT_AI_PROVIDER = "heuristic";
delete process.env.ANTHROPIC_API_KEY;
