/**
 * "GitHub contributions" section on the run page for technical roles: public GitHub numbers, each linked to where it was read.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/code-profile-card.tsx
 * Deps:    src/domain/code-profile (types, caveats), src/domain/url (httpUrl), ./code-profile-text, ../../ui (Eyebrow, LINK, Pill)
 * Tested:  n/a (the numbers and lines are tested in __tests__/code-profile-card.test.ts)
 *
 * Key responsibilities:
 * - CodeProfileCard: handle linked to the profile, stat row with a small "source" link per group, language pills, repo
 *   hairline repo rows written as plain sentences, merged-PR sample, organizations, the profile-page numbers (pinned repos, last-year contributions, first commit year),
 *   the "statistics not computed yet" line and the caveats; nothing when `profile` is null
 *
 * Design constraints:
 * - No hooks, English only; numbers and links, never a score or an adjective about the person
 */
import { CODE_PROFILE_CAVEATS, type CodeProfile } from "@/domain/code-profile";
import { httpUrl } from "@/domain/url";
import { Eyebrow, LINK, Pill } from "../../ui";
import { fmtInt, PENDING_PREFIX, repoNumbers, sharePct, statGroups, weeks } from "./code-profile-text";

function Src({ url }: { url: string | null }): React.JSX.Element | null {
  if (url === null) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="ml-1 text-xs text-muted underline underline-offset-2 hover:text-ink">
      source
    </a>
  );
}

function Ext({ url, children }: { url: string; children: React.ReactNode }): React.JSX.Element {
  const href = httpUrl(url);
  if (href === null) return <span>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={LINK}>
      {children}
    </a>
  );
}

export function CodeProfileCard({ profile }: { profile: CodeProfile | null | undefined }): React.JSX.Element | null {
  if (profile === null || profile === undefined) return null;
  const apify = profile.apify;
  return (
    <section aria-labelledby="code-contributions" className="border-t border-divider pt-6">
      <Eyebrow>Public GitHub work only</Eyebrow>
      <h2 id="code-contributions" className="mt-1 font-sans text-base font-semibold">
        GitHub contributions
      </h2>
      <p className="mt-1 text-sm text-muted">
        <Ext url={profile.profile_url}>{profile.handle}</Ext>
      </p>

      <dl className="mt-3 grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-2">
        {statGroups(profile).map((g) => (
          <div key={g.label} className="border-t border-divider py-2">
            <dt className="text-xs text-muted">{g.label}</dt>
            <dd className="text-ink">
              {g.value}
              <Src url={g.source} />
            </dd>
          </div>
        ))}
      </dl>

      {profile.languages.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Main languages by number of own repositories">
          {profile.languages.map((l) => (
            <li key={l.name}>
              <Pill tone="neutral">
                {l.name} · {fmtInt(l.repos)}
              </Pill>
            </li>
          ))}
        </ul>
      )}

      {profile.repos.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-muted">Repositories</h3>
          <ul className="mt-1 divide-y divide-divider border-y border-divider text-sm">
            {profile.repos.map((r) => {
              const n = repoNumbers(r);
              return (
                <li key={r.full_name} className="py-2 break-words">
                  <Ext url={r.url}>{r.full_name}</Ext>
                  <span className="text-muted">
                    {" "}
                    {n.commits} commits, {n.lines} lines, {sharePct(r.share)} of its commits, weeks {weeks(r.first_week, r.last_week)},{" "}
                    {r.language ?? "no main language"}, {fmtInt(r.stars)} stars.
                  </span>
                  <Src url={httpUrl(r.source_url)} />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {profile.merged_prs_sample.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-muted">Merged pull requests in other repositories</h3>
          <ul className="mt-1 divide-y divide-divider border-y border-divider text-sm">
            {profile.merged_prs_sample.map((pr) => (
              <li key={pr.url} className="py-2 break-words">
                <span className="text-muted">{pr.repo}: </span>
                <Ext url={pr.url}>{pr.title === "" ? pr.url : pr.title}</Ext>
              </li>
            ))}
          </ul>
        </div>
      )}

      {profile.orgs.length > 0 && (
        <p className="mt-4 text-sm text-ink">
          <span className="text-xs text-muted">Organizations </span>
          {profile.orgs.join(", ")}
        </p>
      )}

      {apify !== null && (
        <div className="mt-4 text-sm">
          <h3 className="text-xs font-semibold text-muted">
            From the GitHub profile page (via Apify)
            <Src url={httpUrl(apify.source_url)} />
          </h3>
          <p className="mt-1 text-ink">
            {[
              apify.last_year_contributions === null ? null : `${fmtInt(apify.last_year_contributions)} contributions in the last year`,
              apify.first_commit_year === null ? null : `first commit ${String(apify.first_commit_year)}`,
            ]
              .filter((x): x is string => x !== null)
              .join(" · ")}
          </p>
          {apify.achievements.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Achievements">
              {apify.achievements.map((a) => (
                <li key={a}>
                  <Pill tone="neutral">{a}</Pill>
                </li>
              ))}
            </ul>
          )}
          {apify.pinned_repos.length > 0 && (
            <ul className="mt-2 divide-y divide-divider border-y border-divider">
              {apify.pinned_repos.map((r) => (
                <li key={r.url} className="py-2 break-words">
                  <Ext url={r.url}>{r.name}</Ext>
                  <span className="text-muted">
                    {" "}pinned, {fmtInt(r.stars)} stars, {fmtInt(r.forks)} forks{r.languages.length > 0 ? `, ${r.languages.join(", ")}` : ""}.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {profile.stats_pending.length > 0 && (
        <p className="mt-4 flex flex-wrap items-baseline gap-2 text-sm text-muted">
          <Pill tone="unsure">Still pending</Pill>
          <span>
            {PENDING_PREFIX}
            {profile.stats_pending.join(", ")}
          </span>
        </p>
      )}

      <div className="mt-4 text-sm text-muted">
        <h3 className="text-xs font-semibold">What these numbers cannot tell you</h3>
        <ul className="mt-1 list-disc pl-5">
          {CODE_PROFILE_CAVEATS.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
