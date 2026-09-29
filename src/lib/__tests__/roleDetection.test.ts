import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAppliedRole } from "../roleDetection";

test("manual role always wins, even if the resume states otherwise", () => {
  const r = detectAppliedRole({
    manualRole: "SPM",
    extracted: { statedTargetRole: "PM" },
    years: 2,
  });
  assert.equal(r.role, "SPM");
  assert.equal(r.autoDetected, false);
  assert.equal(r.note, null);
});

test("explicit statement in the resume is used over the years heuristic", () => {
  const r = detectAppliedRole({
    manualRole: null,
    extracted: { statedTargetRole: "SPM" },
    years: 2, // would otherwise default to PM
  });
  assert.equal(r.role, "SPM");
  assert.equal(r.autoDetected, true);
  assert.match(r.note!, /explicitly states/);
});

test("no statement + <=4 years -> defaults to PM", () => {
  for (const years of [0, 1, 2, 3, 4]) {
    const r = detectAppliedRole({ manualRole: null, extracted: { statedTargetRole: "NONE" }, years });
    assert.equal(r.role, "PM", `years=${years}`);
    assert.equal(r.autoDetected, true);
  }
});

test("no statement + 5+ years -> defaults to SPM", () => {
  for (const years of [5, 6, 10]) {
    const r = detectAppliedRole({ manualRole: null, extracted: { statedTargetRole: "NONE" }, years });
    assert.equal(r.role, "SPM", `years=${years}`);
  }
});

test("ambiguous dates (years=null) -> defaults to PM with a manual-review note", () => {
  const r = detectAppliedRole({ manualRole: null, extracted: { statedTargetRole: "NONE" }, years: null });
  assert.equal(r.role, "PM");
  assert.equal(r.autoDetected, true);
  assert.match(r.note!, /unclear/);
});
