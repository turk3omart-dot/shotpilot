import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../tests/fixtures/the-last-light.fountain");

test("workspace → project → upload → analyse → review → confirm → budget", async ({ page }, info) => {
  const id = `${Date.now()}-${info.project.name}`;
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Noura Producer");
  await page.getByLabel("Email").fill(`e2e-${id}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Company or team name").fill(`Desert Light ${id}`);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/w\/desert-light/);

  await page.getByRole("link", { name: /New project|Create a project/ }).first().click();
  await page.getByLabel("Project name").fill("The Last Light");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/script$/);
  await expect(page.getByText("Rule-based analysis (no AI)")).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(fixture);
  await page.getByRole("button", { name: "Save script" }).click();
  await expect(page.getByText(/^Version 1/)).toBeVisible();

  await page.getByRole("button", { name: "Analyse script" }).click();
  await expect(page).toHaveURL(/\/breakdown\?id=/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Breakdown" })).toBeVisible();
  await expect(page.getByText("EXT. AL-ULA DESERT ROAD - DAWN", { exact: true })).toBeVisible();
  await expect(page.getByText("Scenes (5)")).toBeVisible();

  // Open a scene and reject a keyword suggestion.
  await page.getByRole("button", { name: /EXT\. ROCK FORMATION - NIGHT/ }).click();
  await page.getByRole("button", { name: "Reject smoke" }).click();
  await expect(page.getByRole("button", { name: "Undo" }).first()).toBeVisible();

  await page.getByRole("button", { name: /Confirm breakdown/ }).click();
  await expect(page.getByText(/^Confirmed/).first()).toBeVisible();

  await page.getByRole("link", { name: "Budget", exact: true }).click();
  await expect(page.getByText("Sample rate card")).toBeVisible();
  await page.getByRole("button", { name: /Create standard budget/ }).click();
  await expect(page).toHaveURL(/\/budget\/[0-9a-f-]+$/);
  await expect(page.getByText("Director of photography").first()).toBeVisible();
  await expect(page.getByText(/SAMPLE rates/)).toBeVisible();
});

test("unauthenticated users are sent to sign in", async ({ page }) => {
  await page.goto("/w/anything");
  await expect(page).toHaveURL(/\/login/);
});
