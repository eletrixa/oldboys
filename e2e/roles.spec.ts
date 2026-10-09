/**
 * E2E: the role picker on the start form searches the preselected catalog and keeps free text.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  e2e/roles.spec.ts
 * Deps:    @playwright/test, e2e/session
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Typing filters by title and by Czech alias; click and keyboard both select; unknown text stays as typed
 *
 * Design constraints:
 * - Logs in through a throwaway account; never submits the form (no spend)
 */
import { expect, test } from "@playwright/test";
import { registerAndLogin } from "./session";

test("roles are searchable and selectable", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/");
  const role = page.getByRole("combobox", { name: "Role you are hiring for" });
  await expect(role).toBeVisible();

  await role.fill("data eng");
  const list = page.getByRole("listbox", { name: "Preselected roles" });
  await expect(list.getByRole("option").first()).toContainText("Data Engineer");
  await list.getByRole("option", { name: /^Data Engineer/ }).click();
  await expect(role).toHaveValue("Data Engineer");
  await expect(list).toBeHidden();

  await role.fill("datový inž"); // Czech alias
  await expect(list.getByRole("option").first()).toContainText("Data Engineer");

  await role.fill("ux");
  await expect(list.getByRole("option")).not.toHaveCount(0);
  await role.press("ArrowDown");
  await role.press("ArrowDown");
  const second = await list.getByRole("option").nth(1).innerText();
  await role.press("Enter");
  await expect(role).toHaveValue(second.split("\n")[0] ?? "");

  await role.fill("Chief Happiness Wizard");
  await expect(list).toBeHidden();
  await expect(role).toHaveValue("Chief Happiness Wizard");
});
