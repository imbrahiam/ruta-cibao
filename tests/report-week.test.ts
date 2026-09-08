import { describe, expect, test } from "bun:test";
import { previousWeekStart, weekStart } from "@/modules/reports/weekly";

/**
 * Week boundaries decide what a report counts, so getting one wrong moves a
 * whole day of activity into the wrong report — silently, and only visibly
 * wrong to somebody who already knows what the right number was.
 *
 * The province is UTC-4 all year and does not observe daylight saving, so a
 * week runs Monday 00:00 to Monday 00:00 local, which is 04:00 UTC.
 */
const local = (iso: string) => new Date(`${iso}-04:00`);

describe("weekStart", () => {
  test("a Monday morning is its own week's start", () => {
    expect(weekStart(local("2026-09-07T09:30:00")).toISOString()).toBe(
      "2026-09-07T04:00:00.000Z",
    );
  });

  test("Sunday night still belongs to the week that began six days earlier", () => {
    // The trap this exists for: `getUTCDay()` is 0 on Sunday, so the naive
    // "days since Monday" arithmetic lands a week early.
    expect(weekStart(local("2026-09-13T23:59:00")).toISOString()).toBe(
      "2026-09-07T04:00:00.000Z",
    );
  });

  test("one minute past midnight local is the new week, not the old one", () => {
    expect(weekStart(local("2026-09-14T00:01:00")).toISOString()).toBe(
      "2026-09-14T04:00:00.000Z",
    );
  });

  test("one minute before midnight local is still the old week", () => {
    expect(weekStart(local("2026-09-13T23:59:59")).toISOString()).toBe(
      "2026-09-07T04:00:00.000Z",
    );
  });

  test("the boundary is local midnight, not UTC midnight", () => {
    // 02:00 UTC on a Monday is 22:00 the previous Sunday in the province, so
    // it belongs to the week that is still running.
    expect(weekStart(new Date("2026-09-14T02:00:00Z")).toISOString()).toBe(
      "2026-09-07T04:00:00.000Z",
    );
  });

  test("it holds across a month boundary", () => {
    expect(weekStart(local("2026-10-02T12:00:00")).toISOString()).toBe(
      "2026-09-28T04:00:00.000Z",
    );
  });

  test("and across a year boundary", () => {
    expect(weekStart(local("2027-01-01T12:00:00")).toISOString()).toBe(
      "2026-12-28T04:00:00.000Z",
    );
  });

  test("it does not shift when the northern hemisphere changes its clocks", () => {
    // March and November, either side of the dates most of the world moves.
    // Both must still land on a Monday at 04:00 UTC.
    for (const moment of ["2026-03-10T12:00:00", "2026-11-10T12:00:00"]) {
      expect(weekStart(local(moment)).toISOString()).toMatch(
        /T04:00:00\.000Z$/,
      );
    }
  });
});

describe("previousWeekStart", () => {
  test("is exactly seven days before the current week's start", () => {
    const reference = local("2026-09-14T06:00:00");

    expect(
      weekStart(reference).getTime() - previousWeekStart(reference).getTime(),
    ).toBe(7 * 24 * 60 * 60 * 1_000);
  });

  test("the Monday-morning job builds the week that just ended", () => {
    // The schedule fires at 06:00 local on Monday; the report it produces must
    // cover the seven days before that morning, not the one just begun.
    expect(previousWeekStart(local("2026-09-14T06:00:00")).toISOString()).toBe(
      "2026-09-07T04:00:00.000Z",
    );
  });
});
