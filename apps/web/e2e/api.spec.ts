import { expect, test } from "@playwright/test";

test.describe("JSON API v1", () => {
  test("requires authentication", async ({ request }) => {
    const res = await request.get("/api/v1/me");
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  test("rejects bad credentials without revealing which part was wrong", async ({ request }) => {
    const res = await request.post("/api/v1/auth/sign-in", { data: { email: "nobody@example.test", password: "wrong-password" } });
    expect(res.status()).toBe(422);
    expect((await res.json()).error.message).toBe("Incorrect email or password.");
  });

  test("bearer token from sign-in authorizes /me", async ({ page, request }, info) => {
    const email = `api-${Date.now()}-${info.project.name}@example.test`;
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("API User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("correct-horse-battery");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/onboarding/);
    const signIn = await request.post("/api/v1/auth/sign-in", { data: { email, password: "correct-horse-battery" } });
    const { data } = await signIn.json();
    const me = await request.get("/api/v1/me", { headers: { Authorization: `Bearer ${data.token}` } });
    expect(me.status()).toBe(200);
    expect((await me.json()).data.user.email).toBe(email);
    const other = await request.get("/api/v1/projects/00000000-0000-0000-0000-000000000000", { headers: { Authorization: `Bearer ${data.token}` } });
    expect(other.status()).toBe(404);
  });
});
